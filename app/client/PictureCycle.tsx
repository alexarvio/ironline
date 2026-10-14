"use client";

import { useEffect, useState } from "react";

/** Pictures taking turns (14 Oct): the first shows, and every few seconds
    the next fades in over it. One picture just sits. */
export default function PictureCycle({ pictures, className, every = 7000 }: { pictures: string[]; className: string; every?: number }) {
  const n = pictures.length;
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (n < 2) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") setTick((x) => x + 1);
    }, every);
    return () => clearInterval(t);
  }, [n, every]);
  if (n === 0) return null;
  const on = tick % n;
  return (
    <span className={className} aria-hidden="true">
      {pictures.map((p, k) => (
        // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route, or a public file
        <img key={p} src={p} alt="" className={k === on ? "on" : ""} draggable={false} />
      ))}
    </span>
  );
}
