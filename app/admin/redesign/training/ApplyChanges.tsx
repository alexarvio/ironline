"use client";

import { Fragment, useEffect, useState } from "react";
import type React from "react";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { TRACK_ACCENT } from "../../phaseChrome";
import { dayMonth } from "../../../lib/dayMonth";
import { addDays } from "../phases/timeline";
import { Sep, SepJoin } from "../Sep";
import { inUnit, type ApplyFig, type ApplyPreview, type ApplySession } from "./applyShape";

// The confirm of Apply to the rest and of a session's Apply to remaining weeks (23 Oct, Alex: "naming nicely and
// structured the changes that we are applying"): the title and the weeks' fact as before, then exactly what changes
// in the later weeks (applyPreview.ts reads it as the action would do it). By session, a row an exercise or cardio
// that changes: each figure that changes, the old struck through in grey, the new in training purple, a bar between
// figures, no arrows; Added in green, Removed struck; New order on the session. Weeks that would change differently
// are grouped under the weeks they reach, dated d/m (19/10 → 1/11). The list scrolls inside; the foot stays.
// A weight is read in the coach's unit (inUnit, applyShape.ts), as the page's read counts it to offer the apply at all.

/** The faint arrow between two dates (design rules 8), as the Events log's. */
function RangeArrow() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** "Week 8", "Weeks 8–9", "Weeks 8 and 10", "Weeks 2, 4 and 6". */
const weeksWords = (ws: number[]) => {
  if (ws.length === 1) return `Week ${ws[0]}`;
  if (ws.every((w, i) => i === 0 || w === ws[i - 1] + 1)) return `Weeks ${ws[0]}–${ws[ws.length - 1]}`;
  return `Weeks ${ws.slice(0, -1).join(", ")} and ${ws[ws.length - 1]}`;
};

export default function ApplyChangesDialog({ title, description, confirm, load, startDate, lbs, onConfirm }: {
  title: string;
  description: string;
  confirm: string;
  /** Saves what is waiting, then reads what the copy would change. */
  load: () => Promise<ApplyPreview | null>;
  /** The programme's first Monday, for the weeks' dates. */
  startDate: string | null;
  lbs: boolean;
  /** Given what the pop-up read (undefined while it reads, null if it couldn't), so the apply reaches the weeks it lists. */
  onConfirm: (read: ApplyPreview | null | undefined) => void;
}) {
  const [preview, setPreview] = useState<ApplyPreview | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    load()
      .then((p) => alive && setPreview(p))
      .catch(() => alive && setPreview(null));
    return () => {
      alive = false;
    };
    // Read once, as the pop-up opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weeks that change alike go together, in the order they come.
  const groups: { key: string; weeks: number[]; sessions: ApplySession[] }[] = [];
  for (const w of preview?.weeks ?? []) {
    const sessions = w.sessions.map((s) => inUnit(s, lbs)).filter((s): s is ApplySession => s != null);
    if (!sessions.length) continue;
    const key = JSON.stringify(sessions);
    const g = groups.find((x) => x.key === key);
    if (g) g.weeks.push(w.index);
    else groups.push({ key, weeks: [w.index], sessions });
  }
  // Headed by their weeks when they differ, or when some weeks the fact names change nothing.
  const headed = groups.length > 1 || (groups.length === 1 && groups[0].weeks.length < (preview?.weeks.length ?? 0));
  const datesOf = (ws: number[]): React.ReactNode => {
    if (!startDate) return null;
    const monday = (i: number) => addDays(startDate, (i - 1) * 7);
    const run = ws.every((w, i) => i === 0 || w === ws[i - 1] + 1);
    if (!run) return ws.map((w) => dayMonth(monday(w))).join(", ");
    return (
      <>
        {dayMonth(monday(ws[0]))}
        <i>
          <RangeArrow />
        </i>
        {dayMonth(addDays(monday(ws[ws.length - 1]), 6))}
      </>
    );
  };
  const unit = lbs ? "lbs" : "kg";

  return (
    <DialogContent className="dlh apx" style={{ "--apx-c": TRACK_ACCENT.training } as React.CSSProperties}>
      <div className="dlh-head">
        <DialogTitle className="dlh-title">{title}</DialogTitle>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      {/* The changes alone on screen (23 Oct, Alex: "I do not need this explanation here"); the words stay for a screen reader. */}
      <DialogDescription className="sr-only">{description}</DialogDescription>
      {preview !== undefined && (
        <div className="apx-list" aria-label="What changes">
          {groups.length === 0 ? (
            <p className="apx-none">{preview ? "No changes" : "Couldn't read the weeks"}</p>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="apx-group">
                {headed && (
                  <h3 className="apx-weeks">
                    <span>{weeksWords(g.weeks)}</span>
                    {datesOf(g.weeks) && (
                      <>
                        <Sep />
                        <small>{datesOf(g.weeks)}</small>
                      </>
                    )}
                  </h3>
                )}
                {g.sessions.map((s, i) => (
                  <SessionChanges key={i} s={s} unit={unit} />
                ))}
              </section>
            ))
          )}
        </div>
      )}
      <div className="dlh-foot">
        <DialogClose className="dlh-cancel">Cancel</DialogClose>
        <button type="button" className="dlh-go" onClick={() => onConfirm(preview)} autoFocus>
          {confirm}
        </button>
      </div>
    </DialogContent>
  );
}

