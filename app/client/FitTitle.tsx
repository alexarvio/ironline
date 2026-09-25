"use client";

import { useLayoutEffect, useRef } from "react";

// A banner title kept to one line so the Training and Nutrition banners are
// the same height: a long name steps its type down until it fits (to `min`, 22px unless set),
// then ends in an ellipsis. The line box stays the same height throughout.
export default function FitTitle({ className, min = 22, children }: { className: string; min?: number; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, min]);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
