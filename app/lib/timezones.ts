// Meeting times across timezones. A meeting keeps the date and time the
// coach typed, and the timezone they typed them in (meetings saved before
// the timezone existed are in the server's, Europe/Amsterdam). The client's
// app turns that into the moment it is, shown in the phone's own timezone:
// 09:30 in Amsterdam reads 14:30 in Bangkok.
//
// Plain functions, no server imports: used on both sides.

export const SERVER_TZ = "Europe/Amsterdam";

/** Every timezone the browser knows, or a short list where it can't say. */
export function allTimezones(): string[] {
  try {
    const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone");
    if (list && list.length) return list;
  } catch {}
  return ["Europe/Amsterdam", "Europe/London", "Europe/Helsinki", "America/New_York", "America/Chicago", "America/Los_Angeles", "Asia/Dubai", "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "UTC"];
}

export function isTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "GMT+2", "GMT+7": a zone's offset at a moment (its summer time included). */
export function tzShort(tz: string, at: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(at).find((p) => p.type === "timeZoneName")?.value ?? tz;
  } catch {
    return tz;
  }
}

/** "Amsterdam · GMT+2" for a picker. */
export function tzLabel(tz: string, at: Date = new Date()): string {
  const city = tz.split("/").pop()!.replace(/_/g, " ");
  return `${city} · ${tzShort(tz, at)}`;
}

/** The moment a date and time in a timezone stand for. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map((n) => Number(n) || 0);
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // How far the zone's clock is from UTC at a moment.
  const offset = (t: number) => {
    try {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(t));
      const g = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0);
      return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - t;
    } catch {
      return 0;
    }
  };
  // Twice, so a time next to a clock change settles on the right side.
  let t = wall - offset(wall);
  t = wall - offset(t);
  return new Date(t);
}

/** A booked call's day and time in a timezone, exactly as the phone words
 *  them (HomeHub's localMeetingLabels): the server draws them in the phone's
 *  zone from its cookie, so they don't change a moment after the page shows. */
export function meetingLabelsIn(startIso: string, durationMinutes: number, tz: string, nowMs: number) {
  const d = new Date(startIso);
  const ymd = (x: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(x);
  const days = Math.round((Date.parse(`${ymd(d)}T00:00:00Z`) - Date.parse(`${ymd(new Date(nowMs))}T00:00:00Z`)) / 86400000);
  return {
    dayNumber: new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(d),
    monthCap: new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "short" }).format(d).toUpperCase(),
    inLabel: days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
    whenLabel: `${new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(d)} ${new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(d)} ${tzShort(tz, d)} · ${durationMinutes} min`,
  };
}

/** The hour (0–23) now in a timezone. */
export function hourIn(tz: string, at: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(at));
}
