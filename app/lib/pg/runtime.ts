import path from "path";
import { eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { installStore, prepareStore, readJsonFile, STORE_MODE, type Data } from "../db";
import { kv } from "./schema";
import { loadStore, PgStoreWriter } from "./store";

// Starts the Postgres store (STORE=postgres). Called once from
// instrumentation.ts, which Next awaits before the server takes requests:
//   1. connect, and create or update the tables (migrations in ./drizzle);
//   2. load the data, or, when the database has never held any, import
//      ironline.json, so switching a running install over carries its data;
//   3. hand the data to db.ts, with every later save going to Postgres.
//
// DATABASE_URL is a postgres:// URL on Railway. "pglite:<folder>" runs a
// real Postgres in-process from that folder instead, for local testing with
// no server and no credentials.

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyDb = PgDatabase<any, any, any>;
type Row = Record<string, unknown>;

const MIGRATIONS = path.join(process.cwd(), "drizzle");
const log = (message: string) => console.log(`[store] ${message}`);

async function connect(url: string): Promise<AnyDb> {
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const db = drizzle(new PGlite(url.slice("pglite:".length)));
    await migrate(db, { migrationsFolder: MIGRATIONS });
    return db as unknown as AnyDb;
  }
  const { Pool } = await import("pg");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const db = drizzle(new Pool({ connectionString: url, max: 5 }));
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return db as unknown as AnyDb;
}

async function start() {
  const db = await connect(process.env.DATABASE_URL!);
  (globalThis as unknown as { _pgDb?: AnyDb })._pgDb = db;
  const writer = new PgStoreWriter(db);

  // The id counters are always saved, so their absence means an empty database.
  const hasData = (await db.select().from(kv).where(eq(kv.key, "_seq"))).length > 0;
  let raw: Partial<Data>;
  if (hasData) {
    raw = (await loadStore(db)) as Partial<Data>;
    // What the database holds right now, before the load-time tidies touch it.
    writer.prime(raw as Row);
    log("loaded from Postgres");
  } else {
    const file = readJsonFile();
    raw = file ?? {};
    log(file ? "Postgres is empty: importing ironline.json" : "Postgres is empty and there is no ironline.json: starting blank");
  }

  const { data, changed } = prepareStore(raw);
  // The import, or a tidy's changes, are written before any request arrives,
  // so a failure stops the boot instead of surfacing later.
  if (!hasData || changed) await writer.save(() => data as unknown as Row);

  installStore(data, (current) => {
    writer.save(() => current as unknown as Row).catch((error) => {
      // The in-memory store is still right, and the next save writes
      // everything that differs, this change included.
      console.error("[store] saving to Postgres failed; the next save retries it:", error);
      import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
    });
  });
  log(`ready: ${data.users.length} users, ${data.clients.length} clients`);
}

/** Loads the Postgres store once; does nothing in JSON mode. */
export function initStore(): Promise<void> {
  if (STORE_MODE !== "postgres") return Promise.resolve();
  const g = globalThis as unknown as { _pgInit?: Promise<void> };
  g._pgInit ??= start();
  return g._pgInit;
}
