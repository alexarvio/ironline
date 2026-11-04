"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
import { isAssisted, judge, liftedKg, repRange, rowStatus, type Judged, type Session, type Verdict } from "../../../lib/progressRules";
import { monotoneSegments } from "../../../lib/monotoneCurve";
import { Fold } from "../Fold";
import { Sep, SepJoin } from "../Sep";

// An exercise's progress, for the coach (23 Oct, Alex: mockup B). The .dlh card: the name, the verdict as a state pill
// with the targets and the gym as facts, the estimated one-rep max now with its change and the best set, 7 days | 30
// days | All time, a stall's fix, the e1RM per session as a line spaced by date, the sessions as a log. The maths lives in
// lib/progressRules.ts.
//
// Its sessions are every session the Training row's 7 days and 30 days cells count (exerciseTrends: the exercise across
// the client's logs, any programme, any gym, by the calendar; 23 Oct, Alex: "I click on 30 days... it still shows 1
// week"). It opens on the window clicked, on All gyms; in 7 days and 30 days the change is the cell's own figure.

const VERDICT: Record<Verdict, { label: string; tone: string }> = {
  progressing: { label: "Progressing", tone: "good" },
  stalling: { label: "Stalling", tone: "warn" },
  dropping: { label: "Dropping", tone: "bad" },
  none: { label: "Not enough data", tone: "" },
};
const DAY = 86400000;
const PURPLE = "#3a3390";
const RUST = "#b8471f";
/** The chart's box: its height and the room kept for the y figures (left), the dates (bottom) and, at the top, the pill that
 *  reads a session (4 Nov, Alex: over the line "it's blocking the graph"). */
const CH = { h: 248, l: 34, r: 10, t: 44, b: 26 };
/** A yyyy-mm-dd day (read as that calendar day) or a timestamp, in ms; NaN when there is none. */
const dayMs = (d: string | null) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d).getTime() : NaN);
/** The yyyy-mm-dd n days before a yyyy-mm-dd day, counted in UTC both ways so the day isn't shifted by the time zone. */
const daysBefore = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - n * DAY).toISOString().slice(0, 10);
};

/** assisted and bodyKg: that session's, as the loader read them (23 Oct): its exercise and variation, the weight that day. */
export type ProgressSession = Session & { gym: string | null; assisted?: boolean; bodyKg?: number | null };
/** A window: the last 7 or 30 days, today among them (as the cells count), or every session. */
type Win = "7" | "30" | "all";
const WIN_LABEL: Record<Win, string> = { "7": "7 days", "30": "30 days", all: "All time" };
/** A change as the cell writes it: one decimal, "=" for none, a dash with nothing to compare. */
const cellText = (dv: number | null) => (dv == null ? "—" : dv === 0 ? "0.0%" : `${dv > 0 ? "+" : "−"}${Math.abs(dv).toFixed(1)}%`);

