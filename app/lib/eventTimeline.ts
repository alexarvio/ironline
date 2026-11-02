// Home's events row (15 Oct): one horizontal line of the client's events,
// opened on today. Pure: the window, the labels and the relative "when" for
// each item, so the card only draws.

import { nextOccurrence, repeatDays, type EventRepeat } from "./eventRepeat";
import { GOAL_COLOR, GOAL_RGB, TARGET_ICON } from "./weightGoal";

/** A weight goal's look on every client timeline and its notification (2 Nov, Alex): lifestyle beige and the target. */
export const GOAL_CHROME = { label: "Weight goal", color: GOAL_COLOR, rgb: GOAL_RGB, icon: TARGET_ICON };

/** What the row needs of a weight goal: its facts, already in the client's unit. */
export type TimelineGoal = { unit: "kg" | "lbs"; toGo: number | null; settled: boolean; verdictWord: string | null };

export type TimelineEvent = { id: number; kind: string | null; title: string; start: string; end: string; /** A phase of the plan on the timeline: its track colours it. */ phase?: "training" | "nutrition" | "lifestyle" | null; /** Repeating (19 Oct). */ repeat?: EventRepeat | null; /** A weight goal on its date (2 Nov, Alex). */ goal?: TimelineGoal | null };

// `when` is the item's facts, drawn parted by a short bar (2 Nov: they were joined by a middle dot; rules §6).
export type TimelineItem =
  | { key: string; slot: "past" | "today" | "upcoming"; event: TimelineEvent; label: string; when: string[] }
  | { key: string; slot: "today"; event: null; label: "Today"; when: string[] }
  | { key: string; slot: "more"; event: null; label: ""; when: string[] };

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayMon = (iso: string) => `${parse(iso).getDate()} ${MONTHS[parse(iso).getMonth()]}`;
const dayOnly = (iso: string) => String(parse(iso).getDate());

const PAST = 5;
const UPCOMING = 8;

/** An ongoing stretch that began earlier: a supplement started, a phase of life. Reads as "Started …", in the past. */
const ongoing = (e: TimelineEvent, today: string) => e.kind === "supplement" && e.start < today;

/** "In 7 days | 22 Oct": the countdown, then the date it starts (16 Oct). */
export function whenUpcoming(today: string, start: string): string[] {
  const n = daysBetween(today, start);
  const rel = n <= 1 ? "Tomorrow" : n < 21 ? `In ${n} days` : n <= 60 ? `In ${Math.round(n / 7)} weeks` : null;
  return rel ? [rel, dayMon(start)] : [dayMon(start)];
}

export function whenPast(e: TimelineEvent, today: string): string[] {
  if (ongoing(e, today)) return [`Since ${dayMon(e.start)}`];
  if (e.start === e.end) return [dayMon(e.start)];
  const sameMonth = e.start.slice(0, 7) === e.end.slice(0, 7);
  // Thin spaces around the dash.
  return [sameMonth ? `${dayOnly(e.start)} – ${dayMon(e.end)}` : `${dayMon(e.start)} – ${dayMon(e.end)}`];
}

export function whenToday(e: TimelineEvent, today: string): { label: string; when: string[] } {
  // Repeating (19 Oct): today if it is one of its days, else when it comes next.
  if (e.repeat) {
    const next = nextOccurrence(e.start, e.end, e.repeat, today);
    if (next === today) return { label: "Today", when: [repeatDays(e.repeat.days)] };
    return { label: "Now", when: [next ? `Next ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][((parse(next).getDay() + 6) % 7)]} ${dayMon(next)}` : repeatDays(e.repeat.days)] };
  }
  if (e.start < today && e.end > today) return { label: "Now", when: [`Until ${dayMon(e.end)}`] };
  if (e.start < today && e.end === today) return { label: "Now", when: ["Last day"] };
  if (e.start === today && e.end > today) return { label: e.kind === "supplement" ? "Starts today" : "Now", when: [e.kind === "supplement" ? "From today" : `Until ${dayMon(e.end)}`] };
  return { label: "Today", when: ["All day"] };
}

/** A weight goal's facts (2 Nov, Alex): `In 48 days | 5.6 kg to go`, `Today | 5.6 kg to go`; once settled (or past),
    its verdict word alone. Its label is always `Weight goal`. */
export function whenGoal(e: TimelineEvent, g: TimelineGoal, today: string): string[] {
  if (g.settled || e.start < today) return [g.verdictWord ?? dayMon(e.start)];
  const n = daysBetween(today, e.start);
  const toGo = g.toGo != null && g.toGo > 0 ? `${g.toGo} ${g.unit} to go` : null;
  // As short as an event's (the row's items are 140px): days under three weeks, then weeks, then the day itself.
  const when = n === 0 ? "Today" : n === 1 ? "Tomorrow" : n < 21 ? `In ${n} days` : n <= 60 ? `In ${Math.round(n / 7)} weeks` : dayMon(e.start);
  return [when, toGo].filter((x): x is string => !!x);
}

const byStart = (a: TimelineEvent, b: TimelineEvent) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id);

/** The window: the last 5 past, today's (or a placeholder), the next 8, then See all. Returns the items and today's index. */
export function buildTimeline(events: TimelineEvent[], today: string): { items: TimelineItem[]; todayIndex: number } {
  const list = [...events].sort(byStart);
  // Today: covers today, except an ongoing supplement from before (that sits in the past as Started). Multi-day first, then by start.
  const todays = list
    .filter((e) => e.start <= today && e.end >= today && !ongoing(e, today))
    .sort((a, b) => Number(b.start !== b.end) - Number(a.start !== a.end) || byStart(a, b));
  const todayIds = new Set(todays.map((e) => e.id));
  const past = list.filter((e) => !todayIds.has(e.id) && (e.end < today || ongoing(e, today))).slice(-PAST);
  const upcoming = list.filter((e) => e.start > today).slice(0, UPCOMING);

  const items: TimelineItem[] = [];
  // A weight goal says what it is, `Weight goal`, and its own facts, wherever it sits (2 Nov, Alex).
  const goalItem = (e: TimelineEvent) => (e.goal ? { label: GOAL_CHROME.label, when: whenGoal(e, e.goal, today) } : null);
  past.forEach((e, i) => {
    const last = i === past.length - 1;
    items.push({ key: `p${e.id}`, slot: "past", event: e, label: last ? "Last" : ongoing(e, today) ? "Started" : "Done", when: whenPast(e, today), ...goalItem(e) });
  });
  const todayIndex = items.length;
  if (todays.length === 0) items.push({ key: "today", slot: "today", event: null, label: "Today", when: [] });
  for (const e of todays) items.push({ key: `t${e.id}`, slot: "today", event: e, ...whenToday(e, today), ...goalItem(e) });
  upcoming.forEach((e, i) => items.push({ key: `u${e.id}`, slot: "upcoming", event: e, label: i === 0 ? "Next" : "Coming up", when: whenUpcoming(today, e.start), ...goalItem(e) }));
  items.push({ key: "more", slot: "more", event: null, label: "", when: [] });
  return { items, todayIndex };
}

/** The item the row centres on when it opens: the first of today's. */
export const STRIDE = 148;
export const ITEM_WIDTH = 140;
