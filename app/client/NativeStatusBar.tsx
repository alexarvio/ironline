"use client";

import { useEffect } from "react";
import { callNative, nativePlatform } from "../lib/native";

// The iPhone app's clock and battery (11 Nov, Alex: "could those blend in with the background"): the page runs up under
// them, so their colour follows what is there, white over a photo or anything dark, dark over a light page. Looked at
// again as screens change or scroll. Nothing outside the app.

const isPhoto = (el: Element) =>
  el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement || /url\(/.test(getComputedStyle(el).backgroundImage);

const covers = (el: Element, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  return r.top <= y && r.bottom > y && r.left <= x && r.right > x;
};

/** Is what sits under the clock dark? Down through what is drawn there, top first: a photo or video counts as dark
 *  (a banner's own picture too, which takes no taps and so is not in the stack), else the first solid colour. */
function darkUnderClock(): boolean {
  const x = window.innerWidth / 2;
  const y = 6;
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === document.documentElement || el === document.body) break;
    if (isPhoto(el)) return true;
    for (const child of Array.from(el.children)) {
      if (getComputedStyle(child).pointerEvents !== "none") continue;
      const layer = [child, ...Array.from(child.querySelectorAll("img, video"))];
      if (layer.some((p) => covers(p, x, y) && isPhoto(p) && Number(getComputedStyle(p).opacity) > 0.5)) return true;
    }
    const m = getComputedStyle(el).backgroundColor.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m && (m[4] === undefined || Number(m[4]) > 0.5)) {
      const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b < 140;
    }
  }
  return false;
}

export function NativeStatusBar() {
  useEffect(() => {
    if (nativePlatform() !== "ios") return;
    let last: boolean | null = null;
    let timer = 0;
    // At most every 150 ms, never starved by a page that changes on every frame.
    const look = () => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        const dark = darkUnderClock();
        if (dark === last) return;
        last = dark;
        // Capacitor's names: DARK is the light text for a dark background.
        callNative("StatusBar", "setStyle", { style: dark ? "DARK" : "LIGHT" }).catch(() => null);
      }, 120);
    };
    look();
    const watch = new MutationObserver(look);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
    window.addEventListener("scroll", look, { capture: true, passive: true });
    window.addEventListener("resize", look);
    return () => {
      window.clearTimeout(timer);
      watch.disconnect();
      window.removeEventListener("scroll", look, { capture: true });
      window.removeEventListener("resize", look);
    };
  }, []);
  return null;
}
