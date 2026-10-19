"use client";

import { useState } from "react";
import type React from "react";
import { ChevronDownIcon, CompassIcon } from "../../../components/icons";
import type { DraftRogue } from "./TrainingDraft";

// The client's rogue sessions under the week's own (19 Oct, Alex): workouts
// they made themselves, off the plan. Built from the session card's own parts
// on the week's own column grid, so Sets, KG and Reps sit exactly under the
// planned sessions' (19 Oct, Alex: "as if they were part of the regular
// workout"); the columns a rogue session has nothing for stay empty. The
// compass takes the grip's place. Read only, and counted in nothing.

type Cols = { sets: boolean; weight: boolean; reps: boolean; rpe: boolean; tempo: boolean; rest: boolean };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const num = (n: number | null) => (n == null ? "–" : String(Math.round(n * 100) / 100));
/** "60" when every set is the same, else each in turn: "60 · 65 · 70". */
const each = (xs: (number | null)[]) => (xs.length === 0 ? "–" : xs.every((x) => x === xs[0]) ? num(xs[0]) : xs.map(num).join(" · "));
/** The figure columns the week shows, in their order, as the planned sessions draw them. */
const FIGURES: (keyof Cols)[] = ["sets", "weight", "reps", "rpe", "tempo", "rest"];
/** After the figures: note, what the client did, 7 days, 30 days, ⋯. */
const TAIL = 5;

export default function RogueSessions({ items, firstName, grid, cols, unit, minW, kgOf }: { items: DraftRogue[]; firstName: string; grid: React.CSSProperties; cols: Cols; unit: string; minW: number; /** Kg into what the coach is reading in. */ kgOf: (kg: number | null) => number | null }) {
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return null;
  const shown = FIGURES.filter((k) => cols[k]);
  const label: Record<keyof Cols, string> = { sets: "Sets", weight: unit, reps: "Reps", rpe: "RPE", tempo: "Tempo", rest: "Rest" };
  return (
    <div className="rg">
      {/* The compass by the heading (19 Oct, Alex), and no line explaining it. */}
      <div className="rg-head">
        <CompassIcon size={15} />
        <span className="rg-eyebrow">Rogue sessions</span>
      </div>
      {items.map((r) => {
        const isOpen = open === r.id;
        const count = r.exercises.length + r.cardio.length;
        return (
          <section key={r.id} className={`rd-session rg-session${isOpen ? " open" : ""}`}>
            <div className="rd-session-head" onClick={() => setOpen(isOpen ? null : r.id)}>
              {/* The grip's room kept empty, so the name and count line up with the week's sessions. */}
              <span className="rd-grip rg-compass" aria-hidden="true" />
              <button type="button" className="rd-session-toggle" onClick={(e) => (e.stopPropagation(), setOpen(isOpen ? null : r.id))} aria-expanded={isOpen} aria-label={isOpen ? "Fold rogue session" : "Open rogue session"}>
                <span className={`rd-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                  <ChevronDownIcon />
                </span>
              </button>
              <span className="rd-session-namecol">
                <span className="rg-name">Rogue session</span>
              </span>
              <span className="rd-session-count">
                {count} {count === 1 ? "exercise" : "exercises"}
              </span>
              <span className="rd-session-tags">
                {r.started && <span className="rd-pill quiet">{day(r.started)}</span>}
                {r.duration != null && <span className="rd-pill quiet">{r.duration} min</span>}
                <span className={`rd-pill${r.ended ? " good" : ""}`}>{r.ended ? "Completed" : "In progress"}</span>
              </span>
            </div>
            {isOpen && (
              <div className="rd-rows rd-rows-scroll" style={{ "--rd-minw": `${minW}px` } as React.CSSProperties}>
                <div className="rd-cols" aria-hidden="true" style={grid}>
                  <span />
                  <span>Exercise</span>
                  {shown.map((k) => (
                    <span key={k}>{label[k]}</span>
                  ))}
                  {Array.from({ length: TAIL }, (_, i) => (
                    <span key={`t${i}`} />
                  ))}
                </div>
                {r.exercises.map((e) => (
                  <div key={e.id} className="rd-row">
                    <div className="rd-row-main static" style={grid}>
                      <span />
                      <span className="rd-ex">{e.name}</span>
                      {shown.map((k) => (
                        <span key={k} className="rg-fig">
                          {k === "sets" ? e.sets.length || "–" : k === "weight" ? each(e.sets.map((s) => kgOf(s.kg))) : k === "reps" ? each(e.sets.map((s) => s.reps)) : ""}
                        </span>
                      ))}
                      {Array.from({ length: TAIL }, (_, i) => (
                        <span key={`t${i}`} />
                      ))}
                    </div>
                  </div>
                ))}
                {r.cardio.map((c) => {
                  const bits = [c.time && `${c.time} min`, c.distance && `${c.distance} km`, c.pace && `${c.pace} km/h`, c.incline && `${c.incline}% incline`].filter(Boolean).join(" · ");
                  return (
                    <div key={`c${c.id}`} className="rd-row cardio">
                      <div className="rd-row-main static" style={grid}>
                        <span />
                        <span className="rd-ex">
                          {c.name} <small className="rg-tag">Cardio</small>
                        </span>
                        <span className="rg-fig rg-span" style={{ gridColumn: `3 / span ${Math.max(1, shown.length)}` }}>
                          {bits || (c.done ? "Done" : "Not logged")}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {r.note && <p className="rd-session-note">{firstName} wrote: &ldquo;{r.note}&rdquo;</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
