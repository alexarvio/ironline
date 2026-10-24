import Link from "next/link";
import { requireCoach } from "../../../lib/auth";
import { clientReasons, getActivityFeed, getCalendarDay, getCalendarMonth, getMeetingConflicts, listCalendarCategories, listClients, localDateStr, type MeetingWithClient } from "../../../lib/queries";
import { ATTENTION } from "../../../lib/attentionReasons";
import AutosaveNote from "../../AutosaveNote";
import { startTiming } from "../../../lib/timing";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import "../messages/messages.css";
import { type CalEntry } from "./CalendarDay";
import CalendarBoard, { type BoardCell } from "./CalendarBoard";
import { CLASH, entryChrome } from "./chrome";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../training/trn.css";
import "../plan/plan.css";
import "../plan/phase-dialog.css";
import "../rail.css";
import "../ncdialog.css";
import "./calendar.css";
import { dayMonth } from "../../../lib/dayMonth";
import { isClientCall } from "../../../lib/calendarKinds";

// The Calendar in the redesign, the rail on its left (replaces
// /admin?view=calendar): every meeting across clients plus the coach's own
// blocks, a month on the left, the chosen day hour by hour on the right,
// where a click on an hour adds something. Entries wear their category's
// colour; double-bookings are flagged. It fills the screen.
// In the admin's hairline voice since 22 Oct (Alex: the last screen on the old
// style): Training's header, bare; a clash a row with its way to the day; the
// month and the day each a section title on the page over one hairline card.
//   /admin/redesign/calendar?month=2026-09&day=2026-09-25
export const dynamic = "force-dynamic";

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** Who an entry is with, or what it is when it is the coach's own. */
const whoOf = (m: MeetingWithClient) => (m.client_id != null ? m.clientName : m.topic || "Busy");
const spokenDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  // Each loader timed (app/lib/timing.ts, /api/timing): measuring only, the props are what they were.
  const t = startTiming("calendar");
  const coach = await t.time("auth", () => requireCoach());
  const params = await searchParams;
  const calendar = t.time("calendarMonth", () => getCalendarMonth(coach.id, params.month));
  const today = localDateStr();
  const selectedDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;
  const monthKey = calendar.weeks[1][0].date.slice(0, 7);
  const conflicts = t.time("conflicts", () => getMeetingConflicts(coach.id));
  const conflictIds = new Set<number>(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const categories = t.time("categories", () => listCalendarCategories(coach.id));
  const href = (month: string, day?: string) => `/admin/redesign/calendar?month=${month}${day ? `&day=${day}` : ""}`;

  // Every day of the six weeks with its entries, so a day opens in the browser at once (CalendarBoard); the day asked
  // for joins them when it lies outside the grid.
  const entryOf = (m: MeetingWithClient): CalEntry => ({
    id: m.id,
    time: m.time,
    durationMinutes: m.duration_minutes,
    allDay: !!m.all_day,
    topic: m.topic,
    clientId: m.client_id,
    clientName: m.clientName,
    status: m.status,
    category: m.category ?? null,
    note: m.prep_notes ?? "",
    conflict: conflictIds.has(m.id),
  });
  const entries: Record<string, CalEntry[]> = {};
  for (const cell of calendar.weeks.flat()) entries[cell.date] = cell.meetings.map(entryOf);
  if (!(selectedDay in entries)) entries[selectedDay] = t.time("calendarDay", () => getCalendarDay(coach.id, selectedDay)).map(entryOf);
  // Each with why they need the coach, as the rail says it (14 Oct), for the With picker.
  const feed = t.time("activityFeed", () => getActivityFeed(coach.id));
  const clients = t.time("clientReasons", () =>
    listClients(coach.id).map((c) => {
      const r = clientReasons(c.id, feed)[0];
      return { id: c.id, name: c.name, avatarPath: c.avatar_path ?? null, reason: r ? { text: r.text, color: ATTENTION[r.type].color, rgb: ATTENTION[r.type].rgb } : null };
    }),
  );
  // eslint-disable-next-line react-hooks/purity -- a server render reads the clock once, on purpose
  const renderedAt = Date.now();

  // All-day entries first in a cell, then by time; four shown, the rest as +N more.
  const cellOrder = (list: MeetingWithClient[]) => [...list].sort((a, b) => Number(!!b.all_day) - Number(!!a.all_day) || (a.time < b.time ? -1 : 1));
  const span = (m: MeetingWithClient) => `${m.time}–${hhmm(toMin(m.time) + m.duration_minutes)}`;
  const cells: BoardCell[] = t.time("cells", () =>
    calendar.weeks.flat().map((cell) => {
      const list = cellOrder(cell.meetings);
      return {
        date: cell.date,
        inMonth: cell.inMonth,
        isToday: cell.isToday,
        more: Math.max(0, list.length - 4),
        chips: list.slice(0, 4).map((m) => {
          const clash = conflictIds.has(m.id);
          const c = clash ? CLASH : entryChrome(categories, m.category, m.client_id != null);
          // The entry's title on the chip, its client in the tooltip after it (23 Oct, Alex: the title is always the title).
          const label = m.topic || whoOf(m);
          // Only a client call opens their Meetings (it is there); a training session with them opens its day.
          return { id: m.id, label, time: m.time, allDay: !!m.all_day, done: m.status === "completed", clash, tint: c.tint, ink: c.ink, line: c.line, clientId: isClientCall(m.category) ? m.client_id : null, title: `${m.all_day ? "All day" : m.time} · ${label}${m.topic && m.client_id != null ? ` · ${m.clientName}` : ""}` };
        }),
      };
    }),
  );

  return t.end(
    <div className="rd-frame">
      <RedesignRail rail={t.time("rail", () => loadRail(coach))} clientId={0} />
      <ChatDock chats={t.time("chatDock", () => loadChatDock(coach))} />
      <div className="rd-page rcl-page">
        <div className="rd trn rcl">
          {/* ---- Header: Training's, bare (no fact line, so no room kept for one); the one status after the title. */}
          <header className="trn-head bare">
            <div className="trn-head-main">
              <div className="trn-name-row">
                <h1 className="trn-name">Calendar</h1>
                {/* Nothing until something is saved (22 Oct, Alex), as every tab. */}
                <AutosaveNote renderedAt={renderedAt} savedText="All changes saved" />
              </div>
            </div>
          </header>

          {/* ---- A double-booking is a fact and its fix (design rules 1): who overlaps whom, and a way to that day. */}
          {conflicts.length > 0 && (
            <section className="rcl-card rcl-clashes" aria-label={`${conflicts.length} double-booking${conflicts.length === 1 ? "" : "s"}`}>
              {conflicts.map((c, i) => (
                <div key={i} className="rcl-clash">
                  <span className="rcl-clash-what">
                    <b>{whoOf(c.a)}</b> {span(c.a)}
                    <em>overlaps</em>
                    <b>{whoOf(c.b)}</b> {span(c.b)}
                  </span>
                  <Link href={href(c.a.date.slice(0, 7), c.a.date)} scroll={false} className="rcl-fix" aria-label={`Open ${spokenDay(c.a.date)}`}>
                    Open {dayMonth(c.a.date)}
                  </Link>
                </div>
              ))}
            </section>
          )}

          {/* Keyed by the month and the day asked for, so a new page from the server (‹ ›, Today) starts on its own day,
              never the one picked before. */}
          <CalendarBoard
            key={`${monthKey}:${selectedDay}`}
            label={calendar.label}
            monthKey={monthKey}
            prevMonth={calendar.prevMonth}
            nextMonth={calendar.nextMonth}
            today={today}
            initialDay={selectedDay}
            cells={cells}
            entries={entries}
            categories={categories}
            clients={clients}
          />
        </div>
      </div>
    </div>
  );
}
