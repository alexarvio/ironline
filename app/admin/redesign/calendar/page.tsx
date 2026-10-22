import Link from "next/link";
import { requireCoach } from "../../../lib/auth";
import { clientReasons, getActivityFeed, getCalendarDay, getCalendarMonth, getMeetingConflicts, listCalendarCategories, listClients, localDateStr, type MeetingWithClient } from "../../../lib/queries";
import { ATTENTION } from "../../../lib/attentionReasons";
import { ChevronLeftIcon, ChevronRightIcon } from "../../../components/icons";
import AutosaveNote from "../../AutosaveNote";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import "../messages/messages.css";
import CalendarDay, { type CalEntry } from "./CalendarDay";
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

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
/** Who an entry is with, or what it is when it is the coach's own. */
const whoOf = (m: MeetingWithClient) => (m.client_id != null ? m.clientName : m.topic || "Busy");
const spokenDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; day?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const calendar = getCalendarMonth(coach.id, params.month);
  const today = localDateStr();
  const selectedDay = params.day && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : today;
  const monthKey = calendar.weeks[1][0].date.slice(0, 7);
  const conflicts = getMeetingConflicts(coach.id);
  const conflictIds = new Set<number>(conflicts.flatMap((c) => [c.a.id, c.b.id]));
  const categories = listCalendarCategories(coach.id);
  const href = (month: string, day?: string) => `/admin/redesign/calendar?month=${month}${day ? `&day=${day}` : ""}`;

  // The day on the right.
  const d = new Date(`${selectedDay}T12:00:00`);
  const dayEntries: CalEntry[] = getCalendarDay(coach.id, selectedDay).map((m) => ({
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
  }));
  // Each with why they need the coach, as the rail says it (14 Oct), for the With picker.
  const feed = getActivityFeed(coach.id);
  const clients = listClients(coach.id).map((c) => {
    const r = clientReasons(c.id, feed)[0];
    return { id: c.id, name: c.name, avatarPath: c.avatar_path ?? null, reason: r ? { text: r.text, color: ATTENTION[r.type].color, rgb: ATTENTION[r.type].rgb } : null };
  });
  // eslint-disable-next-line react-hooks/purity -- a server render reads the clock once, on purpose
  const renderedAt = Date.now();

  // All-day entries first in a cell, then by time.
  const cellOrder = (list: MeetingWithClient[]) => [...list].sort((a, b) => Number(!!b.all_day) - Number(!!a.all_day) || (a.time < b.time ? -1 : 1));
  const span = (m: MeetingWithClient) => `${m.time}–${hhmm(toMin(m.time) + m.duration_minutes)}`;

  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <ChatDock chats={loadChatDock(coach)} />
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

          <div className="rcl-cols">
            {/* ---- The month: a day opens on the right; a client's meeting opens their Meetings. */}
            <section className="rcl-col" aria-label="Month">
              <div className="rcl-head">
                <h2>{calendar.label}</h2>
                <div className="rcl-pan">
                  <Link href={href(calendar.prevMonth)} scroll={false} className="trn-more" aria-label="Previous month">
                    <ChevronLeftIcon />
                  </Link>
                  <Link href="/admin/redesign/calendar" scroll={false} className="trn-pill">
                    Today
                  </Link>
                  <Link href={href(calendar.nextMonth)} scroll={false} className="trn-more" aria-label="Next month">
                    <ChevronRightIcon />
                  </Link>
                </div>
              </div>
              <div className="rcl-card rcl-month">
                <div className="rcl-weekdays" aria-hidden="true">
                  {WEEKDAYS.map((w) => (
                    <span key={w} className="rcl-weekday">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="rcl-grid">
                  {calendar.weeks.flat().map((cell) => {
                    const list = cellOrder(cell.meetings);
                    return (
                      <div key={cell.date} className={`rcl-cell${cell.inMonth ? "" : " outside"}${cell.isToday ? " today" : ""}${cell.date === selectedDay ? " selected" : ""}`}>
                        <Link href={href(monthKey, cell.date)} scroll={false} className="rcl-cell-link" aria-label={`Open ${spokenDay(cell.date)}`} aria-current={cell.date === selectedDay ? "date" : undefined} />
                        <span className="rcl-date">{Number(cell.date.slice(8, 10))}</span>
                        <div className="rcl-chips">
                          {list.slice(0, 4).map((m) => {
                            const clash = conflictIds.has(m.id);
                            const c = clash ? CLASH : entryChrome(categories, m.category, m.client_id != null);
                            const label = whoOf(m);
                            return (
                              <Link
                                key={m.id}
                                href={m.client_id == null ? href(monthKey, cell.date) : `/admin/redesign/meetings?client=${m.client_id}`}
                                scroll={false}
                                className={`rcl-chip${clash ? " conflict" : ""}${m.status === "completed" ? " done" : ""}${m.all_day ? " allday" : ""}`}
                                style={{ background: c.tint, color: c.ink, boxShadow: clash ? `inset 0 0 0 1px ${c.line}` : m.all_day ? `inset 2px 0 0 ${c.ink}` : undefined }}
                                title={`${m.all_day ? "All day" : m.time} · ${label}${m.topic && m.client_id != null ? ` · ${m.topic}` : ""}`}
                              >
                                {!m.all_day && <b>{m.time || "–"}</b>} {label}
                              </Link>
                            );
                          })}
                          {list.length > 4 && <span className="rcl-more">+{list.length - 4} more</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ---- The chosen day, hour by hour: its name and date on the page, what is booked on the right. */}
            <section className="rcl-col" aria-label="Day">
              <div className="rcl-head">
                <div className="rcl-titled">
                  <h2>{selectedDay === today ? "Today" : d.toLocaleDateString("en-GB", { weekday: "long" })}</h2>
                  <span>{dayMonth(selectedDay)}</span>
                </div>
                <span className="rcl-count">{dayEntries.length === 0 ? "Nothing booked" : `${dayEntries.length} ${dayEntries.length === 1 ? "entry" : "entries"}`}</span>
              </div>
              <div className="rcl-card rcl-day">
                <CalendarDay key={selectedDay} date={selectedDay} entries={dayEntries} categories={categories} clients={clients} />
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
