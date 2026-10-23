"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Fold } from "../Fold";
import { SETTINGS } from "../settingsNav";
import { SaveHost, useUnsaved } from "./SaveHost";
import { onGoToSetting, sayOpen } from "./settingsScroll";

// The Settings page (23 Oct, Alex: "we need structure… chevrons that i can press… all defaulted to collapsed, only one
// open"): Training's bare header, then the sections one under another, each its title (20px/600) with the Fold right
// after it, the whole row its button. All folded at first; opening one folds the one open, a click on the open one
// folds it. The height eases open and shut (grid rows 0fr → 1fr) and the clicked title stays under the pointer while
// the one above it folds (the page is scrolled along, frame by frame). A section is its key as an id: #invoicing on
// arrival opens it, the rail's rows open theirs (settingsScroll.ts), and the address follows what is open. A folded
// section keeps what was typed in it, the page's one bar counting it (SaveHost), and an ink dot on its title says so.

export type SettingsSection = {
  /** Its id and the address's #key; the rail's row when SETTINGS has one. */
  key: string;
  /** Its title; the rail's label when left out. */
  label?: string;
  /** A state tag after the chevron (Profile: Published). */
  tag?: ReactNode;
  /** Its content; none (null) leaves the section out, as Support for the owner. */
  body: ReactNode;
};

const EASE_MS = 220;
/** Where a section brought into view puts its title, from the window's top. */
const TOP = 24;

type Anchor = { key: string; mode: "hold" | "top"; top: number };

const stillWanted = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** The address with this section open, the rest of it as it is (?coachId), less ?stripe: back from Stripe is said once,
 *  so a save drawing the page again doesn't ask Stripe again (page.tsx). */
