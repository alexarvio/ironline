"use client";

import { useEffect, useLayoutEffect, useState } from "react";

// Pictures taking turns (14 Oct; 17 Oct, Alex: seven seconds was far too
// fast). Each picture stays twenty minutes. Which one shows is read off the
// clock, not off when the screen opened, so leaving and coming back keeps the
// same picture, and Home's card and the tab's banner always agree. Where in
// the turn a phone starts is random, kept per device, so it isn't always the
// first upload. One picture just sits.
const HOLD_MS = 20 * 60 * 1000;
const SEED_KEY = "nc-picture-seed";

function seed(): number {
  try {
    const kept = Number(localStorage.getItem(SEED_KEY));
    if (Number.isInteger(kept) && kept > 0) return kept;
    const fresh = 1 + Math.floor(Math.random() * 1_000_000);
    localStorage.setItem(SEED_KEY, String(fresh));
    return fresh;
  } catch {
    return 1 + Math.floor(Math.random() * 1_000_000);
  }
}

const slotNow = (n: number, s: number) => (Math.floor(Date.now() / HOLD_MS) + s) % n;

export default function PictureCycle({ pictures, className }: { pictures: string[]; className: string }) {
  const n = pictures.length;
  // The server draws the first; before the first paint the phone swaps in the
  // one the clock says, so nothing flashes.
  const [on, setOn] = useState(0);
  useLayoutEffect(() => {
    if (n > 1) setOn(slotNow(n, seed()));
  }, [n]);
  // Checked every half minute (and on coming back to the app) so the change
  // lands within moments of the twenty minutes.
  useEffect(() => {
    if (n < 2) return;
    const s = seed();
    const check = () => {
      if (document.visibilityState === "visible") setOn(slotNow(n, s));
    };
    const t = setInterval(check, 30_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [n]);
  if (n === 0) return null;
  return (
    <span className={className} aria-hidden="true">
      {pictures.map((p, k) => (
        // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route, or a public file
        <img key={p} src={p} alt="" className={k === on % n ? "on" : ""} draggable={false} />
      ))}
    </span>
  );
}
