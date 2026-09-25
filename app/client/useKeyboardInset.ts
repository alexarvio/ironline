"use client";

import { useEffect, useState } from "react";

// How much of the screen the on-screen keyboard covers, from the visual
// viewport. iOS lays the page out as if the keyboard weren't there, so a
// sheet pinned to the bottom ends up behind it; lifting the sheet by this
// keeps what is being typed in view. 0 with no keyboard (and on a computer).
export function useKeyboardInset(): number {
  const [kb, setKb] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setKb(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
    };
  }, []);
  return kb;
}
