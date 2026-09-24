"use client";

import { useEffect, useState } from "react";
import { clock } from "./workoutShared";

// The rest timer in the workout's dock. Phone-only: the start moment is
// kept in sessionStorage so a swipe to the next exercise or a backgrounded
// phone does not lose it. Past the prescribed rest it turns green and, where
// the phone can, buzzes once.
const KEY = "ironline.client.rest";

function readStart(): number | null {
  try {
    const v = window.sessionStorage.getItem(KEY);
    return v ? Number(v) || null : null;
  } catch {
    return null;
  }
}

export function useRestTimer() {
  const [start, setStartState] = useState<number | null>(null);
  const [last, setLast] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setStartState(readStart()), 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (start == null) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [start]);
  const setStart = (v: number | null) => {
    setStartState(v);
    try {
      if (v == null) window.sessionStorage.removeItem(KEY);
      else window.sessionStorage.setItem(KEY, String(v));
    } catch {}
  };
  const begin = () => setStart(Date.now());
  const stop = () => {
    if (start != null) setLast(Math.max(0, Date.now() - start));
    setStart(null);
  };
  const elapsed = start != null ? Math.max(0, now - start) : 0;
  return { running: start != null, elapsed, last, begin, stop };
}

export default function RestTimerPill({
  timer,
  targetSeconds,
}: {
  timer: ReturnType<typeof useRestTimer>;
  /** The prescribed rest for the exercise on screen, if the coach set one. */
  targetSeconds: number | null;
}) {
  const over = timer.running && targetSeconds != null && timer.elapsed >= targetSeconds * 1000;
  // One buzz as the prescribed rest passes.
  const [buzzedFor, setBuzzedFor] = useState<number | null>(null);
  useEffect(() => {
    if (!over || buzzedFor === targetSeconds) return;
    const t = setTimeout(() => {
      setBuzzedFor(targetSeconds);
      try {
        navigator.vibrate?.(200);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [over, targetSeconds, buzzedFor]);
  return (
    <button
      type="button"
      className={`wo-rest${timer.running ? " running" : ""}${over ? " over" : ""}`}
      onClick={() => (timer.running ? timer.stop() : timer.begin())}
      aria-label={timer.running ? "Stop the rest timer" : "Start the rest timer"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="13" r="8" />
        <path d="M12 9v4l2.5 2M9 2h6" />
      </svg>
      {timer.running ? (
        <>
          <span className="wo-rest-label">Rest {clock(timer.elapsed)}</span>
          <span className="wo-rest-stop">Stop</span>
        </>
      ) : (
        <span className="wo-rest-label">{timer.last != null ? `Rest · last ${clock(timer.last)}` : "Rest timer"}</span>
      )}
    </button>
  );
}
