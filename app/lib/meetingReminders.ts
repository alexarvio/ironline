// Push reminders for a booked call: one a day before ("tomorrow"), one an
// hour before. Checked every few minutes from instrumentation.ts; each is
// sent once, remembered on the meeting against the start it was for, so a
// call that is moved gets its reminders again for the new time.
//
// The message never says a clock time: the server doesn't know the phone's
// timezone, and a day before is "tomorrow, this time" wherever the client is.
// Missed windows are skipped rather than sent late: a call booked for this
// afternoon gets the hour reminder, never a "tomorrow".

import { getData, persist } from "./db";
import { getCoachFirstName } from "./queries";
import { SERVER_TZ, zonedToUtc } from "./timezones";

const MIN = 60_000;
const WINDOWS = [
  { key: "day" as const, before: 24 * 60 * MIN, width: 60 * MIN },
  { key: "hour" as const, before: 60 * MIN, width: 20 * MIN },
];

export function meetingRemindersOn(): boolean {
  // The live server only: a dev server with the keys set would otherwise
  // send the same reminders from a laptop. MEETING_REMINDERS=on forces it.
  return process.env.MEETING_REMINDERS === "on" || (process.env.NODE_ENV === "production" && process.env.MEETING_REMINDERS !== "off");
}

export async function runMeetingReminders(now: number = Date.now()): Promise<number> {
  const data = getData();
  const { sendPush } = await import("./push");
  let sent = 0;
  let changed = false;
  for (const m of data.meetings) {
    if (m.client_id == null || m.status !== "scheduled" || !m.time) continue;
    const start = zonedToUtc(m.date, m.time, m.tz || SERVER_TZ).getTime();
    if (!Number.isFinite(start) || start < now) continue;
    const startIso = new Date(start).toISOString();
    for (const w of WINDOWS) {
      const from = start - w.before;
      if (now < from || now >= from + w.width) continue;
      if (m.reminders_sent?.[w.key] === startIso) continue;
      const user = data.users.find((u) => u.role === "client" && u.client_id === m.client_id);
      m.reminders_sent = { ...(m.reminders_sent ?? {}), [w.key]: startIso };
      changed = true;
      if (!user) continue;
      const coach = getCoachFirstName(m.client_id);
      const topic = m.topic?.trim() || "Check-in call";
      const minutes = m.duration_minutes || 30;
      try {
        sent += await sendPush(user.id, {
          title: w.key === "day" ? `Call with ${coach} tomorrow` : `Call with ${coach} in 1 hour`,
          body: w.key === "day" ? `${topic} · ${minutes} min, this time tomorrow.` : `${topic} · ${minutes} min. The link is on your Home.`,
          url: "/client",
          tag: `meeting-${m.id}`,
        });
      } catch (e) {
        console.error(`[reminders] meeting ${m.id} (${w.key}) failed:`, e instanceof Error ? e.message : e);
      }
    }
  }
  if (changed) persist();
  return sent;
}
