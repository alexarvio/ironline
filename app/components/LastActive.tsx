"use client";

import { useEffect, useState } from "react";
import { lastActiveWords } from "../lib/lastActive";

/** When the client was last in the app, under their name in a chat's head (4 Nov, Alex; lib/lastActive.ts): the laptop's
 *  chat and the coach's phone alike. The words move on every minute while it shows, with nothing fetched for it; a
 *  newer time comes with the thread's own reads. Nothing at all when there is no time yet, unless `keepRoom`: then an
 *  empty line of the same height, so the name over it sits in one place for every client and never moves when the
 *  thread loads or a first time comes in (4 Nov, Alex: the head doesn't jump). */
export default function LastActive({ at, className, keepRoom }: { at: string | null | undefined; className?: string; keepRoom?: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const id = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, [at]);
  // A newer time than the last tick reads as now (lastActiveWords holds the wait at zero).
  const words = lastActiveWords(at, now);
  if (!words) return keepRoom ? <span className={className} aria-hidden="true" /> : null;
  return (
    <span className={className} suppressHydrationWarning>
      {words}
    </span>
  );
}
