"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type { HomeFocus } from "../../lib/focus";
import { FOCUS_COOKIE, focusStamp } from "../../lib/focusStamp";
import { ChevronDownIcon } from "../../components/icons";
import { pic } from "../../lib/pic";
import "./focus.css";

// To focus on (23 Oct, Alex): the coach's goals until the next call, the first thing on Home under the greeting.
// Since 27 Oct (Alex: "just a little pill with a title"; mocked first) a pill that opens a list, as Nutrition's
// Supplements: the white hairline pill says "To focus on" with the list mark in ink (27 Oct, Alex: the blue meant
// nothing here once the call went), the coach's face and how many; a tap drops the goals out under it, flat on the page, each a small ink ring
// on a thin line down the left from the pill's mark. Still bullet points: nothing to tick. No call at the end (27 Oct,
// Alex: the next meeting is on Home already) and no "until" line. New goals arrive open once; after that the pill
// stays as the client left it (kept in a cookie, so the page is drawn that way: focusStamp.ts).

export default function FocusList({ focus, coach, initialOpen = true }: { focus: HomeFocus; coach: { firstName: string; photoPath: string | null }; today?: string; /** As the client left it, from the cookie the page reads (focusStamp.ts); new goals open. */ initialOpen?: boolean }) {
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  const goals = focus.goals;
  const stamp = focusStamp(goals);
  // Drawn as it was left from the first frame (27 Oct, Alex: it snapped open after loading): the page reads the
  // cookie, so nothing moves on load and only a tap eases.
  const [open, setOpen] = useState(initialOpen);
  // The open look stays on while the list folds away.
  const [dressed, setDressed] = useState(initialOpen);
  const remember = (next: boolean) => {
    document.cookie = `${FOCUS_COOKIE}=${stamp}:${next ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  };
  // Seen: these goals stay as they are now on the next visit (new ones arrive open once).
  useEffect(() => {
    document.cookie = `${FOCUS_COOKIE}=${stamp}:${initialOpen ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
  }, [stamp, initialOpen]);

  // Opening and folding move what is under the list by a transform alone (27 Oct, Alex: "still quite laggy"): the list
  // takes its room at once and everything below it slides from where it was, on the phone's graphics chip. Easing the
  // list's height made the phone lay out and repaint the photo cards and their glass every frame.
  const ref = useRef<HTMLElement>(null);
  const flip = () => {
    const next = !open;
    const sec = ref.current;
    const still = !sec || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const before = sec?.getBoundingClientRect().height ?? 0;
    flushSync(() => {
      setOpen(next);
      setDressed(next);
    });
    remember(next);
    if (still || !sec) return;
    const shift = before - sec.getBoundingClientRect().height;
    if (!shift) return;
    const below: HTMLElement[] = [];
    for (let n = sec.nextElementSibling; n; n = n.nextElementSibling) if (n instanceof HTMLElement) below.push(n);
    for (const n of below) {
      n.style.transition = "none";
      // translate, not transform: a card that has a transform of its own keeps it.
      n.style.translate = `0 ${shift}px`;
      n.style.willChange = "translate";
    }
    // Read once so the start is drawn, then let go: it eases back to its own place (no frame callback to wait on).
    void sec.offsetHeight;
    for (const n of below) {
      n.style.transition = "translate 0.34s cubic-bezier(0.22, 1, 0.36, 1)";
      n.style.translate = "";
    }
    setTimeout(() => {
      for (const n of below) {
        n.style.transition = "";
        n.style.willChange = "";
      }
    }, 400);
  };

  if (goals.length === 0) return null;
  return (
    <section ref={ref} className={`hm-focus${dressed ? " dressed" : ""}`} aria-label="To focus on">
      <button type="button" className="hm-focus-pill" aria-expanded={open} onClick={flip}>
        <svg className="hm-focus-mark" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </svg>
        <span className="hm-focus-title">To focus on</span>
        <span className="hm-focus-face" aria-hidden="true">
          {coach.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route
            <img src={pic(coach.photoPath, 96)} alt="" />
          ) : (
            initial
          )}
        </span>
        <span className="hm-focus-count" aria-label={`${goals.length} from ${coach.firstName}`}>
          {goals.length}
        </span>
        <span className="hm-focus-chev" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div
        className={`hm-focus-fold${open ? " open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <ol className="hm-focus-list">
          {goals.map((g) => (
            <li key={g.id} className="hm-focus-goal">
              {/* Drawn, not a box's edge: a 1.6px edge on a 9px box came out fatter on one side (25 Oct, Alex). */}
              <svg className="hm-focus-node" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
                <circle cx="5.5" cy="5.5" r="4.2" />
              </svg>
              <span className="hm-focus-text">{g.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
