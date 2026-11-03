"use client";

import { useEffect, useState } from "react";
import { clock } from "./workoutShared";

// The rest timer, the only control in the workout's bottom bar (13 Oct). A countdown (3 Nov, Alex: "everytime I press
// it I get the option of 1 min 2 min and 3 min"; it counted up before): a tap opens the three over the bar, a pick
// starts it and the pill turns ink, "Rest 1:42", counting down. At zero it buzzes and says "Rest done" in green for a
// moment, then "Rest timer" again. A tap while it runs opens the three again, with Stop. The start moment lives in
// sessionStorage, so a swipe to the next exercise or a backgrounded phone does not lose it.
const KEY = "ironline.client.rest";
const CHOICES = [60, 120, 180];
/** How long "Rest done" stays before the pill is "Rest timer" again. */
const DONE_MS = 4000;

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
    const t = setInterval(tick, 250);
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
  const endsAt = saved ? saved.start + saved.duration * 1000 : 0;
  /** Time left, rounded up to the second so it reads 1:00 the moment it starts and 0:01 last. */
  const remainingMs = saved ? Math.max(0, Math.ceil((endsAt - now) / 1000) * 1000) : 0;
  /** Counted down to zero (and not yet cleared). */
  const done = !!saved && now >= endsAt;
  /** Over so long ago that "Rest done" has had its moment. */
  const stale = !!saved && now >= endsAt + DONE_MS;
  const begin = (seconds: number) => setSaved({ start: Date.now(), duration: Math.max(5, Math.round(seconds)) });
  const stop = () => setSaved(null);
  useEffect(() => {
    if (stale) setSaved(null);
  }, [stale]);
  return { running: !!saved && !done, done: done && !stale, remainingMs, duration: saved?.duration ?? null, begin, stop };
}

export default function RestTimerPill({ timer }: { timer: ReturnType<typeof useRestTimer> }) {
  const [open, setOpen] = useState(false);
  // One buzz as it reaches zero.
  const [buzzedFor, setBuzzedFor] = useState<number | null>(null);
  useEffect(() => {
    if (!timer.done || buzzedFor === timer.duration) return;
    const t = setTimeout(() => {
      setBuzzedFor(timer.duration);
      try {
        navigator.vibrate?.([120, 80, 120]);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [timer.done, timer.duration, buzzedFor]);
  const pick = (seconds: number) => {
    setOpen(false);
    setBuzzedFor(null);
    timer.begin(seconds);
  };
  return (
    <div className="wo-rest-wrap">
      {open && (
        <>
          <button type="button" className="wo-rest-scrim" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="wo-rest-menu" role="menu" aria-label="Rest for">
            {CHOICES.map((s) => (
              <button key={s} type="button" role="menuitem" className={`wo-rest-opt${timer.running && timer.duration === s ? " on" : ""}`} onClick={() => pick(s)}>
                {s / 60} min
              </button>
            ))}
            {timer.running && (
              <button
                type="button"
                role="menuitem"
                className="wo-rest-opt stop"
                onClick={() => {
                  setOpen(false);
                  timer.stop();
                }}
              >
                Stop
              </button>
            )}
          </div>
        </>
      )}
      <button
        type="button"
        className={`wo-rest${timer.running ? " running" : ""}${timer.done ? " done" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={timer.running ? `Resting, ${clock(timer.remainingMs)} left` : "Rest timer"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
        <span className="wo-rest-label">
          {timer.running ? (
            <>
              Rest <b className="wo-rest-time">{clock(timer.remainingMs)}</b>
            </>
          ) : timer.done ? (
            "Rest done"
          ) : (
            "Rest timer"
          )}
        </span>
      </button>
    </div>
  );
}
