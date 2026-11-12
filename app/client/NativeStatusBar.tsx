"use client";

import { useEffect } from "react";
import { callNative, nativePlatform } from "../lib/native";

// The iPhone app's clock and battery (11 Nov, Alex: "could those blend in with the background"): the page runs up under
// them, so their colour follows what is there, white over a photo or anything dark, dark over a light page. Looked at
// again as screens change or scroll. Nothing outside the app.
//
// It must never be left wrong (12 Nov, Alex: "sometimes they do not"):
// - The status-bar plugin puts its own colour back each time the app's screen appears again (after the camera, the photo
//   picker, a sign-in sheet); the app's shell says so with "norcoachappear" (SceneDelegate.swift), and the colour is
//   set again. An older shell without it is caught by sending the colour again every few seconds.
// - A screen sliding in or out is still moving 120 ms after it starts and no event comes when it stops: looked at again
//   once a change has settled, and on every transition's or animation's end.
// - The colour is remembered only once the phone has taken it.
// - Home's faint star is a picture drawn over the page's paper, never a photo; a light strip or the opening's paper over
//   a photo says so with data-clock="light" (the coach profile's strip, the opening).

const isPhoto = (el: Element) => {
  if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement || el instanceof HTMLCanvasElement) return true;
  const bg = getComputedStyle(el).backgroundImage;
  if (!/url\(/.test(bg)) return false;
  // A picture under a near-solid wash (Home's and the chats' star: a 95% paper gradient first) is the wash's colour.
  return washOf(bg) == null;
};

const rgbaOf = (s: string) => {
  const m = s.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[4] === undefined ? 1 : Number(m[4]) } : null;
};

/** The first layer of a background when it is a gradient of a near-solid colour: that colour, else null. */
function washOf(bg: string): { r: number; g: number; b: number } | null {
  if (!/^(linear|radial)-gradient\(/.test(bg)) return null;
  const c = rgbaOf(bg);
  return c && c.a >= 0.85 ? c : null;
}

const dim = (c: { r: number; g: number; b: number }) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b < 140;

const covers = (el: Element, x: number, y: number) => {
  const r = el.getBoundingClientRect();
  return r.top <= y && r.bottom > y && r.left <= x && r.right > x;
};

const shown = (el: Element) => {
  const cs = getComputedStyle(el);
  return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.5;
};

/** Is what sits under the clock dark? A screen's own word first (data-clock), then down through what is drawn there, top
 *  first: a photo or video counts as dark (a banner's own picture too, which takes no taps and so is not in the stack),
 *  else the first solid colour. */
function darkUnderClock(): boolean {
  const x = window.innerWidth / 2;
  const y = 6;
  for (const el of Array.from(document.querySelectorAll("[data-clock]"))) {
    if (covers(el, x, y) && shown(el)) return el.getAttribute("data-clock") === "dark";
  }
  for (const el of document.elementsFromPoint(x, y)) {
    if (el === document.documentElement || el === document.body) break;
    if (isPhoto(el)) return true;
    for (const child of Array.from(el.children)) {
      if (getComputedStyle(child).pointerEvents !== "none") continue;
      const layer = [child, ...Array.from(child.querySelectorAll("img, video"))];
      if (layer.some((p) => covers(p, x, y) && isPhoto(p) && Number(getComputedStyle(p).opacity) > 0.5)) return true;
    }
    const cs = getComputedStyle(el);
    const wash = washOf(cs.backgroundImage);
    if (wash) return dim(wash);
    const c = rgbaOf(cs.backgroundColor);
    if (c && c.a > 0.5) return dim(c);
  }
  return false;
}

export function NativeStatusBar() {
  useEffect(() => {
    if (nativePlatform() !== "ios") return;
    // What the phone has taken last; null when unknown (not yet sent, a send that failed).
    let last: boolean | null = null;
    // Bumped whenever the phone may have put its own colour back: a send already out then counts for nothing.
    let era = 0;
    let sending = false;
    let failed = false;
    let timer = 0;
    let settle = 0;
    let gone = false;
    const apply = (force = false) => {
      if (gone || sending || document.visibilityState === "hidden") return;
      const dark = darkUnderClock();
      if (!force && dark === last) return;
      sending = true;
      const sentIn = era;
      // Capacitor's names: DARK is the light text for a dark background.
      callNative("StatusBar", "setStyle", { style: dark ? "DARK" : "LIGHT" })
        .then(() => {
          failed = false;
          last = sentIn === era ? dark : null;
        })
        .catch(() => {
          // Left to the next change or the few-second resend, never retried at once in a loop.
          failed = true;
          last = null;
        })
        .finally(() => {
          sending = false;
          // Something may have changed while the send was out.
          if (!gone && !failed && darkUnderClock() !== last) look();
        });
    };
    // At most every 120 ms, never starved by a page that changes on every frame, and once more when it has settled.
    const look = () => {
      window.clearTimeout(settle);
      settle = window.setTimeout(() => apply(), 450);
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = 0;
        apply();
      }, 120);
    };
    const back = () => {
      if (document.visibilityState === "hidden") return;
      era++;
      last = null;
      look();
    };
    look();
    const watch = new MutationObserver(look);
    watch.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "hidden", "src", "data-clock"] });
    // Sent again every few seconds whatever it is, for a shell that doesn't say when it has put its own colour back.
    const again = window.setInterval(() => apply(true), 3000);
    window.addEventListener("scroll", look, { capture: true, passive: true });
    window.addEventListener("resize", look);
    document.addEventListener("transitionend", look, true);
    document.addEventListener("animationend", look, true);
    document.addEventListener("load", look, true);
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    window.addEventListener("focus", back);
    window.addEventListener("norcoachappear", back);
    return () => {
      gone = true;
      window.clearTimeout(timer);
      window.clearTimeout(settle);
      window.clearInterval(again);
      watch.disconnect();
      window.removeEventListener("scroll", look, { capture: true });
      window.removeEventListener("resize", look);
      document.removeEventListener("transitionend", look, true);
      document.removeEventListener("animationend", look, true);
      document.removeEventListener("load", look, true);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("pageshow", back);
      window.removeEventListener("focus", back);
      window.removeEventListener("norcoachappear", back);
    };
  }, []);
  return null;
}
