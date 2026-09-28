import type { MetricAskAt } from "./db";

// When in the day a metric is asked for (28 Sep): the morning, all day, or
// the evening. The coach sets it per metric; until they do, the name
// decides: a body reading first thing, a how-was-your-day one in the
// evening, the rest (steps, water, screen time) all day. Nothing is filled
// in automatically: what's missed is put in the next day, from the log.

export const ASK_AT: { id: MetricAskAt; label: string }[] = [
  { id: "morning", label: "Morning" },
  { id: "anytime", label: "All day" },
  { id: "evening", label: "Evening" },
];

const MORNING = /weight|body ?fat|waist|sleep|resting|hrv|wake/i;
const EVENING = /energy|mood|stress|motivat|fatigue|hunger|soreness|recover|focus/i;

export function defaultAskAt(name: string): MetricAskAt {
  if (MORNING.test(name)) return "morning";
  if (EVENING.test(name)) return "evening";
  return "anytime";
}

export function metricAskAt(def: { name: string; ask_at?: MetricAskAt | null }): MetricAskAt {
  // "auto" was an option for a day (28 Sep): read as all day.
  return ASK_AT.some((a) => a.id === def.ask_at) ? def.ask_at! : defaultAskAt(def.name);
}

/** The evening's questions open at 17:00; before that the card asks the rest. */
export const EVENING_FROM = 17;
