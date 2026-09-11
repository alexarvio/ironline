// Goal tracking, computed the same way on both sides of the app.
//
// A goal is a sentence the coach writes, optionally tied to something the
// app already measures: a check-in figure heading for a target by a date,
// an exercise reaching a weight for reps, or a daily habit hit N days a
// week. This module turns a goal plus the raw numbers behind it into the
// row the client sees. It imports nothing from the store, so the coach's
// "Client sees" preview and the client's Home render from one function.

export type GoalTracking =
  | { kind: "metric"; metricKey: string; op: "<=" | ">="; target: number; byDate: string }
  | { kind: "exercise"; exerciseId: number; weight: number; reps: number; maxRpe?: number | null }
  | { kind: "habit"; metricId: number; op: "<=" | ">="; value: number; daysPerWeek: number };

export type SeriesPoint = { date: string; value: number };
export type LoggedSet = { weight: number | null; reps: number | null; rpe: number | null; date: string };

/** The raw numbers a goal is judged against, gathered by the server. */
export type GoalContext = {
  /** ISO dates, local. */
  today: string;
  createdAt: string;
  metric?: { name: string; unit: string; series: SeriesPoint[] };
  exercise?: { name: string; sets: LoggedSet[] };
  habit?: { name: string; weekValues: SeriesPoint[] };
};

export type GoalView = {
  id: number;
  text: string;
  done: boolean;
  kind: "metric" | "exercise" | "habit" | "none";
  /** Dot colour. "muted" is the hollow dot of an untracked goal. */
  tone: "green" | "orange" | "muted";
  reached: boolean;
  /** Metric progress 0..1, or null. */
  bar: number | null;
  /** Under the bar: "77.6 kg · 2.6 to go". */
  barLabel: string | null;
  /** Habit: N segments, done filled. */
  segments: { total: number; done: number } | null;
  /** Exercise: left "Leg Press · best set"; right "best 80 × 8 · 10 kg to go". */
  left: string | null;
  right: string | null;
  /** Small grey line under everything. */
  sub: string | null;
};

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const addDaysIso = (date: string, n: number) => {
  const d = parse(date);
  d.setDate(d.getDate() + n);
  return iso(d);
};
export const fmtNum = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10));
export const fmtDate = (isoDate: string) => parse(isoDate).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const weekday = (isoDate: string) => parse(isoDate).toLocaleDateString("en-US", { weekday: "long" });

/** Slope per day from a least-squares fit; null with fewer than two points. */
export function slopePerDay(points: SeriesPoint[]): number | null {
  if (points.length < 2) return null;
  const t0 = parse(points[0].date).getTime();
  const xs = points.map((p) => (parse(p.date).getTime() - t0) / DAY);
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  const den = xs.reduce((s, x) => s + (x - mx) * (x - mx), 0);
  if (den === 0) return null;
  return xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / den;
}

/** Points from the last four weeks, for the pace projection. */
export function recentPoints(series: SeriesPoint[], today: string): SeriesPoint[] {
  const from = addDaysIso(today, -28);
  return series.filter((p) => p.date >= from);
}

export function metricPace(series: SeriesPoint[], today: string): number | null {
  return slopePerDay(recentPoints(series, today));
}

const meets = (op: "<=" | ">=", value: number, target: number) => (op === ">=" ? value >= target : value <= target);