function SessionChanges({ s, unit }: { s: ApplySession; unit: string }) {
  return (
    <div className="apx-session">
      <div className="apx-shead">
        <b>{s.name}</b>
        {s.added && (
          <>
            <em className="apx-added">Added</em>
            {(s.added.exercises > 0 || s.added.cardio > 0) && (
              <small>
                <SepJoin parts={[s.added.exercises > 0 && `${s.added.exercises} ${s.added.exercises === 1 ? "exercise" : "exercises"}`, s.added.cardio > 0 && `${s.added.cardio} cardio`]} />
              </small>
            )}
          </>
        )}
        {s.reorder && <small>New order</small>}
        {s.goes && <small className="apx-goes">{s.goes.sets > 0 ? `${s.goes.sets} logged ${s.goes.sets === 1 ? "set goes" : "sets go"}` : "Ticked cardio goes"}</small>}
      </div>
      {s.was && (
        <div className="apx-item">
          <span className="apx-name faint">Name</span>
          <span className="apx-figs">
            <Fig f={{ label: "", from: s.was, to: s.name }} unit={unit} />
          </span>
        </div>
      )}
      {s.items.map((it, i) => (
        <div key={i} className={`apx-item ${it.change}`}>
          <span className="apx-name" title={it.name}>
            {it.change === "removed" ? <s>{it.name}</s> : it.name}
          </span>
          <span className="apx-figs">
            {it.change === "added" ? (
              <em className="apx-added">Added</em>
            ) : it.change === "removed" ? (
              <em className="apx-removed">Removed</em>
            ) : (
              it.figs.map((f, j) => (
                <Fragment key={j}>
                  {j > 0 && <Sep />}
                  <Fig f={f} unit={unit} />
                </Fragment>
              ))
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A figure that changes: its label, the old struck through, the new in purple (a weight already in the unit, inUnit). A value that goes reads None. */
function Fig({ f, unit }: { f: ApplyFig; unit: string }) {
  const shown = (v: string | null) => {
    if (v == null) return f.kg ? "—" : "None";
    return f.words ? `“${v}”` : v;
  };
  const label = f.kg ? (f.gym ? `${unit} at ${f.gym}` : unit) : f.label;
  return (
    <span className={`apx-fig${f.words ? " words" : ""}`}>
      {label && <span className="apx-lab">{label}</span>}
      {f.from != null && (
        <s className="apx-was" aria-label={`was ${shown(f.from)}`}>
          {shown(f.from)}
        </s>
      )}
      <span className="apx-now">{shown(f.to)}</span>
    </span>
  );
}