export default function ExerciseProgressDialog({
  exerciseName,
  firstName,
  targets,
  gyms,
  sessions: all,
  today,
  window: clicked,
  trend,
  lbs,
  assisted: assistedRow,
  bodyKg,
  onMessage,
  onClose,
}: {
  exerciseName: string;
  firstName: string;
  targets: { sets: number; reps: string; kg: number | null; rpe: number | null };
  /** The client's gyms, the home one first. */
  gyms: string[];
  /** Every session of this exercise, any gym, any time: the ones the 7 days and 30 days cells count. */
  sessions: ProgressSession[];
  /** yyyy-mm-dd, the day the cells count from (the server's). */
  today: string;
  /** The cell clicked (7 days or 30 days): the window it opens on, always offered. */
  window?: "7" | "30";
  /** The cells' own figures, the change shown in their windows on All gyms, so the two never disagree. */
  trend?: { d7: number | null; d30: number | null; d7Since?: string | null; d30Since?: string | null };
  /** The coach reads weights in pounds. */
  lbs: boolean;
  /** An assisted lift, as the loader knows it (the exercise's name or its variation's); else by the name here. */
  assisted?: boolean;
  /** The client's body weight now: an assisted lift is judged by it less the help (23 Oct, Alex); a session's own day's first. */
  bodyKg: number | null;
  onMessage: () => void;
  onClose: () => void;
}) {
  const range = repRange(targets.reps);
  // An assisted lift's kg is help: less is stronger, so it is weighed by what was lifted (body weight less the help).
  const assisted = assistedRow ?? isAssisted(exerciseName);
  // The gyms the sessions were at, the client's own first (home first). All gyms is the first choice and the one it opens
  // on; a gym narrows to the sessions logged there (one with no gym recorded is under All gyms alone). The switch only
  // while a gym narrows anything: two gyms, or one and sessions with none recorded.
  const gymOptions = useMemo(() => {
    const at = new Set(all.map((s) => s.gym ?? ""));
    const seen = new Set<string>();
    return [...gyms, ...all.map((s) => s.gym ?? "")].filter((g) => g && at.has(g) && !seen.has(g) && seen.add(g));
  }, [gyms, all]);
  const gymSwitch = gymOptions.length > 1 || (gymOptions.length === 1 && all.some((s) => !s.gym));
  const [gym, setGym] = useState<string | null>(null);
  const atGym = useMemo(() => (gym ? all.filter((s) => s.gym === gym) : all), [all, gym]);
  // Each window judged, every session weighed as the loader weighed it: that day's exercise assisted or not, the body
  // weight that day. The windows are the cells': the last 7 (30) days with today.
  const js = useMemo(() => {
    const load = (w: number, s: ProgressSession) => liftedKg(w, s.assisted ?? assisted, s.bodyKg ?? bodyKg);
    const within = (from: string) => atGym.filter((s) => !!s.date && s.date.slice(0, 10) >= from && s.date.slice(0, 10) <= today);
    const out: Record<Win, Judged> = { "7": judge(within(daysBefore(today, 6)), load), "30": judge(within(daysBefore(today, 29)), load), all: judge(atGym, load) };
    return out;
  }, [atGym, assisted, bodyKg, today]);
  // Opened from a cell, on its window; else 30 days with three sessions in it, else all time.
  const [rangeKey, setRangeKey] = useState<Win>(() => clicked ?? (js["30"].sessions.length >= 3 ? "30" : "all"));
  // A window only while it holds other sessions than the next wider one (no choice that changes nothing), the one
  // clicked always; All time with them. One left: no capsule.
  const n7 = js["7"].sessions.length;
  const n30 = js["30"].sessions.length;
  const nAll = js.all.sessions.length;
  const offered: Win[] = [
    ...(clicked === "7" || (n7 > 0 && n7 < n30) ? (["7"] as const) : []),
    ...(clicked === "30" || (n30 > 0 && n30 < nAll) ? (["30"] as const) : []),
    "all",
  ];
  const view: Win = offered.includes(rangeKey) ? rangeKey : "all";
  const judged = js[view];
  // The change in a window: the best e1RM in it against the best in the window before, as the cell (exerciseTrends);
  // on All gyms the cell's own figure, a gym's own sessions worked the same way. A lift newer than the window before
  // counts from its first day, and says since when (30 Oct, Alex).
  const { pct: windowChange, since: windowSince } = ((): { pct: number | null; since: string | null } => {
    if (view === "all") return { pct: null, since: null };
    if (!gym && trend) return view === "7" ? { pct: trend.d7, since: trend.d7Since ?? null } : { pct: trend.d30, since: trend.d30Since ?? null };
    const days = view === "7" ? 7 : 30;
    const from = daysBefore(today, days - 1);
    const prevFrom = daysBefore(today, 2 * days - 1);
    let cur = 0;
    let prev = 0;
    let first: string | null = null;
    let firstBest = 0;
    let later = false;
    for (const s of js.all.sessions) {
      const d = (s.date ?? "").slice(0, 10);
      if (!d || d > today) continue;
      if (d >= from) cur = Math.max(cur, s.best.e1rm);
      else if (d >= prevFrom) prev = Math.max(prev, s.best.e1rm);
      if (!first || d < first) [first, firstBest, later] = [d, s.best.e1rm, later || !!first];
      else if (d === first) firstBest = Math.max(firstBest, s.best.e1rm);
      else later = true;
    }
    const pct = (a: number, b: number) => Math.round(((a - b) / b) * 1000) / 10;
    if (cur > 0 && prev > 0) return { pct: pct(cur, prev), since: null };
    if (cur > 0 && first && first >= from && later && firstBest > 0) return { pct: pct(cur, firstBest), since: first };
    return { pct: null, since: null };
  })();
  const v = VERDICT[judged.verdict];
  const ss = judged.sessions;
  const n = ss.length;
  const last = ss[n - 1] ?? null;
  const best = ss[judged.bestAt] ?? null;
  const stalling = judged.verdict === "stalling";
  const kg = (x: number) => (lbs ? `${Math.round(x * 2.20462 * 2) / 2}` : `${Math.round(x * 2) / 2}`);
  const unit = lbs ? "lbs" : "kg";
  /** An e1RM in the coach's unit, unrounded (the chart) and whole (the words). */
  const disp = (x: number) => (lbs ? x * 2.20462 : x);
  const whole = (x: number) => `${Math.round(disp(x))}`;

  const [menu, setMenu] = useState(false);
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const gymWrap = useRef<HTMLSpanElement>(null);
  const gymBtn = useRef<HTMLButtonElement>(null);

  // The gym list closes on a click anywhere else; it opens on the gym it shows.
  useEffect(() => {
    if (!menu) return;
    const down = (ev: PointerEvent) => {
      if (!gymWrap.current?.contains(ev.target as Node)) setMenu(false);
    };
    document.addEventListener("pointerdown", down);
    gymWrap.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener("pointerdown", down);
  }, [menu]);
  const menuKey = (ev: ReactKeyboardEvent<HTMLSpanElement>) => {
    if (ev.key !== "ArrowDown" && ev.key !== "ArrowUp") return;
    ev.preventDefault();
    const items = [...ev.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = at < 0 ? 0 : (at + (ev.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
  };
  const pickGym = (g: string | null) => {
    setGym(g);
    setMenu(false);
    setOpen(false);
    setHover(null);
    gymBtn.current?.focus();
  };
  const pickRange = (r: Win) => {
    setRangeKey(r);
    setOpen(false);
    setHover(null);
  };

  // The heaviest top set in the range (an assisted lift: the least help): ties go to more reps.
  const heaviest = ss.reduce<{ w: number; r: number } | null>((acc, s) => {
    for (const set of s.sets) if (!acc || (assisted ? set.weight < acc.w : set.weight > acc.w) || (set.weight === acc.w && set.reps > acc.r)) acc = { w: set.weight, r: set.reps };
    return acc;
  }, null);
  const changePct = judged.change == null ? null : Math.round(judged.change * 100);

  // No suggestion and no message written for the coach (4 Nov, Alex: "there should not be any sort of pre written text";
  // "just have that message Alex"): Message {First} opens the chat on an empty bar.
  // 7 days and 30 days list every session in them; only All time folds after the latest 4 (4 Nov, Alex: "there's no point
  // in showing all the sessions there. It should only be in All Time"). One height across the three (4 Nov, Alex: the
  // card changed size on a switch): the log keeps the room of the fullest window offered, its fold a row of it, so
  // switching never moves the card.
  const logRows = (w: Win) => {
    const len = js[w].sessions.length;
    return w === "all" ? Math.min(4, len) + (len > 4 ? 1 : 0) : len;
  };
  const logSlots = Math.max(...offered.map(logRows));
  const folds = view === "all" && n > 4;

  // The chart: measured, so the dots stay round at any width.
  const [chartEl, setChartEl] = useState<HTMLDivElement | null>(null);
  const [W, setW] = useState(580);
  useEffect(() => {
    if (!chartEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([en]) => setW(Math.max(120, Math.round(en.contentRect.width))));
    ro.observe(chartEl);
    return () => ro.disconnect();
  }, [chartEl]);

  // The window picked alone (4 Nov, Alex: the window before in grey "is not self-explanatory enough"), by the calendar in
  // 7 days and 30 days: its first day, its middle and today under it.
  const winFrom = view === "all" ? null : daysBefore(today, (view === "7" ? 7 : 30) - 1);

  const chart = (() => {
    if (n === 0) return null;
    const pw = W - CH.l - CH.r;
    const ph = CH.h - CH.t - CH.b;
    const es = ss.map((s) => disp(s.best.e1rm));
    const mn = Math.min(...es);
    const mx = Math.max(...es);
    const pad = Math.max((mx - mn) * 0.12, 1);
    let lo = mn - pad;
    let hi = mx + pad;
    const least = mx * 0.08;
    if (hi - lo < least) {
      const mid = (hi + lo) / 2;
      lo = mid - least / 2;
      hi = mid + least / 2;
    }
    const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((q) => Math.floor(hi / q) - Math.ceil(lo / q) + 1 <= 4) ?? 2000;
    const ticks: number[] = [];
    for (let k = Math.ceil(lo / step) * step; k <= hi + 1e-9; k += step) ticks.push(k);
    const yy = (val: number) => CH.t + ((hi - val) / (hi - lo)) * ph;
    // Spaced by date; by order when a date is missing or every session is on one day. A window spans its own days,
    // whatever was logged in them.
    const ts = ss.map((s) => dayMs(s.date));
    const t0 = winFrom ? dayMs(winFrom) : ts[0];
    const t1 = winFrom ? dayMs(today) : ts[n - 1];
    const byTime = ts.every(Number.isFinite) && t1 > t0 && (n > 1 || !!winFrom);
    const pts = ss.map((s, i) => ({
      x: byTime ? CH.l + ((ts[i] - t0) / (t1 - t0)) * pw : n < 2 ? CH.l + pw / 2 : CH.l + (i / (n - 1)) * pw,
      y: yy(es[i]),
      s,
      c: stalling && i > judged.bestAt ? RUST : PURPLE,
    }));
    // One smooth curve through every session (the weight line's, monotoneCurve), drawn in stretches by colour.
    const segs = monotoneSegments(pts);
    const path = (a: number, b: number) => `M${pts[a].x.toFixed(2)} ${pts[a].y.toFixed(2)} ${segs.slice(a, b).join(" ")}`;
    // The best (4 Nov, Alex: the ring "is really weird"): a dashed line from it to the y axis, its figure there in purple,
    // the grid figures it would sit on left out.
    const bestY = n > 1 ? pts[judged.bestAt].y : null;
    const shown = bestY == null ? ticks : ticks.filter((k) => Math.abs(yy(k) - bestY) > 12);
    return { pw, ph, ticks, shown, yy, pts, path, bestY };
  })();
  const hv = chart && hover != null && hover < n ? chart.pts[hover] : null;
  const nearest = (clientX: number, el: HTMLElement) => {
    if (!chart) return;
    const m = clientX - el.getBoundingClientRect().left;
    let k = 0;
    chart.pts.forEach((p, i) => {
      if (Math.abs(p.x - m) < Math.abs(chart.pts[k].x - m)) k = i;
    });
    setHover(k);
  };

  const rows = [...ss].reverse();
  const dateCol = Math.max(88, logDateWidth(rows.map((s) => s.date).filter((d): d is string => !!d)));
  const targetParts = [targets.sets ? `${targets.sets} × ${targets.reps || "?"}` : "", targets.kg != null ? `${kg(targets.kg)} ${unit}` : "", targets.rpe != null ? `RPE ${targets.rpe}` : ""];

  const gymFact =
    gymSwitch ? (
      <span
        className="exp-gw"
        ref={gymWrap}
        onKeyDown={menuKey}
        onBlur={(ev) => {
          // Tab out of the list closes it (a click elsewhere is the pointerdown above).
          if (ev.relatedTarget && !ev.currentTarget.contains(ev.relatedTarget as Node)) setMenu(false);
        }}
      >
        <button ref={gymBtn} type="button" className="exp-gym" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          <span className="exp-gn" title={gym ?? undefined}>
            {gym ?? "All gyms"}
          </span>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {menu && (
          <span className="exp-menu" role="menu" aria-label="Gym">
            {[null, ...gymOptions].map((g) => (
              <button key={g ?? ""} type="button" role="menuitemradio" aria-checked={g === gym} className={g === gym ? "on" : ""} title={g ?? undefined} onClick={() => pickGym(g)}>
                <span>{g ?? "All gyms"}</span>
                {g === gym && (
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m5 12 5 5 9-10" />
                  </svg>
                )}
              </button>
            ))}
          </span>
        )}
      </span>
    ) : gymOptions[0] ? (
      <span className="exp-gn" title={gymOptions[0]}>
        {gymOptions[0]}
      </span>
    ) : (
      ""
    );

  const seg =
    offered.length > 1 ? (
      <div className="rd-btn-group" role="radiogroup" aria-label="Range">
        {offered.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={view === k} className={view === k ? "on" : ""} onClick={() => pickRange(k)}>
            {WIN_LABEL[k]}
          </button>
        ))}
      </div>
    ) : null;

  const row = (s: (typeof ss)[number], i: number) => {
    const ws = s.sets.map((x) => x.weight);
    const same = ws.every((w) => w === ws[0]);
    const text = same ? `${kg(ws[0])} × ${s.sets.map((x) => x.reps).join(", ")}` : s.sets.map((x) => `${kg(x.weight)} × ${x.reps}`).join(", ");
    const rpe = s.sets.filter((x) => x.rpe != null).map((x) => x.rpe);
    const st = rowStatus(s.sets, range, targets.kg, assisted);
    return (
      <div key={`${s.date}-${s.planWeek}-${i}`} className="exp-lr">
        <span className="rd-logdate">{s.date ? logDate(s.date) : "—"}</span>
        <span className="exp-w">{s.planWeek > 0 ? `W${s.planWeek}` : ""}</span>
        <span className="exp-sets" title={rpe.length ? `${text} | RPE ${rpe.join(", ")}` : text}>
          {text}
          {rpe.length > 0 && (
            <>
              <Sep />
              <small>RPE {rpe.join(", ")}</small>
            </>
          )}
        </span>
        <span className={`exp-e${s === best && n > 1 ? " best" : ""}`}>{whole(s.best.e1rm)}</span>
        <span>{st === "top" ? <span className="exp-state good">Top of range</span> : st === "below" ? <span className="exp-state warn">Below</span> : null}</span>
      </div>
    );
  };

  return (
    <DialogContent
      className="dlh exp"
      aria-describedby={undefined}
      aria-label={`${exerciseName} progress`}
      onOpenAutoFocus={(ev) => ev.preventDefault()}
      onEscapeKeyDown={(ev) => {
        // Escape shuts the gym list first, then the pop-up.
        if (!menu) return;
        ev.preventDefault();
        setMenu(false);
        gymBtn.current?.focus();
      }}
    >
      <div className="dlh-head">
        <DialogTitle className="dlh-title">{exerciseName}</DialogTitle>
        <button type="button" className="dlh-x" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      <div className="exp-facts">
        {n > 0 && <span className={`exp-state${v.tone ? ` ${v.tone}` : ""}`}>{v.label}</span>}
        <span>
          <SepJoin parts={[...targetParts, gymFact]} />
        </span>
      </div>

      {nAll === 0 ? (
        // An assisted lift is weighed by the body weight less the help: without a body weight, its sessions can't be judged.
        <div className="exp-empty">{assisted && bodyKg == null && atGym.some((s) => s.sets.length > 0) ? "No body weight yet" : "None yet"}</div>
      ) : n === 0 ? (
        // The window clicked holds no session (the others do): the capsule to reach them.
        <>
          <div className="exp-hl">
            <div />
            {seg}
          </div>
          <div className="exp-empty">None</div>
        </>
      ) : (
        <>
          <div className="exp-hl">
            <div>
              <div className="exp-lab">Estimated 1RM</div>
              <div className="exp-big">
                <b>
                  {whole(last!.best.e1rm)} {unit}
                </b>
                {/* The change alone (4 Nov, Alex: "on the 7 days before" said what the capsule says); a lift newer than
                    the window before keeps `since 7/10`, which the capsule doesn't say. */}
                {view !== "all" ? (
                  // The cell's own figure and comparison: the best in the window against the best in the one before.
                  <>
                    <span className={`exp-chg${windowChange != null && windowChange > 0 ? " up" : windowChange != null && windowChange < 0 ? " down" : ""}`}>{cellText(windowChange)}</span>
                    {windowSince && <small>since {dayMonth(windowSince)}</small>}
                    {heaviest && <Sep />}
                  </>
                ) : (
                  changePct != null && (
                    <>
                      <span className={`exp-chg${changePct > 0 ? " up" : changePct < 0 ? " down" : ""}`}>{`${changePct > 0 ? "+" : changePct < 0 ? "−" : ""}${Math.abs(changePct)}%`}</span>
                      {heaviest && <Sep />}
                    </>
                  )
                )}
                {heaviest && (
                  <small>
                    Best set {kg(heaviest.w)} × {heaviest.r}
                  </small>
                )}
              </div>
            </div>
            {seg}
          </div>

          {chart && (
            <div
              className="exp-chart"
              ref={setChartEl}
              onMouseMove={(ev) => nearest(ev.clientX, ev.currentTarget)}
              onMouseLeave={() => setHover(null)}
            >
              <svg width={W} height={CH.h} viewBox={`0 0 ${W} ${CH.h}`} role="img" aria-label={`Estimated 1RM from ${whole(ss[0].best.e1rm)} to ${whole(last!.best.e1rm)} ${unit} over ${n} session${n === 1 ? "" : "s"}`}>
                {chart.ticks.map((k) => (
                  <line key={k} x1={CH.l} x2={W - CH.r} y1={chart.yy(k)} y2={chart.yy(k)} stroke="#EEF0F3" />
                ))}
                {chart.shown.map((k) => (
                  <text key={k} x={CH.l - 10} y={chart.yy(k) + 4} textAnchor="end">
                    {k}
                  </text>
                ))}
                {winFrom ? (
                  // A window: its first day, its middle and today, as a grid axis.
                  <>
                    <text x={CH.l} y={CH.h - 6} textAnchor="start">
                      {dayMonth(winFrom)}
                    </text>
                    <text x={CH.l + chart.pw / 2} y={CH.h - 6} textAnchor="middle">
                      {dayMonth(daysBefore(today, view === "7" ? 3 : 15))}
                    </text>
                    <text x={W - CH.r} y={CH.h - 6} textAnchor="end">
                      {dayMonth(today)}
                    </text>
                  </>
                ) : n < 2 ? (
                  <text x={chart.pts[0].x} y={CH.h - 6} textAnchor="middle">
                    {ss[0].date ? dayMonth(ss[0].date) : ""}
                  </text>
                ) : (
                  <>
                    <text x={chart.pts[0].x} y={CH.h - 6} textAnchor="start">
                      {ss[0].date ? dayMonth(ss[0].date) : ""}
                    </text>
                    <text x={chart.pts[n - 1].x} y={CH.h - 6} textAnchor="end">
                      {last!.date ? dayMonth(last!.date) : ""}
                    </text>
                  </>
                )}
                {hv && <line x1={hv.x} x2={hv.x} y1={CH.t} y2={CH.t + chart.ph} stroke="#141a24" strokeOpacity={0.25} />}
                {chart.bestY != null && best && (
                  <>
                    <line x1={CH.l} x2={chart.pts[judged.bestAt].x} y1={chart.bestY} y2={chart.bestY} stroke={PURPLE} strokeOpacity={0.45} strokeDasharray="3 4" />
                    <text className="exp-best" x={CH.l - 10} y={chart.bestY + 4} textAnchor="end">
                      {whole(best.best.e1rm)}
                    </text>
                  </>
                )}
                {stalling && <line x1={chart.pts[judged.bestAt].x} x2={W - CH.r} y1={chart.pts[judged.bestAt].y} y2={chart.pts[judged.bestAt].y} stroke={RUST} strokeOpacity={0.45} strokeDasharray="3 4" />}
                {/* The line in purple, a stall's stretch rust; no dot a session (the weight line's rule), the latest a
                    dot pulsing (laid over the chart below). */}
                {n > 1 && <path d={chart.path(0, stalling ? judged.bestAt : n - 1)} fill="none" stroke={PURPLE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                {stalling && <path d={chart.path(judged.bestAt, n - 1)} fill="none" stroke={RUST} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                {hv && <circle cx={hv.x} cy={hv.y} r={5} fill="#fff" stroke="#141a24" strokeWidth={1.6} />}
              </svg>
              {/* The latest session, a dot pulsing in the line's colour, as every chart's now (4 Nov, Alex). */}
              <span className="exp-now" aria-hidden="true" style={{ left: chart.pts[n - 1].x, top: chart.pts[n - 1].y, "--exp-c": chart.pts[n - 1].c } as CSSProperties} />
              {chart.pts.map((p, i) => (
                <button
                  key={i}
                  type="button"
                  className="exp-pt"
                  style={{ left: p.x, top: p.y }}
                  aria-label={`${p.s.date ? logDate(p.s.date) : "No date"}: ${kg(p.s.best.set.weight)} ${unit} × ${p.s.best.set.reps}, estimated 1RM ${whole(p.s.best.e1rm)}`}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              ))}
              {hv && (
                <span
                  className="exp-tip"
                  aria-hidden="true"
                  // Over the chart in the room kept for it at the top, never over the line (4 Nov, Alex: "it's blocking the graph").
                  style={{ translate: `clamp(0px, calc(${hv.x.toFixed(1)}px - 50%), calc(${W}px - 100%)) 0` }}
                >
                  <SepJoin parts={[hv.s.date ? logDate(hv.s.date) : null, `${kg(hv.s.best.set.weight)} × ${hv.s.best.set.reps}`, `e1RM ${whole(hv.s.best.e1rm)}`]} />
                </span>
              )}
            </div>
          )}

          <div className="exp-log" style={{ "--exp-dw": `${dateCol}px` } as CSSProperties}>
            <div className="exp-lr head">
              <span>Sessions</span>
              <span />
              <span>Sets</span>
              <span className="exp-e">e1RM</span>
              <span />
            </div>
            {/* One run of sessions, the fold under it (24 Oct, Alex: open, it sat between the latest four and the rest and cut the list). */}
            {(folds && !open ? rows.slice(0, 4) : rows).map(row)}
            {folds && (
              <button type="button" className="exp-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                {open ? "Latest 4" : `All ${rows.length} sessions`}
                <Fold open={open} />
              </button>
            )}
            {/* The fullest window's room, a row and the fold alike 41px (exp-lr, exp-more). */}
            {Array.from({ length: Math.max(0, logSlots - logRows(view)) }, (_, i) => (
              <div key={`room-${i}`} className="exp-lr room" aria-hidden="true" />
            ))}
          </div>
        </>
      )}

      <div className="dlh-foot">
        <button type="button" className="dlh-go" onClick={onMessage}>
          Message {firstName}
        </button>
      </div>
    </DialogContent>
  );
}
