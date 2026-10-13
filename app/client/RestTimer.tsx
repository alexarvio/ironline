"use client";

import { useEffect, useRef, useState } from "react";
import { clock } from "./workoutShared";

// The rest timer, the only control in the workout's bottom bar (13 Oct). A
// tap starts a countdown from the coach's rest for the exercise (90s with
// none); running, it reads "Rest 1:23" and a tap stops it; over, it turns
// green, "Rest over · go", buzzes, and goes back to idle after 5s or a tap.
// A long press offers 60 / 90 / 120 / 180 s and +30 s. The start moment
// and the length live in sessionStorage, so a swipe to the next exercise
// or a backgrounded phone does not lose it.
const KEY = "ironline.client.rest";
const OVER_SHOWN_MS = 5000;

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
  const elapsed = saved ? Math.max(0, now - saved.start) : 0;
  const remainingMs = saved ? saved.duration * 1000 - elapsed : 0;
  const over = !!saved && remainingMs <= 0;
  // Over for five seconds: back to idle on its own.
  useEffect(() => {
    if (!over || !saved) return;
    const left = saved.start + saved.duration * 1000 + OVER_SHOWN_MS - Date.now();
    const t = setTimeout(() => setSaved(null), Math.max(0, left));
    return () => clearTimeout(t);
  }, [over, saved]);
  const begin = (seconds: number) => setSaved({ start: Date.now(), duration: Math.max(5, Math.round(seconds)) });
  const stop = () => setSaved(null);
  const extend = (seconds: number) => saved && !over && setSaved({ ...saved, duration: saved.duration + seconds });
  return { running: !!saved && !over, over, remainingMs, duration: saved?.duration ?? null, begin, stop, extend };
}

const QUICK = [60, 90, 120, 180];

export default function RestTimerPill({
  timer,
  targetSeconds,
}: {
  timer: ReturnType<typeof useRestTimer>;
  /** The prescribed rest for the exercise on screen, if the coach set one. */
  targetSeconds: number | null;
}) {
  const duration = targetSeconds ?? 90;
  // One buzz as the rest runs out.
  const [buzzedAt, setBuzzedAt] = useState<number | null>(null);
  useEffect(() => {
    if (!timer.over || buzzedAt === timer.duration) return;
    const t = setTimeout(() => {
      setBuzzedAt(timer.duration);
      try {
        navigator.vibrate?.([120, 80, 120]);
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [timer.over, timer.duration, buzzedAt]);
  // A long press opens the quick lengths.
  const [menu, setMenu] = useState(false);
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const clear = () => {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  };
  useEffect(() => clear, []);
  const tap = () => {
    if (held.current) {
      held.current = false;
      return;
    }
    if (timer.running || timer.over) timer.stop();
    else timer.begin(duration);
  };
  const label = timer.over ? "Rest over · go" : timer.running ? `Rest ${clock(timer.remainingMs)}` : "Rest timer";
  return (
    <div className="wo-rest-wrap">
      {menu && (
        <>
          <button type="button" className="wo-rest-scrim" aria-label="Close" onClick={() => setMenu(false)} />
          <div className="wo-rest-menu" role="menu">
            {QUICK.map((s) => (
              <button
                key={s}
                type="button"
                role="menuitem"
                className={`wo-rest-opt${s === duration ? " on" : ""}`}
                onClick={() => {
                  setMenu(false);
                  timer.begin(s);
                }}
              >
                {s}s
              </button>
            ))}
            <button
              type="button"
              role="menuitem"
              className="wo-rest-opt"
              disabled={!timer.running}
              onClick={() => {
                setMenu(false);
                timer.extend(30);
              }}
            >
              +30s
            </button>
          </div>
        </>
      )}
      <button
        type="button"
        className={`wo-rest${timer.running ? " running" : ""}${timer.over ? " over" : ""}`}
        onPointerDown={() => {
          clear();
          held.current = false;
          hold.current = setTimeout(() => {
            held.current = true;
            setMenu(true);
          }, 500);
        }}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onContextMenu={(e) => e.preventDefault()}
        onClick={tap}
        aria-label={timer.over ? "Rest over. Tap to clear" : timer.running ? `Rest, ${clock(timer.remainingMs)} left. Tap to stop` : `Start the rest timer, ${duration} seconds`}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="13" r="8" />
          <path d="M12 9v4l2.5 2M9 2h6" />
        </svg>
        <span className="wo-rest-label">{label}</span>
      </button>
    </div>
  );
}
