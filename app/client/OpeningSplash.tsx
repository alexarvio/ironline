"use client";

// The opening (7 Nov, Alex: "the norcoach logo on like a blank screen and then when it is done, an animation at it
// spins off and then the app appears"): the star on the phone shell's paper, as its launch screen draws it, while the
// app's first screen loads (loading.tsx draws it before the page is in), then, the moment the app is ready, the star
// spins away and the paper fades off the app. Once a page load: moving inside the app, or back to it from an invoice,
// never plays it again; a reload does. Styles: "Opening" at the end of globals.css.

import { useEffect, useState } from "react";
import { NorCoachMark } from "../components/NorCoachLogo";

/** Played on this page load. A module's state lives as long as the page, so a reload starts it over. */
let played = false;
/** The least time from opening before the logo spins off (7 Nov, Alex). */
const HOLD_MS = 1200;
export const openingPlayed = () => played;

/** The paper and the star, as loading.tsx and the page draw it, so the swap between them is never seen. */
export function OpeningScreen({ leaving = false, plain = false, onEnd }: { leaving?: boolean; plain?: boolean; onEnd?: () => void }) {
  return (
    <div
      className={`nc-open${leaving ? " leaving" : ""}`}
      aria-hidden="true"
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && (e.animationName === "nc-open-off" || e.animationName === "nc-open-safe")) onEnd?.();
      }}
    >
      {!plain && <NorCoachMark className="nc-open-star" />}
    </div>
  );
}

export default function OpeningSplash() {
  // On a page load this matches the server's HTML (nothing played yet); arriving from another screen it is gone at once.
  const [state, setState] = useState<"on" | "leaving" | "gone">(() => (played ? "gone" : "on"));
  const [opening] = useState(state === "on");

  useEffect(() => {
    if (!opening) return;
    // No early return when played: dev runs an effect twice, and the second run must still start the exit.
    played = true;
    // Hydrated: the app can be tapped. The logo stays until 1.2s from opening at the least (7 Nov, Alex: "insanely
    // fast"; a laptop is ready in a blink), then two frames so the app is painted under the paper before it goes.
    const hold = Math.max(0, HOLD_MS - performance.now());
    let raf = 0;
    const start = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setState("leaving"));
      });
    }, hold);
    // Should an animation never end (a background tab, say), the app still shows.
    const done = window.setTimeout(() => setState("gone"), hold + 1800);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [opening]);

  if (state === "gone") return null;
  return <OpeningScreen leaving={state === "leaving"} onEnd={() => setState("gone")} />;
}
