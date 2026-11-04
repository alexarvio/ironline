"use client";

import { useEffect, useRef, useState } from "react";
import { useHoldRefresh } from "./holdRefresh";

// Autosave for a tab's section (21 Oct, Alex: Nutrition as Lifestyle): changes
// show on screen at once and their saves run behind them, one at a time, in
// the order they were made. A save that fails stays first in line; Retry runs
// it again. `afterwards` runs when the line is empty (the page's re-read).
// The section's status line reads `saving` and `failed`:
// Saving… / ✓ All changes saved / Not saved · Retry.

export type SaveJob = () => Promise<boolean>;

export function useSaveQueue(afterwards: () => void) {
  const jobs = useRef<SaveJob[]>([]);
  const running = useRef(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const after = useRef(afterwards);
  useEffect(() => {
    after.current = afterwards;
  });
  const run = async () => {
    if (running.current) return;
    running.current = true;
    setSaving(true);
    setFailed(false);
    let ok = true;
    while (ok && jobs.current.length > 0) {
      try {
        ok = await jobs.current[0]();
      } catch {
        ok = false;
      }
      if (ok) jobs.current.shift();
    }
    running.current = false;
    setSaving(false);
    if (!ok) setFailed(true);
    after.current();
  };
  const save = (job: SaveJob) => {
    jobs.current.push(job);
    void run();
  };
  // A save on its way, or failed and waiting for Retry: the page doesn't read itself again meanwhile (RefreshOnReturn).
  useHoldRefresh(saving || failed);
  return { save, saving, failed, retry: () => void run() };
}

/** Whether the status line shows: always (4 Nov, Alex: "a visual thing that tells the coach whatever he was doing is
 *  saved… we have to have it"; from 22 Oct it waited for the first save on the screen, so a tab just opened said
 *  nothing). ✓ All changes saved from the start, Saving… while something goes. Kept as a hook so every tab reads it
 *  one way. */
export function useSaidSaved(busy: boolean): boolean {
  void busy;
  return true;
}

/** Leaving while something is still on its way: the browser asks first. Nor does the page read itself again
 *  meanwhile (RefreshOnReturn, holdRefresh.ts). */
export function useHoldWhile(busy: boolean) {
  useHoldRefresh(busy);
  useEffect(() => {
    if (!busy) return;
    const hold = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", hold);
    return () => window.removeEventListener("beforeunload", hold);
  }, [busy]);
}
