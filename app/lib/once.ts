import { revalidatePath } from "next/cache";
import { getData, persist, type OnceKey } from "./db";

// A save taken once (6 Nov, Alex: "it could come to a lot of confusing moments if we start having duplicates"). Since
// experimental.useOffline (next.config.ts), a save whose connection dropped is sent again once the signal is back. If
// the first had reached the server and only its answer was lost, a save that adds a row (a food, an event, a week, an
// invoice) would add it twice. So each such save carries a one-time key made on the device the moment it was tapped
// (lib/onceKey.ts), and the server answers a key it has taken as it did the first time, adding nothing. A save that
// sets a value (a set, a check-in answer, a note) needs none: sent twice it lands in the same place.
//
// Kept in the store (`once_keys`, in Postgres's kv), so a save sent again after a restart or a deploy is still known;
// a day is plenty, a save goes again within minutes. A save with no key (a page from before this) runs as it always did.

const DAY_MS = 86_400_000;
const MAX_KEPT = 5000;
const KEY = /^[A-Za-z0-9_-]{8,80}$/;

const g = globalThis as unknown as { __norcoachOnceRunning?: Map<string, Promise<unknown>> };
/** Saves still running, by key: one that comes again meanwhile waits for the first and answers as it does. */
const running = (g.__norcoachOnceRunning ??= new Map());

function rows(): OnceKey[] {
  const d = getData();
  if (!d.once_keys) d.once_keys = [];
  return d.once_keys;
}

function findKey(full: string): OnceKey | undefined {
  return rows().find((r) => r.key === full);
}

function keep(row: OnceKey) {
  const now = Date.now();
  const d = getData();
  const kept = rows().filter((r) => now - r.at < DAY_MS && r.key !== row.key);
  kept.push(row);
  d.once_keys = kept.length > MAX_KEPT ? kept.slice(kept.length - MAX_KEPT) : kept;
  persist();
}

/** The key as the device sent it, when it is one (a FormData field, or the argument itself). */
export function onceKeyOf(source: FormData | string | null | undefined, field = "onceKey"): string | null {
  const raw = source instanceof FormData ? source.get(field) : source;
  return typeof raw === "string" && KEY.test(raw) ? raw : null;
}

function redirectDigest(err: unknown): string | null {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT;") ? digest : null;
}

/** A refusal is answered, not kept (6 Nov, review): sent again once its cause is gone, it must run again, not repeat
 *  "That email already has an account" for a day. `{ ok: false }`, `{ error }`, or a redirect to an error. */
function refused(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const r = result as { ok?: unknown; error?: unknown };
  return r.ok === false || (typeof r.error === "string" && r.error.length > 0);
}
const errorRedirect = (digest: string) => /error/i.test(digest);

/** The screen a second arrival lands on is read again, as the first run's revalidatePath did (6 Nov, review): its
 *  answer comes from the store, so without this the page kept showing nothing added and invited a second tap. */
function refreshAll() {
  try {
    revalidatePath("/", "layout");
  } catch {
    /* outside a request (a test): nothing to refresh */
  }
}

function answerAgain<T>(row: OnceKey): T {
  refreshAll();
  if (row.redirect) {
    // As next/navigation's redirect() throws it, so the second arrival is sent where the first was.
    const err = new Error("NEXT_REDIRECT") as Error & { digest: string };
    err.digest = row.redirect;
    throw err;
  }
  return row.result as T;
}

/**
 * Runs `run` the first time `key` comes for `name`, and answers every later arrival of that key as the first did,
 * without running it again. No key: it simply runs. A save that fails is not kept, so sending it again tries again.
 * `name` keeps one save's keys from another's (the save's own name; add the caller's id where a key could be guessed).
 */
export async function once<T>(name: string, key: string | null | undefined, run: () => T | Promise<T>): Promise<T> {
  const k = key && KEY.test(key) ? key : null;
  if (!k) return run();
  const full = `${name}:${k}`;
  const taken = findKey(full);
  if (taken) return answerAgain<T>(taken);
  const already = running.get(full);
  if (already) {
    const answer = await (already as Promise<T>);
    refreshAll();
    return answer;
  }
  const mine: { p?: Promise<T> } = {};
  mine.p = (async () => {
    // Registered before the work starts (6 Nov, review): a save that throws at once still leaves `running`.
    await undefined;
    try {
      const result = await run();
      if (!refused(result)) {
        let stored: unknown;
        try {
          stored = result === undefined ? undefined : JSON.parse(JSON.stringify(result));
        } catch {
          stored = undefined;
        }
        keep({ key: full, at: Date.now(), ...(stored === undefined ? {} : { result: stored }) });
      }
      return result;
    } catch (err) {
      const digest = redirectDigest(err);
      if (digest && !errorRedirect(digest)) keep({ key: full, at: Date.now(), redirect: digest });
      throw err;
    } finally {
      if (running.get(full) === mine.p) running.delete(full);
    }
  })();
  running.set(full, mine.p);
  return mine.p;
}

/** A key taken with takeOnce given back, when the save behind it failed after all, so sending it again tries again. */
export function releaseOnce(name: string, key: string | null | undefined) {
  const k = key && KEY.test(key) ? key : null;
  if (!k) return;
  const full = `${name}:${k}`;
  const d = getData();
  const before = rows().length;
  d.once_keys = rows().filter((r) => r.key !== full);
  if (d.once_keys.length !== before) persist();
}

/**
 * True the first time `key` comes for `name`, false ever after (a day): for a save that answers nothing, where a
 * second arrival should just stop (the chat's send, chatOutbox.ts). Taken the moment it is asked.
 */
export function takeOnce(name: string, key: string | null | undefined): boolean {
  const k = key && KEY.test(key) ? key : null;
  if (!k) return true;
  const full = `${name}:${k}`;
  if (findKey(full) || running.has(full)) return false;
  keep({ key: full, at: Date.now() });
  return true;
}
