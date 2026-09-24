import type { PgDatabase } from "drizzle-orm/pg-core";
import { STORE_MODE } from "../db";
import { initStore } from "./runtime";

// The connection for code that queries Postgres directly (phase 2), instead
// of working on the in-memory store through getData(). Tables used this way
// are the ones in schema.ts outside COLLECTIONS.
//
// null in JSON mode (the scripts in scripts/): callers treat that as "the
// feature is off here" rather than failing.

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Db = PgDatabase<any, any, any>;

export async function pg(): Promise<Db | null> {
  if (STORE_MODE !== "postgres") return null;
  // Normally done by instrumentation.ts before the first request; awaiting
  // it here makes the connection safe to use from anywhere.
  await initStore();
  return (globalThis as unknown as { _pgDb?: Db })._pgDb ?? null;
}
