"use client";

import { useRef, useState, useTransition } from "react";
import type React from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon, HeartIcon } from "../components/icons";
import { logMetricPeriodAction } from "../lib/actions";
import type { MetricAskAt } from "../lib/db";
import { EVENING_FROM } from "../lib/metricAskAt";
import { useOpenCheckIn } from "./CheckInContext";
import { Bar, progressOf, type HomePhase } from "./PhaseCards";

// Home's lifestyle card, first on the page (28 Sep; it took the check-in
// card's place, and lifestyle left the phase carousel): the phase and how
// far in, today's metrics as one bar each, and one question, answered
// right here or swiped sideways to another. It opens on the one the time
// of day asks for: the morning's (weight), then all day's (steps), then
// from 17:00 the evening's (energy). An evening or all-day one left
// unanswered yesterday is asked once today's are all in. Anywhere else
// on the card opens the check-in screen, where everything is.

export type CardMetric = {
  id: string;
  name: string;
  unit: string;
  hint: string | null;
  scaleMax: number | null;
  step: string;
  /** What is saved for its day (or this week), "" when nothing yet. */
  value: string;
  source: "daily" | "weekly";
  askAt: MetricAskAt;
  /** A day other than today (yesterday's evening question). */
  date?: string;
};

const SLOT: Record<MetricAskAt, number> = { morning: 0, anytime: 1, evening: 2 };
const keyOf = (m: CardMetric) => `${m.date ?? "today"}:${m.source}:${m.id}`;

