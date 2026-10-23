"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { DialogContent, DialogTitle } from "../../../components/ui/dialog";
import { dayMonth, logDate, logDateWidth } from "../../../lib/dayMonth";
import { RULES, isAssisted, judge, liftedKg, nudgeFor, repRange, rowStatus, type Session, type Verdict } from "../../../lib/progressRules";
import { Fold } from "../Fold";
import { Sep, SepJoin } from "../Sep";

// An exercise's progress, for the coach (23 Oct, Alex: mockup B). The .dlh card: the name, the verdict as a state pill
// with the targets and the gym as facts, the estimated one-rep max now with its change and the best set, 30 days | All
// time, a stall's fix, the e1RM per session as a line spaced by date, the sessions as a log. The maths lives in
// lib/progressRules.ts.

const VERDICT: Record<Verdict, { label: string; tone: string }> = {
  progressing: { label: "Progressing", tone: "good" },
  stalling: { label: "Stalling", tone: "warn" },
  dropping: { label: "Dropping", tone: "bad" },
  none: { label: "Too early", tone: "" },
};
const DAY = 86400000;
const PURPLE = "#3a3390";
const RUST = "#b8471f";
/** The chart's box: its height and the room kept for the y figures (left), the dates (bottom) and the dots. */
const CH = { h: 220, l: 34, r: 10, t: 16, b: 26 };
/** A yyyy-mm-dd day (read as that calendar day) or a timestamp, in ms; NaN when there is none. */
const dayMs = (d: string | null) => (d ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T00:00:00` : d).getTime() : NaN);
const reps = (lo: number, hi: number) => (lo === hi ? `${lo}` : `${lo}–${hi}`);

export type ProgressSession = Session & { gym: string | null };

export default function ExerciseProgressDialog({
  exerciseName,
  firstName,
  targets,
  gyms,
  sessions: all,
  today,
  lbs,
  bodyKg,
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
  /** The client's body weight now: an assisted lift is judged by it less the help (23 Oct, Alex). */
  bodyKg: number | null;
  stepKg?: number;
  onMessage: (draft: string) => void;
  onClose: () => void;
}) {
  const range = repRange(targets.reps);
  // An assisted lift's kg is help: less is stronger, so it is weighed by what was lifted (body weight less the help).
  const assisted = isAssisted(exerciseName);
  // The gym: the home one, unless the latest session was elsewhere; the coach can switch.
  const latest = [...all].sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1))[0];
  const gymOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...gyms, ...all.map((s) => s.gym ?? "")].filter((g) => g && !seen.has(g) && seen.add(g));
  }, [gyms, all]);
  const [gym, setGym] = useState<string | null>(gymOptions.length > 1 ? (latest?.gym && gymOptions.includes(latest.gym) ? latest.gym : gymOptions[0]) : null);
  const atGym = useMemo(() => (gym ? all.filter((s) => (s.gym ?? gymOptions[0]) === gym) : all), [all, gym, gymOptions]);
  // Counted in UTC both ways, so the day isn't shifted by the time zone.
  const [ty, tm, td] = today.split("-").map(Number);
  const since30 = new Date(Date.UTC(ty, tm - 1, td) - 30 * DAY).toISOString().slice(0, 10);
  const last30 = useMemo(() => atGym.filter((s) => (s.date ?? "") >= since30), [atGym, since30]);
  const [rangeKey, setRangeKey] = useState<"30" | "all">(last30.filter((s) => s.sets.length).length >= 3 ? "30" : "all");
  const j30 = useMemo(() => judge(last30, (w) => liftedKg(w, assisted, bodyKg)), [last30, assisted, bodyKg]);
  const jAll = useMemo(() => judge(atGym, (w) => liftedKg(w, assisted, bodyKg)), [atGym, assisted, bodyKg]);
  // 30 days | All time only while the two hold different sessions (no choice that changes nothing); else all time.
  const both = j30.sessions.length > 0 && j30.sessions.length < jAll.sessions.length;
  const judged = both && rangeKey === "30" ? j30 : jAll;
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
  const pickGym = (g: string) => {
    setGym(g);
    setMenu(false);
    setOpen(false);
    setHover(null);
    gymBtn.current?.focus();
  };
  const pickRange = (r: "30" | "all") => {
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

  // A stall's fix: the next load asked for (a step heavier, an assisted lift a step less help) at the range's lower reps,
  // or one more rep at the best's load (an assisted lift already at no help: one more rep); the same rule as the chat
  // nudge (nudgeFor), written here in the coach's unit so the pill and the message it sends say the same.
  const suggest = (() => {
    if (!stalling || !best) return null;
    const b = best.best.set;
    const step = stepKg ?? RULES.stepKg;
    const help = assisted ? " of help" : "";
    const name = exerciseName.charAt(0).toLowerCase() + exerciseName.slice(1);
    const say = (pill: string, next: string) => ({ pill, draft: `Hey ${firstName}, ${name} has been at ${kg(b.weight)} × ${b.reps} for a few sessions. Let’s try ${next} next session 💪` });
    if (range && b.reps >= range.max && !(assisted && b.weight <= 0)) {
      const load = `${kg(assisted ? Math.max(0, b.weight - step) : b.weight + step)} ${unit}${help}`;
      const r = reps(range.min, Math.max(range.min, range.max - 2));
      return say(`${load} × ${r}`, `${load} for ${r} reps`);
    }
    return say(`${kg(b.weight)} ${unit}${help} × ${b.reps + 1}`, `${b.reps + 1} reps at ${kg(b.weight)} ${unit}${help}`);
  })();
  const draft = suggest?.draft ?? nudgeFor(judged, exerciseName, firstName, range, stepKg, assisted);
  const chatIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4z" />
    </svg>
  );

  // The chart: measured, so the dots stay round at any width.
  const [chartEl, setChartEl] = useState<HTMLDivElement | null>(null);
  const [W, setW] = useState(580);
  useEffect(() => {
    if (!chartEl || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([en]) => setW(Math.max(120, Math.round(en.contentRect.width))));
    ro.observe(chartEl);
    return () => ro.disconnect();
  }, [chartEl]);

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
    const step = [1, 2, 5, 10, 20, 50].find((q) => Math.floor(hi / q) - Math.ceil(lo / q) + 1 <= 4) ?? 100;
    const ticks: number[] = [];
    for (let k = Math.ceil(lo / step) * step; k <= hi + 1e-9; k += step) ticks.push(k);
    const yy = (val: number) => CH.t + ((hi - val) / (hi - lo)) * ph;
    // Spaced by date; by order when a date is missing or every session is on one day.
    const ts = ss.map((s) => dayMs(s.date));
    const byTime = n > 1 && ts.every(Number.isFinite) && ts[n - 1] > ts[0];
    const pts = ss.map((s, i) => ({
      x: n < 2 ? CH.l + pw / 2 : byTime ? CH.l + ((ts[i] - ts[0]) / (ts[n - 1] - ts[0])) * pw : CH.l + (i / (n - 1)) * pw,
      y: yy(es[i]),
      s,
      c: stalling && i > judged.bestAt ? RUST : PURPLE,
    }));
    const path = (a: number, b: number) =>
      pts
        .slice(a, b + 1)
        .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ");
    return { pw, ph, ticks, yy, pts, path };
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
    gymOptions.length > 1 ? (
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
            {gym}
          </span>
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" aria-hidden="true">
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {menu && (
          <span className="exp-menu" role="menu" aria-label="Gym">
            {gymOptions.map((g) => (
              <button key={g} type="button" role="menuitemradio" aria-checked={g === gym} className={g === gym ? "on" : ""} title={g} onClick={() => pickGym(g)}>
                <span>{g}</span>
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

  const seg = (
    <div className="rd-btn-group" role="radiogroup" aria-label="Range">
      <button type="button" role="radio" aria-checked={rangeKey === "30"} className={rangeKey === "30" ? "on" : ""} onClick={() => pickRange("30")}>
        30 days
      </button>
      <button type="button" role="radio" aria-checked={rangeKey === "all"} className={rangeKey === "all" ? "on" : ""} onClick={() => pickRange("all")}>
        All time
      </button>
    </div>
  );

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

      {n === 0 ? (
        // An assisted lift is weighed by the body weight less the help: without a body weight, its sessions can't be judged.
        <div className="exp-empty">{assisted && bodyKg == null && atGym.some((s) => s.sets.length > 0) ? "No body weight yet" : "None yet"}</div>
      ) : (
        <>
          <div className="exp-hl">
            <div>
              <div className="exp-lab">Estimated 1RM</div>
              <div className="exp-big">
                <b>
                  {whole(last!.best.e1rm)} {unit}
                </b>
                {changePct != null && (
                  <>
                    <span className={`exp-chg${changePct > 0 ? " up" : changePct < 0 ? " down" : ""}`}>{`${changePct > 0 ? "+" : changePct < 0 ? "−" : ""}${Math.abs(changePct)}%`}</span>
                    <small>since {ss[0].date ? dayMonth(ss[0].date) : "—"}</small>
                    {heaviest && <Sep />}
                  </>
                )}
                {heaviest && (
                  <small>
                    Best set {kg(heaviest.w)} × {heaviest.r}
                  </small>
                )}
              </div>
            </div>
            {both && seg}
          </div>

          {stalling && suggest && (
            <div className="exp-fix">
              <span>
                No new best in {n - 1 - judged.bestAt} session{n - 1 - judged.bestAt === 1 ? "" : "s"}.
              </span>
              <button type="button" className="exp-pill" onClick={() => onMessage(draft)}>
                {chatIcon}
                Suggest {suggest.pill}
              </button>
            </div>
          )}
          {judged.verdict === "dropping" && last && best && (
            <div className="exp-fix">
              <span>{Math.round((1 - last.best.e1rm / best.best.e1rm) * 100)}% under the best.</span>
              <button type="button" className="exp-pill" onClick={() => onMessage(draft)}>
                {chatIcon}
                Ask about recovery
              </button>
            </div>
          )}

          {chart && (
            <div
              className="exp-chart"
              ref={setChartEl}
              onMouseMove={(ev) => nearest(ev.clientX, ev.currentTarget)}
              onMouseLeave={() => setHover(null)}
            >
              <svg width={W} height={CH.h} viewBox={`0 0 ${W} ${CH.h}`} role="img" aria-label={`Estimated 1RM from ${whole(ss[0].best.e1rm)} to ${whole(last!.best.e1rm)} ${unit} over ${n} session${n === 1 ? "" : "s"}`}>
                {chart.ticks.map((k) => {
                  const y = chart.yy(k);
                  return (
                    <g key={k}>
                      <line x1={CH.l} x2={W - CH.r} y1={y} y2={y} stroke="#EEF0F3" />
                      <text x={CH.l - 10} y={y + 4} textAnchor="end">
                        {k}
                      </text>
                    </g>
                  );
                })}
                {n < 2 ? (
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
                {hv && <line x1={hv.x} x2={hv.x} y1={CH.t} y2={CH.t + chart.ph} stroke="#E1E5EB" />}
                {stalling && <line x1={chart.pts[judged.bestAt].x} x2={W - CH.r} y1={chart.pts[judged.bestAt].y} y2={chart.pts[judged.bestAt].y} stroke={RUST} strokeOpacity={0.45} strokeDasharray="3 4" />}
                {n > 1 && <path d={chart.path(0, stalling ? judged.bestAt : n - 1)} fill="none" stroke={PURPLE} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                {stalling && <path d={chart.path(judged.bestAt, n - 1)} fill="none" stroke={RUST} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />}
                {hv && <circle cx={hv.x} cy={hv.y} r={8} fill={hv.c} fillOpacity={0.14} />}
                {chart.pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={i === n - 1 ? 4.5 : 3} fill={p.c} stroke="#fff" strokeWidth={2} />
                ))}
                {n > 1 && <circle cx={chart.pts[judged.bestAt].x} cy={chart.pts[judged.bestAt].y} r={8.5} fill="none" stroke={PURPLE} strokeWidth={1.5} />}
              </svg>
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
                  style={{ translate: `clamp(0px, calc(${hv.x.toFixed(1)}px - 50%), calc(${W}px - 100%)) ${hv.y < 44 ? `${(hv.y + 14).toFixed(1)}px` : `calc(${(hv.y - 14).toFixed(1)}px - 100%)`}` }}
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
            {rows.slice(0, 4).map(row)}
            {rows.length > 4 && (
              <>
                <button type="button" className="exp-more" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  All {rows.length} sessions
                  <Fold open={open} />
                </button>
                {open && rows.slice(4).map((s, i) => row(s, i + 4))}
              </>
            )}
          </div>
        </>
      )}

      <div className="dlh-foot">
        <button type="button" className="dlh-go" onClick={() => onMessage(draft)}>
          Message {firstName}
        </button>
      </div>
    </DialogContent>
  );
}
