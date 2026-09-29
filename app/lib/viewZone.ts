import { cache } from "react";
import { SERVER_TZ, zonedToUtc } from "./timezones";

// The timezone the coach is looking from. A meeting keeps the date, time and
// timezone it was typed in; on the coach's screens it reads in the zone of
// whoever is looking (their browser's, from the ironline_tz cookie), so a
// call set at 15:00 in Bangkok reads 09:00 to a coach in London.
//
// Held for one render: requireCoach() sets it from the cookie, and the
// meeting reads in queries.ts turn every timed meeting into it. Where
// nothing set it (the client app, a server action, a script) meetings come
// back exactly as stored.

const box = cache(() => ({ tz: null as string | null }));

export const setViewZone = (tz: string | null) => {
  box().tz = tz;
};
export const viewZone = () => box().tz;

/** A date and time in one timezone, as the date and time it is in another. */
export function inZone(date: string, time: string, from: string, to: string): { date: string; time: string } {
  if (!time || from === to) return { date, time };
  try {
    const at = zonedToUtc(date, time, from);
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: to, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
    const g = (k: string) => parts.find((p) => p.type === k)?.value ?? "";
    return { date: `${g("year")}-${g("month")}-${g("day")}`, time: `${g("hour")}:${g("minute")}` };
  } catch {
    return { date, time };
  }
}

/** A meeting as the one looking sees it: its date, time and timezone in theirs. All-day and untimed entries stay on their day. */
export function inViewZone<M extends { date: string; time: string; tz?: string | null; all_day?: boolean }>(m: M): M {
  const to = viewZone();
  if (!to || !m.time || m.all_day) return m;
  return { ...m, ...inZone(m.date, m.time, m.tz || SERVER_TZ, to), tz: to };
}