export function computeGoalView(
  goal: { id: number; text: string; done: boolean; tracking: GoalTracking | null },
  ctx: GoalContext
): GoalView {
  const base: GoalView = {
    id: goal.id,
    text: goal.text,
    done: goal.done,
    kind: "none",
    tone: "muted",
    reached: false,
    bar: null,
    barLabel: null,
    segments: null,
    left: null,
    right: null,
    sub: "Reviewed with your coach",
  };
  const t = goal.tracking;
  if (!t) return goal.done ? { ...base, reached: true, tone: "green" } : base;

  if (t.kind === "metric") {
    const m = ctx.metric;
    const series = m?.series ?? [];
    const name = m?.name ?? "Metric";
    const unit = m?.unit ?? "";
    if (series.length === 0) {
      return { ...base, kind: "metric", tone: "orange", sub: `${name} · nothing logged yet` };
    }
    const latest = series[series.length - 1];
    // The starting line is the first value after the goal was set; if none
    // yet, the last one before it, so day one already shows the full road.
    const after = series.filter((p) => p.date >= ctx.createdAt);
    const start = (after[0] ?? series[series.length - 1]).value;
    const reachedAt = after.find((p) => meets(t.op, p.value, t.target)) ?? (meets(t.op, latest.value, t.target) ? latest : null);
    const span = start - t.target;
    const progress = span === 0 ? 1 : Math.max(0, Math.min(1, (start - latest.value) / span));
    const toGo = Math.abs(t.target - latest.value);
    const slope = metricPace(series, ctx.today);
    const projected = slope == null ? null : latest.value + slope * Math.max(0, daysBetween(latest.date, t.byDate));
    const onPace = projected == null ? null : meets(t.op, projected, t.target);
    const reached = !!reachedAt;
    return {
      ...base,
      kind: "metric",
      tone: reached || onPace !== false ? "green" : "orange",
      reached,
      bar: reached ? 1 : progress,
      barLabel: reached ? `${fmtNum(latest.value)} ${unit}`.trim() : `${fmtNum(latest.value)} ${unit} · ${fmtNum(toGo)} to go`.replace("  ", " "),
      sub: reached
        ? `Reached ${fmtDate(reachedAt!.date)}`
        : onPace === true
        ? `${name} · on pace for ${fmtDate(t.byDate)}`
        : onPace === false
        ? `${name} · behind pace`
        : `${name} · by ${fmtDate(t.byDate)}`,
    };
  }

  if (t.kind === "exercise") {
    const e = ctx.exercise;
    const name = e?.name ?? "Exercise";
    const sets = (e?.sets ?? []).filter((s) => s.weight != null && s.reps != null) as (LoggedSet & { weight: number; reps: number })[];
    const qualifies = (s: LoggedSet & { weight: number; reps: number }) =>
      s.weight >= t.weight && s.reps >= t.reps && (t.maxRpe == null || s.rpe == null || s.rpe <= t.maxRpe);
    const hit = sets.filter(qualifies).sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;
    const best = sets.slice().sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0] ?? null;
    if (hit) {
      return {
        ...base,
        kind: "exercise",
        tone: "green",
        reached: true,
        left: `${name} · best set`,
        right: `${fmtNum(hit.weight)} × ${hit.reps} · reached ${weekday(hit.date)}`,
        sub: null,
      };
    }
    return {
      ...base,
      kind: "exercise",
      tone: "orange",
      left: `${name} · best set`,
      right: best ? `best ${fmtNum(best.weight)} × ${best.reps} · ${fmtNum(Math.max(0, t.weight - best.weight))} kg to go` : "no sets logged yet",
      sub: null,
    };
  }

  // habit
  const h = ctx.habit;
  const name = h?.name ?? "Check-in";
  const done = (h?.weekValues ?? []).filter((p) => meets(t.op, p.value, t.value)).length;
  const dow = (parse(ctx.today).getDay() + 6) % 7; // Monday 0
  const daysLeft = 6 - dow;
  const stillPossible = done >= t.daysPerWeek || daysLeft >= t.daysPerWeek - done;
  return {
    ...base,
    kind: "habit",
    tone: stillPossible ? "green" : "orange",
    reached: done >= t.daysPerWeek,
    segments: { total: t.daysPerWeek, done: Math.min(done, t.daysPerWeek) },
    right: `${Math.min(done, t.daysPerWeek)} of ${t.daysPerWeek} · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
    sub: `${name} · daily check-in`,
  };
}

/** One line describing the tracking, for the coach's list. */
export function describeTracking(t: GoalTracking | null, names: { metric?: string; unit?: string; exercise?: string; habit?: string }): string {
  if (!t) return "Text only";
  if (t.kind === "metric") return `${names.metric ?? "Metric"} ${t.op} ${fmtNum(t.target)}${names.unit ? ` ${names.unit}` : ""} by ${fmtDate(t.byDate)}`;
  if (t.kind === "exercise") return `${names.exercise ?? "Exercise"} ${fmtNum(t.weight)} kg × ${t.reps}${t.maxRpe != null ? ` @ ≤${t.maxRpe}` : ""}`;
  return `${names.habit ?? "Check-in"} ${t.op} ${fmtNum(t.value)} · ${t.daysPerWeek} days a week`;
}
