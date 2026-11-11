"use client";

import type { HomeFocus } from "../../lib/focus";
import "./focus.css";

// To focus on (23 Oct, Alex): the coach's goals until the next call. Since 3 Nov (Alex: B of
// docs/boards/home-focus-mockup.html) no pill and no fold: always open, under the coach's latest note on Home, so the
// coach's words are in one place. A small-caps `To focus on` with the list mark, then each goal a small ink ring on a
// thin line down the left, its words at 16px/500. Nothing to tick. Since 11 Nov (Alex: "too much like bullet points, no
// effort put in behind it"; D of docs/boards/focus-goals-ways-mockup.html) each goal is set beside a light numeral in the
// call's blue, as the date column on Events is set, the words at 17px/600.

export function FocusGoals({ focus }: { focus: HomeFocus }) {
  if (focus.goals.length === 0) return null;
  return (
    <section className="hm-focus open-list" aria-label="To focus on" id="home-focus">
      <div className="hm-focus-head">
        <svg className="hm-focus-mark" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
        </svg>
        To focus on
      </div>
      <ol className="hm-focus-list">
        {focus.goals.map((g, i) => (
          <li key={g.id} className="hm-focus-goal">
            <span className="hm-focus-num" aria-hidden="true">
              {i + 1}
            </span>
            <span className="hm-focus-text">{g.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
