"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "../components/icons";
import { logMetricPeriodAction } from "../lib/actions";
import { useOpenCheckIn } from "./CheckInContext";

// Home's check-in card, first on the page (28 Sep; it replaces Quick
// actions): the next question still open today, answered right here, a
// tap on 0-10 or a number and Save, then the next one slides in. Every
// daily question is open all day and is about today. The head opens the
// hub (the check-in screen: today's questions, progress, calendar).

export type CardMetric = {
  id: string;
  name: string;
  unit: string;
  hint: string | null;
  scaleMax: number | null;
  step: string;
  /** What is saved for today (or this week), "" when nothing yet. */
  value: string;
  source: "daily" | "weekly";
};

const BACKGROUNDS = ["/img/lifestyle-head.jpg", "/img/session-head.jpg", "/img/nutrition-head.jpg"];

export default function CheckInCard({ clientId, today, metrics, streak }: { clientId: number; today: string; metrics: CardMetric[]; streak: number }) {
  const router = useRouter();
  const openCheckIn = useOpenCheckIn();
  const [, start] = useTransition();
  // Answered here before the server has caught up, and ones put off till later.
  const [answered, setAnswered] = useState<Record<string, string>>({});
  const [later, setLater] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [saving, setSaving] = useState(false);

  const isIn = (m: CardMetric) => m.value !== "" || answered[`${m.source}:${m.id}`] != null;
  const open = metrics.filter((m) => !isIn(m));
  const done = metrics.length - open.length;
  // The next one: the first still open that wasn't put off; once all were put off, round again.
  const next = open.find((m) => !later.includes(`${m.source}:${m.id}`)) ?? open[0] ?? null;

  const save = (m: CardMetric, value: string) => {
    const key = `${m.source}:${m.id}`;
    setSaving(true);
    setAnswered((a) => ({ ...a, [key]: value }));
    setTyped("");
    start(async () => {
      const fd = new FormData();
      fd.set("clientId", String(clientId));
      fd.set("date", today);
      fd.set("frequency", m.source);
      fd.set(`metric_${m.id}`, value);
      await logMetricPeriodAction(fd);
      setSaving(false);
      router.refresh();
    });
  };

  const dayOfYear = Math.floor((Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1, Number(today.slice(8, 10))) - Date.UTC(Number(today.slice(0, 4)), 0, 1)) / 86400000);
  const bg = BACKGROUNDS[dayOfYear % BACKGROUNDS.length];
  if (metrics.length === 0) return null;

  return (
    <section className="qa cic" aria-label="Check-in">
      {/* eslint-disable-next-line @next/next/no-img-element -- a public file, blurred by CSS */}
      <img className="qa-bg" src={bg} alt="" aria-hidden="true" draggable={false} />
      <span className="qa-scrim" aria-hidden="true" />
      <div className="qa-panel">
        <button type="button" className="qa-head cic-head" onClick={() => openCheckIn?.("daily")} aria-label="Open your check-in">
          <span className="qa-title">Check-in</span>
          <span className="qa-count">
            {next ? `${done} of ${metrics.length}` : streak > 1 ? `${streak}-day streak` : "Done today"}
            <span className="cic-open" aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </span>
        </button>

        {next ? (
          <div key={`${next.source}:${next.id}`} className="cic-q">
            <div className="cic-q-top">
              <span className="cic-q-name">{next.name}</span>
              {open.length > 1 && (
                <button type="button" className="cic-later" onClick={() => setLater((l) => [...l.filter((k) => k !== `${next.source}:${next.id}`), `${next.source}:${next.id}`])}>
                  Later
                </button>
              )}
            </div>
            {next.hint && <span className="cic-q-hint">{next.hint}</span>}
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
        ) : (
          <div className="qa-row qa-done">
            <span className="qa-text">
              <span className="qa-label">Today</span>
              <span className="qa-name">Checked in</span>
            </span>
            <button type="button" className="qa-btn" onClick={() => openCheckIn?.("daily")}>
              Open
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
