"use client";

import { useEffect } from "react";

// A pinch-zoom made a client's phone go blank (2 Nov, Alex). Zoomed in, the phone redraws every layer at the zoomed
// size, and the app's heaviest ones (the moving blurred glows on Home's phase cards and events, the frosted glass over
// the photos) ran it out of memory. So while the page is zoomed in, <html> carries `zoomed` and those layers rest: the
// glows pause and go, the blur turns off ("Zoomed in" at the end of globals.css). Back at 1×, everything is as it was.
const ZOOMED_ABOVE = 1.02;

export default function ZoomCalm() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => root.classList.toggle("zoomed", vv.scale > ZOOMED_ABOVE));
    };
    check();
    vv.addEventListener("resize", check);
    return () => {
      vv.removeEventListener("resize", check);
      cancelAnimationFrame(frame);
      root.classList.remove("zoomed");
    };
  }, []);
  return null;
}
