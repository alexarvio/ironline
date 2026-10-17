"use client";

import { useEffect, useState } from "react";
import { clock } from "./workoutShared";

// The rest timer, the only control in the workout's bottom bar (13 Oct). It
// counts up (17 Oct, Alex): a rest can run three minutes, or far longer on a
// heavy powerlifting day, so it never cuts anyone off. Idle it is a white
// pill, "Rest timer"; a tap starts it and it turns ink, "Rest 0:42",
// counting up; another tap stops it. The coach's rest for the exercise (90s
// with none) is the mark: it buzzes once there and the time turns green. The
// start moment lives in sessionStorage, so a swipe to the next exercise or a
// backgrounded phone does not lose it.
const KEY = "ironline.client.rest";

type Saved = { start: number; duration: number };
function readSaved(): Saved | null {
  try {
    const v = window.sessionStorage.getItem(KEY);
    if (!v) return null;
    const s = JSON.parse(v) as Saved;
    return s && typeof s.start === "number" && typeof s.duration === "number" ? s : null;
  } catch {
    return null;
  }
}

export function useRestTimer() {
  const [saved, setSavedState] = useState<Saved | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setSavedState(readSaved());
      setNow(Date.now());
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!saved) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 500);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [saved]);
  const setSaved = (v: Saved | null) => {
    setSavedState(v);
    try {
      if (v == null) window.sessionStorage.removeItem(KEY);
      else window.sessionStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
  };
  const elapsedMs = saved ? Math.max(0, now - saved.start) : 0;
  /** Past the coach's rest: still counting, the time in green. */
  const past = !!saved && elapsedMs >= saved.duration * 1000;
  const begin = (seconds: number) => setSaved({ start: Date.now(), duration: Math.max(5, Math.round(seconds)) });
  const stop = () => setSaved(null);
  return { running: !!saved, past, elapsedMs, duration: saved?.duration ?? null, begin, stop };
}

export default function RestTimerPill({
  timer,
  targetSeconds,
}: {
  timer: ReturnType<typeof useRestTimer>;
  /** The prescribed rest for the exercise on screen, if the coach set one. */
  targetSeconds: number | null;
}) {
  const duration = targetSeconds ?? 90;
  // One buzz as the coach's rest is reached.
  const [buzzedAt, setBuzzedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!timer.past || buzzedAt === timer.duration) return;
    const t = setTimeout(() => {
      setBuzzedAt(timer.duration);
      try {
        navigator.vibrate?.([120, 80, 120]);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [timer.past, timer.duration, buzzedAt]);
  const tap = () => {
    if (timer.running) timer.stop();
    else {
      setBuzzedAt(null);
      timer.begin(duration);
    }
  };
  return (
    <div className="wo-rest-wrap">
      <button
        type="button"
        className={`wo-rest${timer.running ? " running" : ""}${timer.past ? " past" : ""}`}
        onClick={tap}
        aria-label={timer.running ? `Resting ${clock(timer.elapsedMs)}. Tap to stop` : "Start the rest timer"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
        <span className="wo-rest-label">
          {timer.running ? (
            <>
              Rest <b className="wo-rest-time">{clock(timer.elapsedMs)}</b>
            </>
          ) : (
            "Rest timer"
          )}
        </span>
      </button>
    </div>
  );
}
