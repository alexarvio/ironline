import { getCalendarDay, listClients, localDateStr } from "../lib/queries";
import DayTimeline from "./DayTimeline";
import AutosaveNote from "./AutosaveNote";

// The calendar's right-hand panel: one day, hour by hour. Meetings sit in
// their hour rows; a click on an empty spot creates an entry at that time,
// with or without a client. `day` comes from the URL (the cell the coach
// clicked) and defaults to today.
export default function CalendarDayPanel({ day, month }: { day?: string; month?: string }) {
  const date = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : localDateStr();
  const d = new Date(`${date}T12:00:00`);
  const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  const long = d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const isToday = date === localDateStr();

  const meetings = getCalendarDay(date).map((m) => ({
    id: m.id,
    time: m.time,
    durationMinutes: m.duration_minutes,
    topic: m.topic,
    clientId: m.client_id,
    clientName: m.clientName,
    status: m.status,
  }));
  const clients = listClients().map((c) => ({ id: c.id, name: c.name }));
  // Server-stamped per render so the saved-state button only says "All
  // saved" once an add or delete has actually landed.
  // eslint-disable-next-line react-hooks/purity -- a server component render is the intended clock here
  const renderedAt = Date.now();

  return (
    <div className="ad-panel cd">
      <div className="cd-head">
        <div className="cd-head-row">
          <div>
            <div className="cd-kicker">{isToday ? "Today" : weekday}</div>
            <h2 className="cd-title">{long}</h2>
          </div>
          {/* Entries save the moment they are added or deleted; this is the
              coach's assurance of that, not a step they have to take. */}
          <AutosaveNote renderedAt={renderedAt} asButton idleAsSaved idleText="All saved" savedText="Saved" />
        </div>
        <div className="cd-sub">
          {meetings.length === 0
            ? "Nothing booked. Click an hour to add something."
            : `${meetings.length} ${meetings.length === 1 ? "entry" : "entries"}`}
        </div>
      </div>

      <DayTimeline date={date} month={month} meetings={meetings} clients={clients} />
    </div>
  );
}
