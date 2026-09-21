"use client";

import { useEffect, useRef, useState } from "react";

// A figure that runs from its last value to the new one instead of snapping —
// a ring filling, a count-up. 600ms is the design's "a figure earning
// itself"; it goes straight there for anyone with reduced motion on.
//
// Shared, because the client's calorie rings and the coach's Keeping up rings
// are the same gesture and should take the same time over the same curve.
export function useTween(target: number, ms = 600) {
  const [value, setValue] = useState(target);
  const current = useRef(target);

  useEffect(() => {
    const from = current.current;
    if (from === target) return;
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const began = performance.now();
    let frame = 0;
    let landed = false;
    const land = () => {
      landed = true;
      current.current = target;
      setValue(target);
    };
    const step = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - began) / ms);
      if (t >= 1) {
        land();
        return;
      }
      current.current = from + (target - from) * (1 - Math.pow(1 - t, 3));
      setValue(current.current);
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    // A window that is not drawing — behind another window, a background tab,
    // a pane the compositor has parked — gets no animation frames at all. The
    // figure would then sit on its OLD value while the label beside it says
    // the new thing: not a missing animation, a wrong number. Timers still
    // fire, so one lands it whatever the compositor is doing.
    const backstop = window.setTimeout(() => {
      if (!landed) land();
    }, ms + 80);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(backstop);
    };
  }, [target, ms]);

  return value;
}
