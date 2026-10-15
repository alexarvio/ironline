// Home's events row (15 Oct): one horizontal line of the client's events,
// opened on today. Pure: the window, the labels and the relative "when" for
// each item, so the card only draws.

export type TimelineEvent = { id: number; kind: string | null; title: string; start: string; end: string; /** A phase of the plan on the timeline: its track colours it. */ phase?: "training" | "nutrition" | "lifestyle" | null };

export type TimelineItem =
  | { key: string; slot: "past" | "today" | "upcoming"; event: TimelineEvent; label: string; when: string }
  | { key: string; slot: "today"; event: null; label: "Today"; when: "Free day" }
  | { key: string; slot: "more"; event: null; label: ""; when: "" };

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

export function whenUpcoming(today: string, start: string): string {
  const n = daysBetween(today, start);
  if (n <= 1) return "Tomorrow";
  if (n < 21) return `In ${n} days`;
  if (n <= 60) return `In ${Math.round(n / 7)} weeks`;
  return dayMon(start);
}

export function whenPast(e: TimelineEvent, today: string): string {
  if (ongoing(e, today)) return `Since ${dayMon(e.start)}`;
  if (e.start === e.end) return dayMon(e.start);
  const sameMonth = e.start.slice(0, 7) === e.end.slice(0, 7);
  // Thin spaces around the dash.
  return sameMonth ? `${dayOnly(e.start)} – ${dayMon(e.end)}` : `${dayMon(e.start)} – ${dayMon(e.end)}`;
}

export function whenToday(e: TimelineEvent, today: string): { label: string; when: string } {
  if (e.start < today && e.end > today) return { label: "Now", when: `Until ${dayMon(e.end)}` };
  if (e.start < today && e.end === today) return { label: "Now", when: "Last day" };
  if (e.start === today && e.end > today) return { label: e.kind === "supplement" ? "Starts today" : "Now", when: e.kind === "supplement" ? "From today" : `Until ${dayMon(e.end)}` };
  return { label: "Today", when: "All day" };
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
  past.forEach((e, i) => {
    const last = i === past.length - 1;
    items.push({ key: `p${e.id}`, slot: "past", event: e, label: last ? "Last" : ongoing(e, today) ? "Started" : "Done", when: whenPast(e, today) });
  });
  const todayIndex = items.length;
  if (todays.length === 0) items.push({ key: "today", slot: "today", event: null, label: "Today", when: "Free day" });
  for (const e of todays) items.push({ key: `t${e.id}`, slot: "today", event: e, ...whenToday(e, today) });
  upcoming.forEach((e, i) => items.push({ key: `u${e.id}`, slot: "upcoming", event: e, label: i === 0 ? "Next" : "Coming up", when: whenUpcoming(today, e.start) }));
  items.push({ key: "more", slot: "more", event: null, label: "", when: "" });
  return { items, todayIndex };
}

/** The item the row centres on when it opens: the first of today's. */
export const STRIDE = 148;
export const ITEM_WIDTH = 140;
