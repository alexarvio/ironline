"use client";

import { useEffect } from "react";
import { onNative } from "../lib/native";

// The on-screen keyboard, one source for the whole app (12 Nov, Alex: "the keyboard experience is not the smoothest…
// it gets in the middle of the text boxes and it lags").
//
// In the iPhone app the Keyboard plugin says the keyboard is coming (keyboardWillShow, with its height) as the
// keyboard starts to slide, and only about 0.45s later shrinks the whole web view to end at it; it also takes away the
// web view's own bringing of the focused field into view. In a phone's browser the page keeps its size and the visual
// viewport shrinks instead. Either way what matters to a screen is how much of the page as it is laid out NOW the
// keyboard covers: the plugin's height until the web view has shrunk (then ~0, the layout already ends at the
// keyboard), else what the visual viewport leaves out. That is `--kb` (px) on <html>, and `kb-open` is on <html> from
// the moment the keyboard is coming until it is going, so the tab bar, the glass and the pop-ups can step aside in the
// same frame (the end of globals.css). useKeyboardInset reads the same figure.

const TEXT =
  'input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="file"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="color"]):not([type="hidden"]), textarea, [contenteditable=""], [contenteditable="true"]';

/** A field the on-screen keyboard comes up for. */
export function isTextField(el: EventTarget | Element | null): el is HTMLElement {
  return el instanceof HTMLElement && el.matches(TEXT) && !(el as HTMLInputElement).disabled;
}

/** `pending`: the part of `covered` the layout has still to shrink by (the plugin's height in the app's gap; 0 once the
 *  web view has shrunk, and always 0 in a browser, whose layout never shrinks to the keyboard). */
type Snap = { open: boolean; covered: number; pending: number };
let snap: Snap = { open: false, covered: 0, pending: 0 };
let started = false;
const subs = new Set<() => void>();
/** The keyboard's own height as the plugin last gave it, and whether it is up (willShow to willHide). */
let pluginHeight = 0;
let pluginOpen = false;
/** The page's height with the keyboard down, at this width: the plugin's height is measured from its foot. */
let fullHeight = 0;
let fullWidth = 0;
let hiddenAt = 0;
/** When the keyboard or what it covers last changed: a scroll is smooth only once it has settled. */
let movedAt = 0;
let frame = 0;

function noteHeight() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w !== fullWidth) {
    fullWidth = w;
    fullHeight = h;
  } else if (!pluginOpen) {
    // Just after a hide the web view is still growing back: never take its short height for the full one.
    fullHeight = performance.now() - hiddenAt < 1000 ? Math.max(fullHeight, h) : h;
  }
}

function viewportCovered() {
  const vv = window.visualViewport;
  // Pinched in, the visual viewport is small for another reason (ZoomCalm); it says nothing of a keyboard then.
  if (!vv || vv.scale > 1.02) return 0;
  return Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
}

function measure(): Snap {
  noteHeight();
  const fromPlugin = pluginOpen ? Math.max(0, Math.round(pluginHeight - (fullHeight - window.innerHeight))) : 0;
  const fromViewport = viewportCovered();
  // In a browser there is no word from the keyboard itself: a text field with the focus and the visual viewport
  // shrunk well past a toolbar's height is the keyboard.
  const open = pluginOpen || (fromViewport > 80 && isTextField(document.activeElement));
  return { open, covered: Math.max(fromPlugin, fromViewport), pending: fromPlugin };
}

function write(kick = false) {
  cancelAnimationFrame(frame);
  frame = 0;
  const next = measure();
  const changed = next.open !== snap.open || next.covered !== snap.covered || next.pending !== snap.pending;
  if (changed) {
    snap = next;
    movedAt = performance.now();
    const root = document.documentElement;
    root.style.setProperty("--kb", `${next.covered}px`);
    root.classList.toggle("kb-open", next.open);
  }
  if (changed || kick) subs.forEach((f) => f());
}

/** Resizes and scrolls come in bursts: one measure a frame. */
function soon() {
  if (!frame) frame = requestAnimationFrame(() => write());
}

function heightOf(d: unknown) {
  const h = (d as { keyboardHeight?: unknown } | null)?.keyboardHeight;
  return typeof h === "number" && h > 0 ? h : 0;
}

let modeTimer = 0;
function willShow(d: unknown) {
  noteHeight();
  pluginOpen = true;
  // A second willShow (the number pad after the letters, QuickType) is a new height; the full height stays.
  pluginHeight = heightOf(d) || pluginHeight;
  write(true);
  // The app's keyboard mode (13 Nov, Alex): since then the shell no longer shrinks the web view (resize none,
  // mobile/capacitor.config.json); the screens take the keyboard's room themselves, in its first frame (the end of
  // globals.css). A build from before still shrinks it ~0.45s on. A page still its full height well after the keyboard
  // came is the new way: `kb-overlay` on <html>, and what moves with the keyboard may then ease with it.
  window.clearTimeout(modeTimer);
  modeTimer = window.setTimeout(() => {
    if (pluginOpen && pluginHeight > 0 && window.innerHeight >= fullHeight - 2) document.documentElement.classList.add("kb-overlay");
  }, 800);
}

