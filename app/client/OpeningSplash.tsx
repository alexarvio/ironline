"use client";

// The client app's opening (7 Nov, Alex: "the norcoach logo on like a blank screen and then when it is done…"; then
// "have the same for the app" as the admin's): the star alone on the paper while the app's first screen loads
// (loading.tsx draws it before the page is in); once the app is ready the NORCOACH word shoots out from behind the star,
// centred, and the paper fades off the app (OpeningLogo). Once a page load: moving inside the app, or back to it from
// an invoice, never plays it again; a reload does.

import { useEffect, useState } from "react";
import OpeningLogo, { OPENING_HOLD_MS } from "../components/OpeningLogo";

/** Played on this page load. A module's state lives as long as the page, so a reload starts it over. */
let played = false;
export const openingPlayed = () => played;

/** The opening as loading.tsx and the page draw it, so the swap between them is never seen. */
export function OpeningScreen(props: { revealing?: boolean; plain?: boolean; onEnd?: () => void }) {
  return <OpeningLogo className="nc-boot-app" {...props} />;
}

export default function OpeningSplash() {
  // On a page load this matches the server's HTML (nothing played yet); arriving from another screen it is gone at once.
  const [state, setState] = useState<"on" | "revealing" | "gone">(() => (played ? "gone" : "on"));
  const [opening] = useState(state === "on");

  useEffect(() => {
    if (!opening) return;
    // No early return when played: dev runs an effect twice, and the second run must still start the reveal.
    played = true;
    // Hydrated: the app can be tapped. The star alone for a moment at the least, then two frames so the app is painted
    // under the paper before the word comes and the paper goes.
    const hold = Math.max(300, OPENING_HOLD_MS - performance.now());
    let raf = 0;
    const start = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setState("revealing"));
      });
    }, hold);
    // Should an animation never end (a background tab, say), the app still shows.
    const done = window.setTimeout(() => setState("gone"), hold + 4500);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [opening]);

  if (state === "gone") return null;
  return <OpeningScreen revealing={state === "revealing"} onEnd={() => setState("gone")} />;
}