function follow(key: string | null) {
  const want = key ? `#${key}` : "";
  const q = new URLSearchParams(window.location.search);
  const back = q.has("stripe");
  q.delete("stripe");
  if (window.location.hash === want && !back) return;
  const search = q.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}${want}`);
}

export default function SettingsBoard({ className, sections }: { className: string; sections: SettingsSection[] }) {
  return (
    <SaveHost className={className}>
      {/* Training's header, bare: no fact line, so no room kept for one. */}
      <header className="trn-head bare">
        <div className="trn-head-main">
          <div className="trn-name-row">
            <h1 className="trn-name">Settings</h1>
          </div>
        </div>
      </header>
      <Sections sections={sections.filter((s) => s.body != null && s.body !== false)} />
    </SaveHost>
  );
}

function Sections({ sections }: { sections: SettingsSection[] }) {
  const [open, setOpen] = useState<string | null>(null);
  // Opened on arrival (#business): drawn open at once, no easing.
  const [still, setStill] = useState(false);
  // The open one, once it has eased open: nothing clipped (the profile's phone stays in view as the page scrolls).
  const [settled, setSettled] = useState<string | null>(null);
  // A new go to the same section brings it into view again.
  const [goes, setGoes] = useState(0);
  const unsaved = useUnsaved();
  const titles = useRef(new Map<string, HTMLElement>());
  const anchor = useRef<Anchor | null>(null);
  const keys = useRef<string[]>([]);
  const openNow = useRef<string | null>(null);
  useEffect(() => {
    keys.current = sections.map((s) => s.key);
    openNow.current = open;
  });

  // Unclipped only once eased open: a section opened again (or anew) is clipped from its first frame, so it never
  // draws over the titles under it while its height grows.
  const toggle = (key: string) => {
    const el = titles.current.get(key);
    anchor.current = el ? { key, mode: "hold", top: el.getBoundingClientRect().top } : null;
    const next = open === key ? null : key;
    setStill(false);
    setSettled(null);
    setOpen(next);
    follow(next);
  };

  // From the rail, a link on the page or the address: open it, fold the one open, bring it into view.
  const go = useRef((key: string, onArrival = false) => {
    if (!keys.current.includes(key)) return;
    anchor.current = { key, mode: "top", top: TOP };
    // Focus in the section that folds (Set your country) would drop to the page: it goes to the title opened.
    const at = document.activeElement;
    const from = at instanceof Element ? at.closest(".rst-body") : null;
    if (from && from.id !== `rst-${key}-body`) document.getElementById(`rst-${key}-title`)?.focus({ preventScroll: true });
    // The one open already stays as it is (nothing would settle it again).
    if (openNow.current !== key) setSettled(null);
    setStill(onArrival);
    setOpen(key);
    setGoes((n) => n + 1);
    follow(key);
  });

  useEffect(() => {
    const fromHash = () => window.location.hash.slice(1);
    const first = fromHash();
    const frame = first ? window.requestAnimationFrame(() => go.current(first, true)) : 0;
    const onHash = () => {
      const k = fromHash();
      if (k) go.current(k);
    };
    window.addEventListener("hashchange", onHash);
    const off = onGoToSetting((k) => go.current(k));
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", onHash);
      off();
    };
  }, []);

  // The rail marks the open one.
  useEffect(() => {
    sayOpen(open);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => setSettled(open), still || stillWanted() ? 0 : EASE_MS + 30);
    return () => window.clearTimeout(t);
  }, [open, still]);

  // The page never jumps under the pointer: while the heights ease, the clicked title is held where it was (a click)
  // or glided to the top (a go). Read and set before each paint, so it never shows out of place.
  useLayoutEffect(() => {
    const a = anchor.current;
    anchor.current = null;
    const el = a && titles.current.get(a.key);
    if (!a || !el) return;
    const instant = still || stillWanted();
    let frame = 0;
    let began = 0;
    let quit = false;
    const stop = () => {
      quit = true;
    };
    // The title back where it belongs (held: all of the way; a go: a part of the way each frame). True once there.
    const nudge = () => {
      const off = el.getBoundingClientRect().top - a.top;
      if (Math.abs(off) < 1) return true;
      window.scrollBy(0, a.mode === "hold" || instant || Math.abs(off) < 3 ? off : off * 0.22);
      return false;
    };
    const step = (t: number) => {
      if (quit) return;
      began ||= t;
      const there = nudge();
      const elapsed = t - began;
      if ((!instant && elapsed < EASE_MS + 60) || (a.mode === "top" && !there && elapsed < 900)) frame = window.requestAnimationFrame(step);
    };
    if (!nudge() || !instant) frame = window.requestAnimationFrame(step);
    // A go glides; a wheel, a touch or a key takes the page back.
    const takeBack = a.mode === "top" && !instant;
    if (takeBack) {
      window.addEventListener("wheel", stop, { passive: true });
      window.addEventListener("touchstart", stop, { passive: true });
      window.addEventListener("keydown", stop);
    }
    return () => {
      window.cancelAnimationFrame(frame);
      if (takeBack) {
        window.removeEventListener("wheel", stop);
        window.removeEventListener("touchstart", stop);
        window.removeEventListener("keydown", stop);
      }
    };
  }, [open, goes, still]);

  return (
    <div className={`rst-secs${still ? " still" : ""}`}>
      {sections.map((s) => {
        const isOpen = open === s.key;
        const label = s.label ?? SETTINGS.find((x) => x.key === s.key)?.label ?? s.key;
        const held = unsaved.some((k) => k.split(":")[0] === s.key);
        return (
          <section key={s.key} id={s.key} className={`rst-sec${isOpen ? " open" : ""}${isOpen && settled === s.key ? " settled" : ""}`} aria-labelledby={`rst-${s.key}-title`}>
            <h2
              className="rst-sechead"
              ref={(el) => {
                if (el) titles.current.set(s.key, el);
                else titles.current.delete(s.key);
              }}
            >
              <button type="button" id={`rst-${s.key}-title`} className="rst-sectoggle" aria-expanded={isOpen} aria-controls={`rst-${s.key}-body`} onClick={() => toggle(s.key)}>
                <span className="rst-sectitle">
                  {label}
                  {held && <span className="rd-due rst-unsaved" role="img" aria-label="Not saved" title="Not saved" />}
                </span>
                <Fold open={isOpen} />
                {s.tag}
              </button>
            </h2>
            <div className="rst-body" id={`rst-${s.key}-body`} inert={!isOpen}>
              <div className="rst-inner">
                <div className="rst-content">{s.body}</div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}
