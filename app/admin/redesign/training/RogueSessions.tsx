"use client";

import { useState } from "react";
import type { DraftRogue } from "./TrainingDraft";

// The client's rogue sessions under the week's own (19 Oct, Alex): workouts
// they made themselves, off the plan. Read only: the coach sees when, how
// long, and every set and cardio logged; nothing here counts towards the
// week, and there is nothing to edit.

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const kg = (n: number | null) => (n == null ? "–" : `${Math.round(n * 100) / 100}`);

export default function RogueSessions({ items, firstName }: { items: DraftRogue[]; firstName: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (items.length === 0) return null;
  return (
    <div className="rg">
      <div className="rg-head">
        <span className="rg-eyebrow">Rogue sessions</span>
        <span className="rg-sub">{firstName}&rsquo;s own, off the plan · not counted in the week</span>
      </div>
      {items.map((r) => {
        const isOpen = open === r.id;
        const sets = r.exercises.reduce((t, e) => t + e.sets.length, 0);
        const what = [r.exercises.length ? `${r.exercises.length} exercise${r.exercises.length === 1 ? "" : "s"}` : null, sets ? `${sets} set${sets === 1 ? "" : "s"}` : null, r.cardio.length ? `${r.cardio.length} cardio` : null].filter(Boolean).join(" · ");
        return (
          <section key={r.id} className={`rg-card${isOpen ? " open" : ""}`}>
            <button type="button" className="rg-row" onClick={() => setOpen(isOpen ? null : r.id)} aria-expanded={isOpen}>
              <span className="rg-ring" aria-hidden="true" />
              <span className="rg-main">
                <b>Rogue session</b>
                <small>{what || "Nothing logged"}</small>
              </span>
              <span className="rg-when">{r.started ? day(r.started) : ""}</span>
              {r.duration != null && <span className="rg-when">{r.duration} min</span>}
              <span className={`rg-state${r.ended ? "" : " live"}`}>{r.ended ? "Completed" : "In progress"}</span>
              <span className={`rg-chev${isOpen ? " open" : ""}`} aria-hidden="true" />
            </button>
            {isOpen && (
              <div className="rg-body">
                {r.exercises.map((e) => (
                  <div key={e.id} className="rg-line">
                    <span className="rg-name">{e.name}</span>
                    <span className="rg-sets">
                      {e.sets.length === 0 ? (
                        <em>Not logged</em>
                      ) : (
                        e.sets.map((s) => (
                          <span key={s.n}>
                            {kg(s.kg)} kg × {s.reps ?? "–"}
                          </span>
                        ))
                      )}
                    </span>
                  </div>
                ))}
                {r.cardio.map((c) => {
                  const bits = [c.time && `${c.time} min`, c.distance && `${c.distance} km`, c.pace && `${c.pace} km/h`, c.incline && `${c.incline}% incline`].filter(Boolean);
                  return (
                    <div key={`c${c.id}`} className="rg-line">
                      <span className="rg-name">
                        {c.name} <small className="rg-tag">Cardio</small>
                      </span>
                      <span className="rg-sets">{bits.length ? bits.map((b) => <span key={String(b)}>{b}</span>) : <em>{c.done ? "Done" : "Not logged"}</em>}</span>
                    </div>
                  );
                })}
                {r.note && <p className="rg-note">&ldquo;{r.note}&rdquo;</p>}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
