"use client";

import { useEffect, useSyncExternalStore } from "react";
import { SaveStatus } from "../SaveStatus";
import { useHoldRefresh } from "../holdRefresh";

// The Calendar's one save status after its title (3 Nov, Alex: as every tab; the old AutosaveNote never said
// anything here): the entry pop-up's saves and removes go through `runCalendarSave`, and the header reads it.
// Saving… grey, ✓ All changes saved green, `Not saved | Retry` in red, Retry running the failed one again.
// No toasts for a save: the header says it.

type Job = () => Promise<void>;
let state = { busy: false, failed: false };
let failedJob: Job | null = null;
const subs = new Set<() => void>();
const set = (next: typeof state) => {
  state = next;
  for (const f of subs) f();
};

/** Runs one Calendar save; true when it went. One that fails is kept for the header's Retry. */
export async function runCalendarSave(job: Job): Promise<boolean> {
  set({ busy: true, failed: false });
  try {
    await job();
    failedJob = null;
    set({ busy: false, failed: false });
    return true;
  } catch {
    failedJob = job;
    set({ busy: false, failed: true });
    return false;
  }
}

const SERVER = { busy: false, failed: false };

export default function CalendarSaveStatus() {
  const s = useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => void subs.delete(f);
    },
    () => state,
    () => SERVER,
  );
  // A save on its way, or failed and waiting for Retry: the page doesn't read itself again meanwhile (RefreshOnReturn).
  useHoldRefresh(s.busy || s.failed);
  // Leaving the Calendar lets a failure go, so coming back starts clean (a failed save never outlives its page).
  useEffect(
    () => () => {
      failedJob = null;
      state = { busy: false, failed: false };
    },
    [],
  );
  return <SaveStatus busy={s.busy} failed={s.failed} onRetry={() => failedJob && void runCalendarSave(failedJob)} />;
}
