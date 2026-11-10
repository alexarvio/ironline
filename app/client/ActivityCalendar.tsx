"use client";

import { useEffect, useRef, useState } from "react";
import { landOnSoon } from "../lib/landOn";
import { ChevronLeftIcon } from "../components/icons";
import RingEdge from "../components/RingEdge";
import { Bars } from "./Bars";
import { dayWords, monthWords } from "../lib/clientDates";

// The check-in's Calendar (28 Sep; hairline 23 Oct, Alex): everything the
// client did, a month at a time, Monday first, flat on the page. Each day's
// numeral sits in a thin ring of up to three equal parts, one a thing done:
// training (indigo), food logged (teal), a check-in (beige). One thing rings
// it in its colour, two halve it, three third it. A record of what was done,
// not a score. Today's numeral is on an ink disc. Tap a day and the month
// opens under its week, flat: the session (exercises | gym | time), the
// day's calories and macros, and what was checked in, each on a 2px line in
// its colour.
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx): the
// same shape as getActivityCalendar's, passed in as plain props.

export type ActivityDay = {
  date: string;
  sessions: { title: string; minutes: number | null; finished: boolean; exercises: number; gym: string | null }[];
  food: { kcal: number; protein: number | null; carbs: number | null; fat: number | null } | null;
  checkIns: string[];
};

const PARTS = [
  // The tracks' order (24 Oct, Alex): Lifestyle, Training, Nutrition.
  { id: "lifestyle", label: "Check-ins", colour: "#a08a5c" },
  { id: "training", label: "Training", colour: "#3a3390" },
  { id: "nutrition", label: "Nutrition", colour: "#1d7a70" },
] as const;
const colourOf = (id: (typeof PARTS)[number]["id"]) => PARTS.find((p) => p.id === id)!.colour;

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const doneOf = (d: ActivityDay | undefined) => (d ? PARTS.filter((p) => (p.id === "training" ? d.sessions.length > 0 : p.id === "nutrition" ? !!d.food : d.checkIns.length > 0)) : []);
const kcal = (n: number) => Math.round(n).toLocaleString("en-US");

// The ring: thin (2), its circumference split equally between the parts
// done, flat ends and an equal gap centred on each join, so halves split top
// to bottom and thirds sit level.
const R = 16;
const C = 2 * Math.PI * R;
function Ring({ parts }: { parts: readonly { colour: string }[] }) {
  if (parts.length === 0) return null;
  const gap = parts.length > 1 ? 2.5 : 0;
  const len = C / parts.length;
  return (
    <svg className="ac-ring" viewBox="0 0 40 40" aria-hidden="true">
      {parts.map((p, i) => (
        <circle key={i} cx="20" cy="20" r={R} fill="none" stroke={p.colour} strokeWidth="2" strokeLinecap="butt" strokeDasharray={`${Math.max(0, len - gap)} ${C}`} strokeDashoffset={-(i * len + gap / 2)} transform="rotate(-90 20 20)" />
      ))}
    </svg>
  );
}

