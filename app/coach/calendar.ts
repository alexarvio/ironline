import { getMeetingConflicts, listAllMeetings, listCalendarCategories, listClients, type MeetingWithClient } from "../lib/queries";
import type { Category } from "../admin/redesign/palette";

// The coach's Calendar on the phone (22 Oct, Alex: "having the calendar on
// the phone would be nice too"): the same entries the laptop's Calendar reads
// (listAllMeetings: every client's call and the coach's own blocks, in the
// timezone the coach is looking from), a week at a time, with the
// double-bookings the laptop flags (getMeetingConflicts). Written with the
// laptop's own actions (addCalendarEntryAction and the rest), so an entry
// made here is on the laptop and the other way round.

export type PhoneEntry = {
  id: number;
  date: string;
  time: string;
  durationMinutes: number;
  allDay: boolean;
  topic: string;
  clientId: number | null;
  clientName: string;
  status: "scheduled" | "completed" | "no-show" | "cancelled";
  category: string | null;
  note: string;
  /** Who and when it is double-booked with: "Ben 10:15–11:00"; empty when it isn't. */
  clashes: string[];
};
export type PhoneClash = { date: string; a: string; b: string };
export type PhoneCalendar = {
  /** The Monday of the week these are. */
  from: string;
  entries: PhoneEntry[];
  /** Every double-booking from today on, across all weeks: "Anna 10:00–10:30" overlaps "Ben 10:15–11:00". */
  clashes: PhoneClash[];
  categories: Category[];
  clients: { id: number; name: string; avatarPath: string | null }[];
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Who an entry is with, or what it is when it is the coach's own, and when: as the laptop's clash row says it. */
const said = (m: MeetingWithClient) => `${m.client_id != null ? m.clientName : m.topic || "Busy"} ${m.time}–${hhmm(toMin(m.time) + m.duration_minutes)}`;

export function loadPhoneCalendar(coachId: number, monday: string, today: string): PhoneCalendar {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(monday) ? monday : today;
  const to = addDays(from, 6);
  const conflicts = getMeetingConflicts(coachId);
  const clashOf = new Map<number, string[]>();
  for (const c of conflicts) {
    clashOf.set(c.a.id, [...(clashOf.get(c.a.id) ?? []), said(c.b)]);
    clashOf.set(c.b.id, [...(clashOf.get(c.b.id) ?? []), said(c.a)]);
  }
  const entries = listAllMeetings(coachId)
    .filter((m) => m.status !== "cancelled" && m.date >= from && m.date <= to)
    // A day's all-day entries first, then by time, as the laptop's month cells.
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : Number(!!b.all_day) - Number(!!a.all_day) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0)))
    .map((m) => ({
      id: m.id,
      date: m.date,
      time: m.time,
      durationMinutes: m.duration_minutes,
      allDay: !!m.all_day,
      topic: m.topic,
      clientId: m.client_id,
      clientName: m.clientName,
      status: m.status,
      category: m.category ?? null,
      note: m.prep_notes ?? "",
      clashes: clashOf.get(m.id) ?? [],
    }));
  return {
    from,
    entries,
    clashes: conflicts.filter((c) => c.a.date >= today).map((c) => ({ date: c.a.date, a: said(c.a), b: said(c.b) })),
    categories: listCalendarCategories(coachId),
    clients: listClients(coachId).map((c) => ({ id: c.id, name: c.name, avatarPath: c.avatar_path ?? null })),
  };
}
