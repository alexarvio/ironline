import Link from "next/link";
import { getCalendarMonth, getMeetingConflicts, localDateStr, MeetingWithClient } from "../lib/queries";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayNumber(dateStr: string) {
  return Number(dateStr.slice(8, 10));
}

export default function CalendarPanel({ month, day }: { month?: string; day?: string }) {
  const calendar = getCalendarMonth(month);
  // The day open in the right-hand panel; today when none was clicked.
  const selectedDay = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : localDateStr();
  const monthKey = calendar.weeks[1][0].date.slice(0, 7);
  const conflicts = getMeetingConflicts();
  const conflictIds = new Set<number>();
  conflicts.forEach((c) => {
    conflictIds.add(c.a.id);
    conflictIds.add(c.b.id);
  });

  return (
    <div>
      <div className="calendar-toolbar">
        <h1 style={{ margin: 0 }}>Calendar</h1>
        <div className="calendar-nav">
          <Link href={`/admin?view=calendar&month=${calendar.prevMonth}`} className="calendar-nav-btn" aria-label="Previous month">
            ‹
          </Link>
          <span className="calendar-month-label">{calendar.label}</span>
          <Link href={`/admin?view=calendar&month=${calendar.nextMonth}`} className="calendar-nav-btn" aria-label="Next month">
            ›
          </Link>
          <Link href="/admin?view=calendar" className="btn secondary calendar-today-btn">
            Today
          </Link>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="conflict-banner" style={{ marginBottom: 20 }}>
          <strong>
            {conflicts.length} double-booking{conflicts.length === 1 ? "" : "s"} detected
          </strong>
          <ul>
            {conflicts.map((c, i) => (
              <li key={i}>
                {c.a.date}: <strong>{c.a.clientName}</strong> at {c.a.time} ({c.a.duration_minutes}min)
                overlaps <strong>{c.b.clientName}</strong> at {c.b.time} ({c.b.duration_minutes}min)
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="calendar-grid">
        <div className="calendar-grid-head">
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="calendar-weekday">
              {d}
            </div>
          ))}
        </div>
        {calendar.weeks.map((week, wi) => (
          <div key={wi} className="calendar-grid-row">
            {week.map((cell) => (
              <div
                key={cell.date}
                className={`calendar-cell${cell.inMonth ? "" : " outside"}${cell.isToday ? " today" : ""}${
                  cell.date === selectedDay ? " selected" : ""
                }`}
              >
                {/* The whole cell opens that day in the right-hand panel: a
                    link stretched over the cell, with the meeting chips
                    layered above it so they keep their own targets. */}
                <Link
                  href={`/admin?view=calendar&month=${monthKey}&day=${cell.date}`}
                  className="calendar-cell-link"
                  aria-label={`Open ${cell.date}`}
                />
                <span className="calendar-cell-date">{dayNumber(cell.date)}</span>
                <div className="calendar-cell-meetings">
                  {cell.meetings.slice(0, 3).map((m: MeetingWithClient) => (
                    <Link
                      key={m.id}
                      href={
                        m.client_id == null
                          ? `/admin?view=calendar&month=${monthKey}&day=${cell.date}`
                          : `/admin?client=${m.client_id}&tab=meetings`
                      }
                      className={`calendar-chip${conflictIds.has(m.id) ? " conflict" : ""}${
                        m.status === "completed" ? " completed" : ""
                      }`}
                      title={`${m.time} · ${m.clientName} · ${m.topic || "No topic"}`}
                    >
                      <span className="calendar-chip-time">{m.time || "–"}</span>
                      <span className="calendar-chip-name">{m.clientName}</span>
                    </Link>
                  ))}
                  {cell.meetings.length > 3 && (
                    <span className="calendar-chip-more">+{cell.meetings.length - 3} more</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
