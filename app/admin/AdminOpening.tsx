"use client";

// The admin's opening (7 Nov, Alex: "while it's loading, just the logo. And once it's loaded, just the name appears
// from behind and boom… everything centered"): the star alone in the middle of the paper while the admin loads; once it
// is ready the NORCOACH word shoots out from behind the star, the two staying centred as one, so it ends as the logo;
// then the paper fades off the admin (OpeningLogo, the client app's too). Once a page load: the layout it sits in stays
// mounted from screen to screen, and a reload plays it again.

import { useEffect, useState } from "react";
import OpeningLogo, { OPENING_HOLD_MS } from "../components/OpeningLogo";

let played = false;

export default function AdminOpening() {
  const [state, setState] = useState<"on" | "revealing" | "gone">(() => (played ? "gone" : "on"));
  const [opening] = useState(state === "on");

  useEffect(() => {
    if (!opening) return;
    played = true;
    // Hydrated: the admin can be clicked. The star alone for a moment at the least, then two frames so the admin is
    // painted under the paper before the word comes and the paper goes.
    const hold = Math.max(300, OPENING_HOLD_MS - performance.now());
    let raf = 0;
    const start = window.setTimeout(() => {
      raf = requestAnimationFrame(() => {
        raf = requestAnimationFrame(() => setState("revealing"));
      });
    }, hold);
    // Should an animation never end (a background tab, say), the admin still shows.
    const done = window.setTimeout(() => setState("gone"), hold + 4500);
    return () => {
      clearTimeout(start);
      cancelAnimationFrame(raf);
      clearTimeout(done);
    };
  }, [opening]);

  if (state === "gone") return null;
  return <OpeningLogo revealing={state === "revealing"} onEnd={() => setState("gone")} />;
}