function didShow(d: unknown) {
  if (!pluginOpen) return;
  pluginHeight = heightOf(d) || pluginHeight;
  write(true);
}

function willHide() {
  pluginOpen = false;
  pluginHeight = 0;
  hiddenAt = performance.now();
  write(true);
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  fullWidth = window.innerWidth;
  fullHeight = window.innerHeight;
  // The app's plugin, at the start of the keyboard's own slide; the same events also come to the window.
  onNative("Keyboard", "keyboardWillShow", willShow);
  onNative("Keyboard", "keyboardDidShow", didShow);
  onNative("Keyboard", "keyboardWillHide", willHide);
  onNative("Keyboard", "keyboardDidHide", () => write(true));
  window.addEventListener("keyboardWillShow", (e) => willShow(e));
  window.addEventListener("keyboardDidShow", (e) => didShow(e));
  window.addEventListener("keyboardWillHide", willHide);
  window.addEventListener("keyboardDidHide", () => write(true));
  // The web view shrinking under the plugin, and a browser's visual viewport.
  window.addEventListener("resize", soon);
  window.visualViewport?.addEventListener("resize", soon);
  window.visualViewport?.addEventListener("scroll", soon);
  document.addEventListener("focusin", soon);
  document.addEventListener("focusout", soon);
  write();
}

/** Follows the keyboard: on every change of what it covers, and on each of the plugin's events. */
export function subscribeKeyboard(onChange: () => void) {
  start();
  subs.add(onChange);
  return () => {
    subs.delete(onChange);
  };
}

/** How much of the page as laid out now the keyboard covers, in px; 0 with none. */
export function keyboardCovered() {
  return snap.covered;
}

export function keyboardOpen() {
  return snap.open;
}

/** How much the page's layout has still to shrink by for the keyboard, in px: the app's gap between the plugin's
 *  willShow and the web view shrinking to it; 0 otherwise, and always in a browser. */
export function keyboardPending() {
  return snap.pending;
}

/** Nothing has moved for a moment: the keyboard is up (or down) and the page has its size. */
export function keyboardSettled(ms = 500) {
  return performance.now() - movedAt > ms;
}

// ---- The field being typed in is always in sight (12 Nov, Alex; docs/DESIGN-RULES.md §7): above the keyboard and any
// dock, under the top bar. Only the field's own scroll box moves, and only when the field is out of that band: never
// scrollIntoView, which moves every box round it too. A box that keeps its own place (the chat's thread, which holds
// to its foot) says data-kb-own.

/** A field's block, brought in whole when it fits: its note's Cancel and Save, its row, its label. */
const BLOCK = ".fdi-panel, .wo-note, .cki-row, .cki-note-box, .st-details-row, .evs-field, .evs-note";
/** What sits over the foot of a screen, so a field must stay above it too. */
const DOCKS = ".wo-dock, .cm-compose, .app-sticky-footer, .evs-savebar";

function scrollBoxOf(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY;
    if ((o === "auto" || o === "scroll" || o === "overlay") && p.scrollHeight > p.clientHeight + 1) return p;
  }
  const doc = document.scrollingElement as HTMLElement | null;
  return doc && doc.scrollHeight > doc.clientHeight + 1 ? doc : null;
}

function blockRect(el: HTMLElement, f: DOMRect): { top: number; bottom: number } {
  // The food diary's search: the panel down to its first results, so what is found shows as it is typed.
  if (el.closest(".fdi-search")) {
    const panel = el.closest<HTMLElement>(".fdi-panel");
    if (panel) {
      const results = panel.querySelectorAll<HTMLElement>(".fdi-result");
      const last = results[Math.min(2, results.length - 1)];
      return { top: panel.getBoundingClientRect().top, bottom: Math.max(f.bottom, last ? last.getBoundingClientRect().bottom : f.bottom) };
    }
  }
  const block = el.closest<HTMLElement>(BLOCK);
  return block ? block.getBoundingClientRect() : f;
}

let satProbe: HTMLElement | null = null;
/** The top of what can be seen: under the clock in the app (--sat, the end of globals.css), and in a browser under
 *  what the visual viewport has panned past. A box whose own top is off the screen (a card taller than the room) never
 *  counts a row above it as in sight. */
