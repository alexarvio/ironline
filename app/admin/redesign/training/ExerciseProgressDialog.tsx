"use client";

import { useId, useMemo, useState } from "react";
import { DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { dayMonth } from "../../../lib/dayMonth";
import { judge, nudgeFor, repRange, rowStatus, setStatus, tipFor, type Session, type Verdict } from "../../../lib/progressRules";
import { TRAINING_ICON } from "../../../lib/eventTypes";

// An exercise's progress (15 Oct), for the coach: one glance at whether the
// client is progressing, stalling or dropping, and why, with real numbers.
// Two ranges (30 days, all time), the selected gym's sessions, a verdict
// card with a tip, three stats, the estimated one-rep max per session as a
// line, and the sessions as rows with their sets against the rep range.
// The maths lives in lib/progressRules.ts.

const DUMBBELL = TRAINING_ICON;
const VERDICT: Record<Verdict, { label: string; c: string; rgb: string; bg: string; icon: string }> = {
  progressing: { label: "Progressing", c: "#2f7a3f", rgb: "47,122,63", bg: "#F2F8F4", icon: "M5 16l5-5 4 4 5-7" },
  stalling: { label: "Stalling", c: "#a8761f", rgb: "168,118,31", bg: "#FBF6EC", icon: "M5 12h14" },
  dropping: { label: "Dropping", c: "#b8471f", rgb: "184,71,31", bg: "#FBF1EC", icon: "M5 8l5 5 4-4 5 7" },
  none: { label: "Not enough data", c: "#5b6474", rgb: "91,100,114", bg: "#F4F6FA", icon: "M12 8v5M12 16h.01" },
};
const DAY = 86400000;
const shortDate = (d: string | null) => (d ? dayMonth(d) : "—");
const pct = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(Math.round(x * 100))}%`;

export type ProgressSession = Session & { gym: string | null };

export default function ExerciseProgressDialog({
  exerciseName,
  firstName,
  targets,
  gyms,
  sessions: all,
  today,
  lbs,
  stepKg,
  onMessage,
  onClose,
}: {
  exerciseName: string;
  firstName: string;
  targets: { sets: number; reps: string; kg: number | null; rpe: number | null };
  /** The client's gyms, the home one first. */
  gyms: string[];
  /** Every session of this exercise, any gym, any time. */
  sessions: ProgressSession[];
  today: string;
  /** The coach reads weights in pounds. */
  lbs: boolean;
  stepKg?: number;
  onMessage: (draft: string) => void;
  onClose: () => void;
}) {
  const range = repRange(targets.reps);
  // The gym: the home one, unless the latest session was elsewhere; the coach can switch.
  const latest = [...all].sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1))[0];
  const gymOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...gyms, ...all.map((s) => s.gym ?? "")].filter((g) => g && !seen.has(g) && seen.add(g));
  }, [gyms, all]);
  const [gym, setGym] = useState<string | null>(gymOptions.length > 1 ? (latest?.gym && gymOptions.includes(latest.gym) ? latest.gym : gymOptions[0]) : null);
  const atGym = useMemo(() => (gym ? all.filter((s) => (s.gym ?? gymOptions[0]) === gym) : all), [all, gym, gymOptions]);
  const since30 = new Date(new Date(`${today}T00:00:00`).getTime() - 30 * DAY).toISOString().slice(0, 10);
  const last30 = atGym.filter((s) => (s.date ?? "") >= since30);
  const [rangeKey, setRangeKey] = useState<"30" | "all">(last30.filter((s) => s.sets.length).length >= 3 ? "30" : "all");
  const judged = useMemo(() => judge(rangeKey === "30" ? last30 : atGym), [rangeKey, last30, atGym]);
  const v = VERDICT[judged.verdict];
  const ss = judged.sessions;
  const n = ss.length;
  const last = ss[n - 1] ?? null;
  const best = ss[judged.bestAt] ?? null;
  const kg = (x: number) => (lbs ? `${Math.round(x * 2.20462 * 2) / 2}` : `${Math.round(x * 2) / 2}`);
  const unit = lbs ? "lb" : "kg";

  // Why, in one sentence with real numbers.
  const why = (() => {
    if (judged.verdict === "none") return `${n} session${n === 1 ? "" : "s"} so far. Check back after 3.`;
    if (judged.verdict === "progressing") return `Estimated 1RM up ${Math.round((judged.change ?? 0) * 100)}% since ${shortDate(ss[0].date)}.`;
    if (judged.verdict === "stalling") {
      const sinceBest = n - 1 - judged.bestAt;
      const same = ss.slice(judged.bestAt).every((s) => s.best.set.weight === best!.best.set.weight && s.best.set.reps === best!.best.set.reps);
      return same ? `No new best in ${Math.max(sinceBest, 1)} sessions: ${kg(best!.best.set.weight)} ${unit} × ${best!.best.set.reps} every time.` : `Best still ${kg(best!.best.set.weight)} × ${best!.best.set.reps} from ${shortDate(best!.date)}.`;
    }
    const under = Math.round((1 - last!.best.e1rm / best!.best.e1rm) * 100);
    return `Latest is ${under}% under the best (${kg(best!.best.set.weight)} × ${best!.best.set.reps} on ${shortDate(best!.date)}).`;
  })();
  const tip = tipFor(judged, range, stepKg);

  // The heaviest top set in the range: ties go to more reps.
  const heaviest = ss.reduce<{ w: number; r: number; date: string | null } | null>((acc, s) => {
    for (const set of s.sets) if (!acc || set.weight > acc.w || (set.weight === acc.w && set.reps > acc.r)) acc = { w: set.weight, r: set.reps, date: s.date };
    return acc;
  }, null);

  // The chart: sessions evenly spaced, the y domain padded by 2.
  const e = ss.map((s) => s.best.e1rm);
  const yMin = e.length ? Math.min(...e) - 2 : 0;
  const yMax = e.length ? Math.max(...e) + 2 : 1;
  const px = (i: number) => (n <= 1 ? 50 : (i / (n - 1)) * 100);
  const py = (val: number) => 100 - ((val - yMin) / Math.max(1, yMax - yMin)) * 100;
  const pts = ss.map((s, i) => ({ x: px(i), y: py(s.best.e1rm), s }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ");
  const area = n > 1 ? `${line} L${pts[n - 1].x} 100 L${pts[0].x} 100 Z` : "";
  const stall = judged.verdict === "stalling" ? pts.slice(judged.bestAt) : [];
  const stallLine = stall.length > 1 ? stall.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join(" ") : "";
  const gradId = `exp-g-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [hover, setHover] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [how, setHow] = useState(false);
  const rows = [...ss].reverse();
  const shownRows = showAll || rows.length <= 12 ? rows : rows.slice(0, 12);
  const targetsText = [targets.sets ? `${targets.sets} × ${targets.reps || "?"}` : "", targets.kg != null ? `${kg(targets.kg)} ${unit}` : "", targets.rpe != null ? `RPE ${targets.rpe}` : ""].filter(Boolean).join(" · ");

  return (
    <DialogContent className="exp" aria-describedby={undefined} aria-label={`${exerciseName} progress`} style={{ "--vc": v.c, "--vrgb": v.rgb, "--vbg": v.bg } as React.CSSProperties} onOpenAutoFocus={(ev) => ev.preventDefault()}>
      <span className="exp-glow" aria-hidden="true" />
      <div className="exp-body">
        <header className="exp-head">
          <span className="exp-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d={DUMBBELL} />
            </svg>
          </span>
          <div className="exp-head-text">
            <DialogTitle className="exp-title">{exerciseName}</DialogTitle>
            <div className="exp-context">
              {targetsText && <span className="exp-targets">{targetsText}</span>}
              <span>{firstName}</span>
              {gymOptions.length > 1 ? (
                <select className="exp-gym" value={gym ?? ""} onChange={(ev) => setGym(ev.target.value)} aria-label="Gym">
                  {gymOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              ) : (
                gymOptions[0] && <span>· {gymOptions[0]}</span>
              )}
            </div>
          </div>
          <div className="exp-seg" role="radiogroup" aria-label="Range">
            <button type="button" role="radio" aria-checked={rangeKey === "30"} className={rangeKey === "30" ? "on" : ""} onClick={() => setRangeKey("30")}>
              30 days
            </button>
            <button type="button" role="radio" aria-checked={rangeKey === "all"} className={rangeKey === "all" ? "on" : ""} onClick={() => setRangeKey("all")}>
              All time
            </button>
          </div>
          <button type="button" className="exp-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="exp-verdict" aria-live="polite">
          <span className="exp-verdict-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
              <path d={v.icon} />
            </svg>
          </span>
          <span className="exp-verdict-text">
            <b>{v.label}</b>
            <span>{why}</span>
          </span>
          {tip && <span className="exp-tip">{tip}</span>}
        </div>

        <div className="exp-stats">
          <span className="exp-stat">
            <small>Change</small>
            <b className={judged.verdict !== "none" ? "verdict" : ""}>{judged.change == null ? "—" : pct(judged.change)}</b>
            <em>{ss[0] ? `e1RM since ${shortDate(ss[0].date)}` : "e1RM"}</em>
          </span>
          <span className="exp-stat">
            <small>Best set</small>
            <b>{heaviest ? `${kg(heaviest.w)} × ${heaviest.r}` : "—"}</b>
            <em>{heaviest ? shortDate(heaviest.date) : "no sets yet"}</em>
          </span>
          <span className="exp-stat">
            <small>Now</small>
            <b>{last ? `${kg(last.best.e1rm)} ${unit}` : "—"}</b>
            <em>estimated 1RM</em>
          </span>
        </div>

        {n === 0 ? (
          <p className="exp-empty">Nothing logged on this exercise{gym ? ` at ${gym}` : ""} yet.</p>
        ) : (
          <div>
            <div className="exp-chart-head">
              <b>Estimated 1RM per session</b>
              <small>{unit}</small>
            </div>
            <div className="exp-plot" role="img" aria-label={`Estimated 1RM from ${kg(e[0])} to ${kg(e[n - 1])} ${unit} over ${n} session${n === 1 ? "" : "s"}`}>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ left: 8, right: 42, top: 14, bottom: 14, width: "calc(100% - 50px)", height: "calc(100% - 28px)" }} aria-hidden="true">
                <defs>
                  <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#3a3390" stopOpacity="0.22" />
                    <stop offset="1" stopColor="#3a3390" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {[0, 50, 100].map((y) => (
                  <line key={y} className="exp-grid" x1="0" x2="100" y1={y} y2={y} vectorEffect="non-scaling-stroke" />
                ))}
                {area && <path d={area} fill={`url(#${gradId})`} />}
                {n > 1 && <path className="exp-line" d={line} />}
                {stallLine && <path className="exp-stall" d={stallLine} />}
              </svg>
              <span className="exp-ylab" style={{ top: 8 }}>
                {kg(yMax)}
              </span>
              <span className="exp-ylab" style={{ bottom: 8 }}>
                {kg(yMin)}
              </span>
              {pts.map((p, i) => {
                const left = `calc(8px + ${p.x / 100} * (100% - 50px))`;
                const top = `calc(14px + ${p.y / 100} * (100% - 28px))`;
                const inStall = judged.verdict === "stalling" && i >= judged.bestAt;
                const isLatest = i === n - 1;
                const label = `${shortDate(p.s.date)} · ${kg(p.s.best.set.weight)} ${unit} × ${p.s.best.set.reps} · e1RM ${kg(p.s.best.e1rm)}`;
                return (
                  <button key={i} type="button" className={`exp-point${inStall ? " stall" : ""}${isLatest ? " latest" : ""}`} style={{ left, top }} aria-label={label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} />
                );
              })}
              {last && <span className={`exp-latest${pts[n - 1].y < 22 ? " below" : ""}`} style={{ left: `calc(8px + ${pts[n - 1].x / 100} * (100% - 50px))`, top: `calc(14px + ${pts[n - 1].y / 100} * (100% - 28px))` }}>{`${kg(last.best.set.weight)} × ${last.best.set.reps}`}</span>}
              {hover != null && (
                <span className="exp-tooltip" style={{ left: `calc(8px + ${pts[hover].x / 100} * (100% - 50px))`, top: `calc(14px + ${pts[hover].y / 100} * (100% - 28px))` }}>
                  {shortDate(pts[hover].s.date)} · {kg(pts[hover].s.best.set.weight)} {unit} × {pts[hover].s.best.set.reps} · e1RM {kg(pts[hover].s.best.e1rm)}
                </span>
              )}
            </div>
            <div className="exp-xlabs">
              <span>{shortDate(ss[0].date)}</span>
              {n > 1 && <span>{shortDate(last!.date)}</span>}
            </div>
          </div>
        )}

        {n > 0 && (
          <div>
            <div className="exp-rows-head">
              <b>Sessions</b>
              <small>{n} session{n === 1 ? "" : "s"}</small>
            </div>
            <div className="exp-rows" style={{ marginTop: 6 }}>
              {shownRows.map((s, i) => {
                const idx = ss.indexOf(s);
                const prev = ss[idx - 1] ?? null;
                const change = prev && prev.best.e1rm > 0 ? (s.best.e1rm - prev.best.e1rm) / prev.best.e1rm : null;
                const st = rowStatus(s.sets, range, targets.kg);
                return (
                  <div key={`${s.date}-${s.planWeek}`} className={`exp-row${i === 0 ? " latest" : ""}`}>
                    <span className="exp-date">
                      <b>{shortDate(s.date)}</b>
                      <small>W{s.planWeek}</small>
                    </span>
                    <span className="exp-sets">
                      {s.sets.map((set, k) => {
                        const sst = setStatus(set.reps, range);
                        return (
                          <span key={k} className={`exp-set ${sst === "top" ? "top" : sst === "below" ? "below" : ""}`} aria-label={`${kg(set.weight)} ${lbs ? "pounds" : "kilos"} for ${set.reps} reps${sst === "top" ? ", reached the top of range" : sst === "below" ? ", below the range" : ""}`}>
                            {kg(set.weight)}×{set.reps}
                            {set.rpe != null && <small>@{set.rpe}</small>}
                          </span>
                        );
                      })}
                    </span>
                    <span className={`exp-status ${st}`}>{st === "top" ? "Top of range" : st === "on" ? "On target" : "Below"}</span>
                    <span className={`exp-change${change != null && change > 0.0005 ? " up" : change != null && change < -0.0005 ? " down" : ""}`}>{change == null ? "—" : pct(change)}</span>
                  </div>
                );
              })}
              {!showAll && rows.length > 12 && (
                <button type="button" className="exp-more" onClick={() => setShowAll(true)}>
                  Show all {rows.length}
                </button>
              )}
            </div>
          </div>
        )}

        {how && (
          <p className="exp-how">
            Estimated 1RM is the best set’s weight × (1 + reps ÷ 30), one figure per session. Progressing means a new best within the last three sessions. Stalling means no new best in three sessions. Dropping means the latest is more than 5% under the best in the range. Top of range means every set reached the top of the rep range.
          </p>
        )}
      </div>

      <footer className="exp-foot">
        <button type="button" className="exp-howbtn" onClick={() => setHow((h) => !h)} aria-expanded={how}>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          {how ? "Hide how it’s worked out" : "How it’s worked out"}
        </button>
        <button type="button" className="exp-msg" onClick={() => onMessage(nudgeFor(judged, exerciseName, firstName, range, stepKg))}>
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16v11H8l-4 4z" />
          </svg>
          Message {firstName}
        </button>
      </footer>
    </DialogContent>
  );
}