export default function LifestyleCard({
  clientId,
  today,
  hour,
  phase,
  coachName,
  metrics,
  yesterday,
  streak,
}: {
  clientId: number;
  today: string;
  /** The hour on the client's phone, from the server. */
  hour: number;
  phase: HomePhase | null;
  coachName: string;
  metrics: CardMetric[];
  yesterday: CardMetric[];
  streak: number;
}) {
  const router = useRouter();
  const openCheckIn = useOpenCheckIn();
  const [, start] = useTransition();
  // Answered here before the server has caught up.
  const [answered, setAnswered] = useState<Record<string, string>>({});
  // Which of the open questions is on the card: the first, or one swiped to.
  const [at, setAt] = useState(0);
  const [dir, setDir] = useState<"next" | "prev">("next");
  // The evening's questions asked before 17:00, on request.
  const [early, setEarly] = useState(false);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const isIn = (m: CardMetric) => m.value !== "" || answered[keyOf(m)] != null;
  const evening = hour >= EVENING_FROM || early;
  const openToday = metrics.filter((m) => !isIn(m)).sort((a, b) => SLOT[a.askAt] - SLOT[b.askAt]);
  // Today's first, all of it; yesterday's only once today is complete. The
  // evening's wait for 17:00 while anything else is open, but a swipe
  // reaches them: the ones known now can be answered first.
  const onlyEveningLeft = openToday.every((m) => SLOT[m.askAt] === 2);
  const list = openToday.length ? (evening || !onlyEveningLeft ? openToday : []) : yesterday.filter((m) => !isIn(m));
  const i = list.length ? Math.min(at, list.length - 1) : 0;
  const next = list[i] ?? null;
  // Only the evening's left, and it isn't evening yet.
  const waiting = !next ? openToday : [];
  const done = metrics.filter(isIn).length;
  const go = (step: 1 | -1) => {
    if (list.length < 2) return;
    setDir(step > 0 ? "next" : "prev");
    setAt((i + step + list.length) % list.length);
    setTyped("");
  };
  const onPointerDown = (e: React.PointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    swiped.current = true;
    go(dx < 0 ? 1 : -1);
  };

  const save = (m: CardMetric, value: string) => {
    setSaving(true);
    setAnswered((a) => ({ ...a, [keyOf(m)]: value }));
    setTyped("");
    start(async () => {
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("date", m.date ?? today);
      fd.set("frequency", m.source);
      fd.set(`metric_${m.id}`, value);
      await logMetricPeriodAction(fd);
      setSaving(false);
      router.refresh();
    });
  };

  if (metrics.length === 0 && !phase) return null;
  const pr = phase ? progressOf(phase, today, coachName) : null;
  const open = () => openCheckIn?.("daily");

  return (
    <section className="qa cic lc" aria-label="Lifestyle">
      {/* eslint-disable-next-line @next/next/no-img-element -- an upload or a public file, blurred by CSS */}
      <img className="qa-bg lc-bg" src={phase?.coverUrl ?? "/img/lifestyle-head.jpg"} alt="" aria-hidden="true" draggable={false} />
      <span className="qa-scrim" aria-hidden="true" />
      <button type="button" className="lc-top" onClick={open} aria-label="Open your check-in">
        <span className="pc-track-chip lc-chip">
          <span className="pc-icon">
            <HeartIcon />
          </span>
          Lifestyle
        </span>
        {pr && <span className="pc-week-chip lc-chip">{pr.weekLabel}</span>}
      </button>
      <div className="qa-panel lc-panel">
        <button type="button" className="lc-head" onClick={open}>
          <span className="lc-name">{phase?.name ?? "Check-in"}</span>
          <span className="lc-left">
            {pr ? (pr.leftLabel ?? pr.throughLabel) : streak > 1 ? `${streak}-day streak` : ""}
            <span className="cic-open" aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </span>
        </button>
        {pr && <Bar pr={pr} small />}

        {/* Today: one bar a metric, filled once it's in. */}
        {metrics.length > 0 && (
          <div className="lc-today">
            <div className="lc-segs" aria-hidden="true">
              {metrics.map((m) => (
                <i key={keyOf(m)} className={isIn(m) ? "on" : ""} />
              ))}
            </div>
            <span className="lc-count">
              {done} of {metrics.length} today
            </span>
          </div>
        )}

        {next ? (
          // Swipe sideways for another of today's questions: the one asked
          // may not be known yet when another is.
          <div
            key={keyOf(next)}
            className={`cic-q lc-q ${dir}`}
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (swipe.current = null)}
            onClickCapture={(e) => {
              if (swiped.current) {
                e.preventDefault();
                e.stopPropagation();
                swiped.current = false;
              }
            }}
          >
            <div className="cic-q-top">
              <span className="cic-q-name">
                {next.date && <small className="lc-when">Yesterday</small>}
                {next.name}
              </span>
              {list.length > 1 && (
                <span className="lc-dots" role="group" aria-label={`Question ${i + 1} of ${list.length}`}>
                  {list.map((m, j) => (
                    <button
                      key={keyOf(m)}
                      type="button"
                      className={j === i ? "on" : ""}
                      aria-label={m.name}
                      aria-current={j === i}
                      onClick={() => {
                        if (j === i) return;
                        setDir(j > i ? "next" : "prev");
                        setAt(j);
                        setTyped("");
                      }}
                    />
                  ))}
                </span>
              )}
            </div>
            {next.hint && !next.date && <span className="cic-q-hint">{next.hint}</span>}
            {next.scaleMax ? (
              <div className="cic-scale" role="group" aria-label={`${next.name}, 0 to ${next.scaleMax}`} style={{ gridTemplateColumns: `repeat(${next.scaleMax + 1}, minmax(0, 1fr))` }}>
                {Array.from({ length: next.scaleMax + 1 }, (_, i) => (
                  <button key={i} type="button" className="cic-n" onClick={() => save(next, String(i))} disabled={saving}>
                    {i}
                  </button>
                ))}
              </div>
            ) : (
              <form
                className="cic-num"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typed.trim()) save(next, typed.trim());
                }}
              >
                <span className="cic-num-box">
                  <input value={typed} onChange={(e) => setTyped(e.target.value)} inputMode="decimal" placeholder="0" aria-label={next.name} />
                  {next.unit && <span className="cic-unit">{next.unit}</span>}
                </span>
                <button type="submit" className="qa-btn" disabled={saving || !typed.trim()}>
                  Save
                </button>
              </form>
            )}
          </div>
        ) : waiting.length > 0 ? (
          <div className="qa-row lc-row">
            <span className="qa-text">
              <span className="qa-label">This evening</span>
              <span className="qa-name">{waiting.map((m) => m.name).join(", ")}</span>
            </span>
            <button type="button" className="qa-btn" onClick={() => setEarly(true)}>
              Answer now
            </button>
          </div>
        ) : (
          <div className="qa-row lc-row qa-done">
            <span className="qa-text">
              <span className="qa-label">Today</span>
              <span className="qa-name">{metrics.length ? "All logged" : "Nothing to log today"}</span>
            </span>
            <button type="button" className="qa-btn" onClick={open}>
              Open
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