function screenTop() {
  if (!satProbe?.isConnected) {
    satProbe = document.createElement("div");
    satProbe.setAttribute("aria-hidden", "true");
    satProbe.style.cssText = "position:fixed;left:0;top:0;width:0;height:var(--sat,0px);visibility:hidden;pointer-events:none";
    document.body.appendChild(satProbe);
  }
  const vv = window.visualViewport;
  const panned = vv && vv.scale <= 1.02 ? Math.max(0, vv.offsetTop) : 0;
  return Math.max(0, satProbe.offsetHeight, panned);
}

/** Brings the focused field into the band between the top bar and the keyboard (or a dock), in its own scroll box. */
export function revealField(el: HTMLElement) {
  if (el.closest("[data-kb-own]")) return;
  // What the keyboard covers as of this moment: a resize may have come in this frame, its measure not yet run.
  write();
  const box = scrollBoxOf(el);
  if (!box) return;
  const isDoc = box === document.scrollingElement;
  const b = isDoc ? { top: 0, bottom: window.innerHeight } : box.getBoundingClientRect();
  const line = window.innerHeight - keyboardCovered();
  const pending = keyboardPending();
  let floor = Math.min(b.bottom, line);
  // A dock counts where it really shows over the box: not one under a pop-up's scrim, not the field's own.
  for (const dock of Array.from(document.querySelectorAll<HTMLElement>(DOCKS))) {
    if (dock.contains(el) || !dock.offsetParent) continue;
    const r = dock.getBoundingClientRect();
    if (r.height === 0 || r.top <= b.top || r.top >= b.bottom || r.right <= 0 || r.left >= window.innerWidth) continue;
    const x = Math.min(window.innerWidth - 1, Math.max(0, (r.left + r.right) / 2));
    const y = Math.min(window.innerHeight - 1, r.top + 2);
    const hit = document.elementFromPoint(x, y);
    if (!hit || !dock.contains(hit)) continue;
    // In the app, before the web view has shrunk, a dock pinned to the foot (the workout's) is still under the
    // keyboard and comes up with the foot by what is still to shrink: the floor is where it lands, so the field is
    // placed once, not again over the dock 0.45s later. A dock already over the keyboard (lifted in a pop-up) stays.
    floor = Math.min(floor, pending > 0 && r.top >= line - 1 ? r.top - pending : r.top);
  }
  let ceiling = Math.max(b.top, screenTop());
  // The tab's own top bar floats over a bare tab's page.
  const header = el.closest(".app-layer")?.querySelector<HTMLElement>(".app-header");
  if (header) {
    const h = header.getBoundingClientRect();
    if (h.top <= b.top + 1 && h.bottom > ceiling) ceiling = h.bottom;
  }
  floor -= 12;
  ceiling += 8;
  if (floor - ceiling < 40) return;
  const f = el.getBoundingClientRect();
  const t = blockRect(el, f);
  let d = 0;
  if (t.bottom > floor) d = Math.min(t.bottom - floor, t.top - ceiling);
  else if (t.top < ceiling) d = t.top - ceiling;
  // The field itself always in, its foot (where the typing is, in a growing note) before its top.
  if (f.top - d < ceiling) d = f.top - ceiling;
  if (f.bottom - d > floor) d = f.bottom - floor;
  if (Math.abs(d) < 2) return;
  const behavior: ScrollBehavior = keyboardSettled() ? "smooth" : "auto";
  if (isDoc) window.scrollBy({ top: d, behavior });
  else box.scrollBy({ top: d, behavior });
}

/** Mounted once (AppShell, the sign-in screens): starts the keyboard source and keeps the field being typed in in sight. */
export function useKeyboardReveal(on = true) {
  useEffect(() => {
    if (!on) return;
    // The client app's fields, its pop-ups in portals too, are held at 16px on a touch screen (kb-app, the end of
    // globals.css); never the coach's side, which mounts no reveal.
    const root = document.documentElement;
    root.classList.add("kb-app");
    let raf = 0;
    let timers: number[] = [];
    const now = () => {
      raf = 0;
      const el = document.activeElement;
      if (isTextField(el)) revealField(el);
    };
    const next = () => {
      if (!raf) raf = requestAnimationFrame(now);
    };
    const focused = (e: FocusEvent) => {
      if (!isTextField(e.target)) return;
      timers.forEach((t) => window.clearTimeout(t));
      next();
      // Again as the keyboard finishes coming up and the web view has shrunk to it.
      timers = [window.setTimeout(next, 320), window.setTimeout(next, 700)];
    };
    // A note growing as it is typed stays in sight.
    const typed = (e: Event) => {
      if (e.target instanceof HTMLTextAreaElement && e.target === document.activeElement) next();
    };
    document.addEventListener("focusin", focused);
    document.addEventListener("input", typed);
    window.addEventListener("resize", next);
    const off = subscribeKeyboard(next);
    return () => {
      root.classList.remove("kb-app");
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      document.removeEventListener("focusin", focused);
      document.removeEventListener("input", typed);
      window.removeEventListener("resize", next);
      off();
    };
  }, [on]);
}
