"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Autosave for the exercise editor (14 Oct): every change is a job on one
// queue, so saves land in the order they were made; text fields wait 600ms
// after the last keystroke (and save at once on blur), clicks save at once.
// The chip reads SAVED, SAVING… (for at least 400ms, so it does not flicker)
// or NOT SAVED (the failed job is kept, a click on the chip retries it).

export type SaveState = "saved" | "saving" | "error";

export function useAutosave() {
  const [state, setState] = useState<SaveState>("saved");
  const chain = useRef<Promise<void>>(Promise.resolve());
  const inFlight = useRef(0);
  const failed = useRef<(() => Promise<unknown>) | null>(null);
  const timers = useRef<Map<string, { t: ReturnType<typeof setTimeout>; fn: () => Promise<unknown> }>>(new Map());
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  /** One save, after the ones before it. */
  const run = useCallback((fn: () => Promise<unknown>) => {
    inFlight.current++;
    setState("saving");
    const startedAt = Date.now();
    const job = chain.current.then(async () => {
      try {
        const r = await fn();
        if (r === false) throw new Error("refused");
        failed.current = null;
      } catch {
        failed.current = fn;
        if (mounted.current) setState("error");
      } finally {
        inFlight.current--;
        if (inFlight.current === 0 && failed.current == null) {
          const wait = Math.max(0, 400 - (Date.now() - startedAt));
          setTimeout(() => {
            if (mounted.current && inFlight.current === 0 && failed.current == null) setState("saved");
          }, wait);
        }
      }
    });
    chain.current = job;
    return job;
  }, []);

  /** A text field's save: 600ms after the last keystroke, keyed so a newer keystroke replaces it. */
  const later = useCallback(
    (key: string, fn: () => Promise<unknown>, ms = 600) => {
      const had = timers.current.get(key);
      if (had) clearTimeout(had.t);
      const t = setTimeout(() => {
        timers.current.delete(key);
        void run(fn);
      }, ms);
      timers.current.set(key, { t, fn });
    },
    [run]
  );

  /** The field was left: whatever it was waiting to save goes now. */
  const now = useCallback(
    (key: string, fn?: () => Promise<unknown>) => {
      const had = timers.current.get(key);
      if (had) {
        clearTimeout(had.t);
        timers.current.delete(key);
      }
      const job = fn ?? had?.fn;
      if (job) void run(job);
    },
    [run]
  );

  /** Everything still waiting, then everything in flight. Resolves true when all of it saved. */
  const flush = useCallback(async () => {
    for (const [key] of [...timers.current]) now(key);
    const settle = chain.current;
    await Promise.race([settle, new Promise((r) => setTimeout(r, 3000))]);
    return failed.current == null;
  }, [now]);

  const retry = useCallback(() => {
    const fn = failed.current;
    if (!fn) return;
    failed.current = null;
    void run(fn);
  }, [run]);

  return { state, run, later, now, flush, retry };
}
