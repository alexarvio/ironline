"use client";

import { useEffect, useState } from "react";
import type { HomeFocus } from "../../lib/focus";
import { ChevronDownIcon } from "../../components/icons";
import { pic } from "../../lib/pic";
import "./focus.css";

// To focus on (23 Oct, Alex): the coach's goals until the next call, the first thing on Home under the greeting.
// Since 27 Oct (Alex: "just a little pill with a title"; mocked first) a pill that opens a list, as Nutrition's
// Supplements: the white hairline pill says "To focus on" with the list mark in ink (27 Oct, Alex: the blue meant
// nothing here once the call went), the coach's face and how many; a tap drops the goals out under it, flat on the page, each a small ink ring
// on a thin line down the left from the pill's mark. Still bullet points: nothing to tick. No call at the end (27 Oct,
// Alex: the next meeting is on Home already) and no "until" line. New goals arrive open once; after that the pill
// stays as the client left it (kept on the phone).

const KEY = "norcoach.focus";

export default function FocusList({ focus, coach }: { focus: HomeFocus; coach: { firstName: string; photoPath: string | null }; today?: string }) {
  const initial = (coach.firstName || "C").trim().charAt(0).toUpperCase();
  const goals = focus.goals;
  // What the goals are, to tell a new list from the one already seen.
  const stamp = goals.map((g) => `${g.id}:${g.text}`).join("|");
  const [open, setOpen] = useState(false);
  // The open look (the pill as the header, the list flat under it) stays on while the list folds away.
  const [dressed, setDressed] = useState(false);
  // Drawn as it was left before anything eases: only a tap animates (27 Oct, Alex: it opened on every load, jumpy).
  const [still, setStill] = useState(true);

  // After mount (the server render has no storage): a list not seen yet opens; else as it was left.
  useEffect(() => {
    const t = setTimeout(() => {
      let was: { stamp?: string; open?: boolean } = {};
      try {
        was = JSON.parse(window.localStorage.getItem(KEY) ?? "{}");
      } catch {}
      const next = was.stamp !== stamp ? true : !!was.open;
      setOpen(next);
      setDressed(next);
      try {
        window.localStorage.setItem(KEY, JSON.stringify({ stamp, open: next }));
      } catch {}
      // Two frames on, once that state is painted, taps ease again.
      requestAnimationFrame(() => requestAnimationFrame(() => setStill(false)));
    }, 0);
    return () => clearTimeout(t);
  }, [stamp]);

  const flip = () => {
    const next = !open;
    if (next) setDressed(true);
    else if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) setDressed(false);
    setOpen(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ stamp, open: next }));
    } catch {}
  };

  if (goals.length === 0) return null;
  return (
    <section className={`hm-focus${dressed ? " dressed" : ""}`} aria-label="To focus on">
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
        className={`hm-focus-fold${open ? " open" : ""}${still ? " still" : ""}`}
        aria-hidden={!open}
        inert={!open}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !open) setDressed(false);
        }}
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