export default function ActivityCalendar({ days, today, initialDay = null }: { days: ActivityDay[]; today: string; /** Opened on this day (a link, 24 Oct): its month, the day open under its week, landed on. */ initialDay?: string | null }) {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const [month, setMonth] = useState((initialDay ?? today).slice(0, 7));
  const [picked, setPicked] = useState<string | null>(initialDay);
  const panelRef = useRef<HTMLDivElement>(null);
  // Arriving from a link: the open day brought to the middle and lit (24 Oct, Alex: a link lands on its thing).
  useEffect(() => {
    if (!initialDay) return;
    return landOnSoon(() => panelRef.current, "center", 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
  }, []);
  // The day each week last showed (3 Nov, Alex: on the shared fold): a week's fold keeps it while it folds shut, so the
  // panel eases away with its words in it rather than emptying first.
  const [shown, setShown] = useState<Record<string, string>>({});
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...Array.from({ length: count }, (_, i) => iso(new Date(y, m - 1, i + 1)))];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  /** A week by its first day, as the folds are keyed. */
  const weekOf = (d: string) => weeks.find((wk) => wk.includes(d))?.find(Boolean) ?? d;
  // A tap opens the day under its week; the same day again folds it shut; another day in the open week only swaps
  // what is in it (3 Nov, Alex). Every opening and closing is the shared fold, no timers.
  const pick = (d: string) => {
    if (d === picked) return setPicked(null);
    setShown((s) => ({ ...s, [weekOf(d)]: d }));
    setPicked(d);
  };
  const move = (n: number) => {
    setMonth(iso(new Date(y, m - 1 + n, 1)).slice(0, 7));
    setPicked(null);
    setShown({});
  };

  return (
    <section className="wc ac" aria-label="Activity calendar">
      <div className="wc-head">
        <button type="button" className="wc-nav" onClick={() => move(-1)} aria-label="Previous month">
          <ChevronLeftIcon />
          <RingEdge size={32} />
        </button>
        <span className="wc-title">
          <b>{monthWords(first)}</b>
        </span>
        <button type="button" className="wc-nav next" onClick={() => move(1)} aria-label="Next month" disabled={month >= today.slice(0, 7)}>
          <ChevronLeftIcon />
          <RingEdge size={32} />
        </button>
      </div>
      <div className="ac-legend" aria-hidden="true">
        {PARTS.map((p) => (
          <span key={p.id}>
            <i style={{ background: p.colour }} />
            {p.label}
          </span>
        ))}
      </div>

      <div className="wc-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="wc-dow">
            {d}
          </span>
        ))}
      </div>
      {weeks.map((week, w) => (
        <div key={w}>
          <div className="wc-grid">
            {week.map((d, i) => {
              if (!d) return <span key={`e${w}${i}`} />;
              const a = byDate.get(d);
              const parts = doneOf(a);
              return (
                <button
                  key={d}
                  type="button"
                  className={`ac-day${parts.length ? " did" : ""}${d === today ? " today" : ""}${d > today ? " soon" : ""}${d === picked ? " on" : ""}`}
                  onClick={() => pick(d)}
                  disabled={!parts.length}
                  aria-expanded={parts.length ? d === picked : undefined}
                  aria-label={parts.length ? `${d}: ${parts.map((p) => p.label.toLowerCase()).join(", ")}` : d}
                >
                  <Ring parts={parts} />
                  <span className="ac-num">
                    {Number(d.slice(8))}
                    <RingEdge size={28} stroke={1.5} />
                  </span>
                </button>
              );
            })}
          </div>
          {/* The picked day opens here, under its own week, on the shared fold; the week keeps the day it last showed
              while it folds shut. */}
          {(() => {
            const key = week.find(Boolean) ?? "";
            const open = !!picked && week.includes(picked);
            const showing = byDate.get(open ? picked! : shown[key] ?? (initialDay && week.includes(initialDay) ? initialDay : "")) ?? null;
            return (
              <div ref={open ? panelRef : undefined} className={`ac-fold${open ? " open" : ""}`} aria-hidden={!open} inert={!open}>
                <div className="ac-fold-in">{showing && <DayPanel key={showing.date} day={showing} />}</div>
              </div>
            );
          })()}
        </div>
      ))}
    </section>
  );
}

function DayPanel({ day }: { day: ActivityDay }) {
  return (
    <div className="ac-panel">
      <div className="ac-panel-clip">
        <div className="ac-panel-body">
          <span className="wc-list-date">{dayWords(day.date, { weekday: "long", long: true })}</span>
          {day.sessions.map((s, i) => (
            <div key={i} className="ac-item" style={{ ["--ac" as string]: colourOf("training") }}>
              <span className="ac-item-label">Training</span>
              {/* One row: the session on the left, its exercises, gym and time on the right (wrapping under when the name is long), parted by the drawn bar; Unfinished is one more fact. */}
              <span className="ac-item-row">
                <b>{s.title}</b>
                <small className="ac-facts">
                  {/* The shared drawn bar (3 Nov, Alex: Bars, not a copy of its own). */}
                  <Bars parts={[s.exercises ? <span>{`${s.exercises} ${s.exercises === 1 ? "exercise" : "exercises"}`}</span> : null, s.gym ? <span>{s.gym}</span> : null, s.minutes != null ? <span>{`${s.minutes} min`}</span> : null, !s.finished && <em>Unfinished</em>]} />
                </small>
              </span>
            </div>
          ))}
          {day.food && (
            <div className="ac-item" style={{ ["--ac" as string]: colourOf("nutrition") }}>
              <span className="ac-item-label">Nutrition</span>
              <span className="ac-item-row">
                <b>{kcal(day.food.kcal)} kcal</b>
                {day.food.protein != null && (
                  <span className="ac-macros">
                    <span>
                      <small>Protein</small>
                      {day.food.protein} g
                    </span>
                    <span>
                      <small>Carbs</small>
                      {day.food.carbs} g
                    </span>
                    <span>
                      <small>Fats</small>
                      {day.food.fat} g
                    </span>
                  </span>
                )}
              </span>
            </div>
          )}
          {day.checkIns.length > 0 && (
            <div className="ac-item" style={{ ["--ac" as string]: colourOf("lifestyle") }}>
              <span className="ac-item-label">Check-ins</span>
              <b>
                {day.checkIns.length} {day.checkIns.length === 1 ? "check-in" : "check-ins"}
              </b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
