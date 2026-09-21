"use client";

import { useState } from "react";
import type { LoggedDay, LoggedDaysView } from "../lib/queries";
import { CameraIcon, ChevronDownIcon } from "../components/icons";

// What the client actually ate, day by day, inside the phase on screen.
// Read-only: the log is the client's, and a coach quietly editing it would
// leave them looking at figures they never typed.
//
// Every total here is reduced from the day's own foods, so opening a day can
// never disprove the line that was closed.

const n = (v: number) => Math.round(v).toLocaleString("en-US");
const ON_TARGET = 200;
const fmtDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });

export default function NutritionLoggedDays({ view, shown = 6 }: { view: LoggedDaysView; shown?: number }) {
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  // The client's picture of one meal, opened from the camera on its row.
  const [shot, setShot] = useState<{ src: string; label: string; date: string } | null>(null);
  const days = all ? view.days : view.days.slice(0, shown);
  const proteinTarget = view.days.find((d) => d.proteinTarget != null)?.proteinTarget ?? null;
  const proteinShort = proteinTarget != null && view.avgProtein != null && view.avgProtein < proteinTarget - 20;

  const stats: { label: string; value: string; unit: string; warn?: boolean }[] = [
    { label: "Days logged", value: String(view.days.length), unit: `of ${view.windowDays} in this phase`, warn: view.days.length < view.windowDays * 0.6 },
    { label: "Average intake", value: view.avgKcal != null ? n(view.avgKcal) : "–", unit: "kcal a day" },
    {
      label: "On target",
      value: view.judged ? `${view.onTarget} of ${view.judged}` : "–",
      unit: `within ±${ON_TARGET} kcal`,
      warn: view.judged > 0 && view.onTarget < view.judged / 2,
    },
    { label: "Average protein", value: view.avgProtein != null ? String(view.avgProtein) : "–", unit: proteinTarget ? `g a day · target ${proteinTarget}` : "g a day", warn: proteinShort },
  ];

  return (
    <>
      <div className="nl-stats">
        {stats.map((s) => (
          <div key={s.label} className="nl-stat">
            <span className="nl-stat-label">{s.label}</span>
            <span className={`nl-stat-value${s.warn ? " warn" : ""}`}>{s.value}</span>
            <span className="nl-stat-unit">{s.unit}</span>
          </div>
        ))}
      </div>

      {view.days.length === 0 ? (
        <p className="nl-empty">Nothing logged in this phase yet.</p>
      ) : (
        <>
          <div className="nl-head nl-cols">
            <span aria-hidden="true" />
            <span>Date</span>
            <span>Logged</span>
            <span>Day</span>
            <span>Vs target</span>
            <span>Protein · carbs · fat</span>
          </div>
          {days.map((d) => (
            <DayRow key={d.date} day={d} open={open === d.date} onToggle={() => setOpen((x) => (x === d.date ? null : d.date))} onShot={setShot} />
          ))}
          {shot && (
            <div className="nl-shot-scrim" role="presentation" onClick={() => setShot(null)}>
              <div className="nl-shot" role="dialog" aria-modal="true" aria-label={`${shot.label}, ${fmtDay(shot.date)}`} onClick={(e) => e.stopPropagation()}>
                <div className="nl-shot-head">
                  <span>
                    {shot.label} · {fmtDay(shot.date)}
                  </span>
                  <button type="button" className="nl-shot-x" onClick={() => setShot(null)} aria-label="Close">
                    ×
                  </button>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
                <img src={shot.src} alt={`${shot.label} on ${fmtDay(shot.date)}`} />
              </div>
            </div>
          )}
          <div className="nl-foot">
            <span>
              Showing {days.length} of {view.days.length} logged {view.days.length === 1 ? "day" : "days"} in this phase
            </span>
            {view.days.length > shown && (
              <button type="button" className="nl-more" onClick={() => setAll((v) => !v)}>
                {all ? "Show fewer" : `Show all ${view.days.length} →`}
              </button>
            )}
          </div>
        </>
      )}
    </>
  );
}

function DayRow({ day, open, onToggle, onShot }: { day: LoggedDay; open: boolean; onToggle: () => void; onShot: (s: { src: string; label: string; date: string }) => void }) {
  const diff = day.target != null ? day.kcal - day.target : null;
  const onTarget = diff != null && Math.abs(diff) <= ON_TARGET;
  const total = day.protein * 4 + day.carbs * 4 + day.fat * 9 || 1;
  const share = (g: number, per: number) => `${(((g * per) / total) * 100).toFixed(1)}%`;

  return (
    <div className={`nl-day${open ? " open" : ""}`}>
      <button type="button" className="nl-row nl-cols" onClick={onToggle} aria-expanded={open}>
        <span className={`nl-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
        <span className="nl-date">{fmtDay(day.date)}</span>
        <span className="nl-kcal">{n(day.kcal)}</span>
        <span>
          <span className={`nl-daytag ${day.isTraining ? "training" : "rest"}`}>{day.isTraining ? "Training" : "Rest"}</span>
        </span>
        <span className={`nl-vs${diff == null ? "" : onTarget ? " good" : " warn"}`}>
          {diff == null ? "No target" : onTarget ? "On target" : `${n(Math.abs(diff))} kcal ${diff > 0 ? "over" : "under"}`}
        </span>
        <span className="nl-macros">
          <span className="nl-split" aria-hidden="true">
            <i className="p" style={{ width: share(day.protein, 4) }} />
            <i className="c" style={{ width: share(day.carbs, 4) }} />
            <i className="f" style={{ width: share(day.fat, 9) }} />
          </span>
          <span className="nl-gram">
            {day.protein} · {day.carbs} · {day.fat} g
          </span>
        </span>
      </button>

      {open && (
        <div className="nl-meals">
          {day.meals.map((m) => (
            <div key={m.id} className="nl-meal">
              <div className="nl-meal-head nl-meal-cols">
                <span className="nl-meal-name">{m.label}</span>
                <span className="nl-meal-kcal">{n(m.kcal)} kcal</span>
                <span className="nl-p">{m.protein} g</span>
                <span className="nl-c">{m.carbs} g</span>
                <span className="nl-f">{m.fat} g</span>
                {/* The camera only where there is a picture: an empty cell
                    otherwise, so every row's macros stay in one column. */}
                {m.photo ? (
                  <button type="button" className="nl-shot-btn" onClick={() => onShot({ src: m.photo as string, label: m.label, date: day.date })} title={`${m.label}, photographed`} aria-label={`See the picture of ${m.label}`}>
                    <CameraIcon />
                  </button>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>
              {m.foods.map((food, i) => (
                <div key={i} className="nl-food nl-meal-cols">
                  <span className="nl-food-name">
                    {food.name}
                    <small>{food.quantity}</small>
                  </span>
                  <span className="nl-food-kcal">{n(food.kcal)}</span>
                  <span>{food.protein}</span>
                  <span>{food.carbs}</span>
                  <span>{food.fat}</span>
                  <span aria-hidden="true" />
                </div>
              ))}
            </div>
          ))}
          {day.note && (
            <div className="nl-note">
              <span className="nw-label">Client note</span>
              <p>{day.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
