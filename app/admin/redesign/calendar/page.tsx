import Link from "next/link";
import { requireCoach } from "../../../lib/auth";
import { getCalendarDay, getCalendarMonth, getMeetingConflicts, listCalendarCategories, listClients, localDateStr, type MeetingWithClient } from "../../../lib/queries";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/basics";
import { ChevronLeftIcon } from "../../../components/icons";
import AutosaveNote from "../../AutosaveNote";
import { loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import { entryColors } from "../palette";
import CalendarDay, { type CalEntry } from "./CalendarDay";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../plan/plan.css";
import "../rail.css";
import "../ncdialog.css";
import "./calendar.css";

// The Calendar in the redesign, the rail on its left (replaces
// /admin?view=calendar): every meeting across clients plus the coach's own
// blocks, a month on the left, the chosen day hour by hour on the right,
// where a click on an hour adds something. Entries wear their category's
// colour; double-bookings are flagged. It fills the screen.
//   /admin/redesign/calendar?month=2026-09&day=2026-09-25
export const dynamic = "force-dynamic";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const clients = listClients(coach.id).map((c) => ({ id: c.id, name: c.name }));
  // eslint-disable-next-line react-hooks/purity -- a server render reads the clock once, on purpose
  const renderedAt = Date.now();

  // All-day entries first in a cell, then by time.
  const cellOrder = (list: MeetingWithClient[]) => [...list].sort((a, b) => Number(!!b.all_day) - Number(!!a.all_day) || (a.time < b.time ? -1 : 1));

  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <div className="rd-page rcl-page">
        <div className="rcl">
          {conflicts.length > 0 && (
            <Card className="rcl-conflicts">
              <CardHeader>
                <CardTitle>
                  {conflicts.length} double-booking{conflicts.length === 1 ? "" : "s"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="rcl-conflict-list">
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      <Link href={href(c.a.date.slice(0, 7), c.a.date)} scroll={false}>
                        {new Date(`${c.a.date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                      </Link>
                      : <b>{c.a.clientName}</b> at {c.a.time} ({c.a.duration_minutes} min) overlaps <b>{c.b.clientName}</b> at {c.b.time} ({c.b.duration_minutes} min)
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="rcl-cols">
            {/* The month: a day opens on the right; a client's meeting opens their Meetings. */}
            <Card className="rcl-month-card">
              <div className="rcl-month-head">
                <h1 className="rcl-title">Calendar</h1>
                <div className="rcl-nav">
                  <Link href={href(calendar.prevMonth)} scroll={false} className="rd-btn ghost" aria-label="Previous month">
                    <ChevronLeftIcon />
                  </Link>
                  <span className="rcl-month">{calendar.label}</span>
                  <Link href={href(calendar.nextMonth)} scroll={false} className="rd-btn ghost rcl-next" aria-label="Next month">
                    <ChevronLeftIcon />
                  </Link>
                  <Link href="/admin/redesign/calendar" scroll={false} className="rd-btn">
                    Today
                  </Link>
                </div>
              </div>
              <div className="rcl-grid">
                {WEEKDAYS.map((w) => (
                  <span key={w} className="rcl-weekday">
                    {w}
                  </span>
                ))}
                {calendar.weeks.flat().map((cell) => {
                  const list = cellOrder(cell.meetings);
                  return (
                    <div key={cell.date} className={`rcl-cell${cell.inMonth ? "" : " outside"}${cell.isToday ? " today" : ""}${cell.date === selectedDay ? " selected" : ""}`}>
                      <Link href={href(monthKey, cell.date)} scroll={false} className="rcl-cell-link" aria-label={`Open ${cell.date}`} />
                      <span className="rcl-date">{Number(cell.date.slice(8, 10))}</span>
                      <div className="rcl-chips">
                        {list.slice(0, 4).map((m) => {
                          const c = entryColors(categories, m.category, m.client_id != null);
                          const label = m.client_id != null ? m.clientName : m.topic || "Busy";
                          return (
                            <Link
                              key={m.id}
                              href={m.client_id == null ? href(monthKey, cell.date) : `/admin/redesign/meetings?client=${m.client_id}`}
                              scroll={false}
                              className={`rcl-chip${conflictIds.has(m.id) ? " conflict" : ""}${m.status === "completed" ? " done" : ""}${m.all_day ? " allday" : ""}`}
                              style={conflictIds.has(m.id) ? undefined : { background: c.tint, color: c.ink, boxShadow: m.all_day ? `inset 3px 0 0 ${c.ink}` : undefined }}
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
            </Card>

            {/* The chosen day, hour by hour. */}
            <Card className="rcl-day">
              <CardHeader className="rcl-day-head">
                <div>
                  <CardDescription>{selectedDay === today ? "Today" : d.toLocaleDateString("en-GB", { weekday: "long" })}</CardDescription>
                  <CardTitle className="rcl-day-title">{d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</CardTitle>
                </div>
                <div className="rcl-day-right">
                  <Badge className="rcl-day-count">{dayEntries.length === 0 ? "Nothing booked" : `${dayEntries.length} ${dayEntries.length === 1 ? "entry" : "entries"}`}</Badge>
                  <AutosaveNote renderedAt={renderedAt} asButton idleAsSaved idleText="All saved" savedText="Saved" />
                </div>
              </CardHeader>
              <CardContent className="rcl-day-body">
                <CalendarDay key={selectedDay} date={selectedDay} entries={dayEntries} categories={categories} clients={clients} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
