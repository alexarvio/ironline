"use client";

import { useEffect } from "react";
import { pic, type PicWidth } from "../lib/pic";

// Pictures fetched ahead (27 Oct, Alex: Compare "loading a bit slowly"): one after another, quietly, a moment after the
// screen has drawn, at the size it shows them, so switching to one finds it in the browser's cache. A change of list
// stops the old run.
export function usePicsAhead(srcs: (string | null | undefined)[], w: PicWidth, delayMs = 150) {
  const key = srcs.filter(Boolean).join("|");
  useEffect(() => {
    if (!key) return;
    let stopped = false;
    const queue = key.split("|");
    const next = () => {
      if (stopped) return;
      const src = queue.shift();
      if (!src) return;
      const img = new Image();
      img.decoding = "async";
      img.onload = img.onerror = () => next();
      img.src = pic(src, w);
    };
    const t = setTimeout(next, delayMs);
    return () => {
      stopped = true;
      clearTimeout(t);
    };
  }, [key, w, delayMs]);
}
