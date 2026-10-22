"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "../../../components/icons";
import { dayMonth } from "../../../lib/dayMonth";
import CalendarDay, { type CalEntry } from "./CalendarDay";

// The month and the chosen day (22 Oct, Alex: a day took a second to open). The month's six weeks come with every day's
// entries, so a click on a day shows it at once, in the browser, with no trip to the server; the address follows
// (?day=) so a reload or a shared link lands on it. Another month is still a page of its own (‹ ›, Today).

export type BoardChip = {
  id: number;
  label: string;
  time: string;
  allDay: boolean;
  done: boolean;
  clash: boolean;
  /** The entry's colours, as calendar/chrome.ts gives them (a clash rust). */
  tint: string;
  ink: string;
  line: string;
  /** A client's meeting opens their Meetings; the coach's own block opens its day. */
  clientId: number | null;
  title: string;
};
export type BoardCell = { date: string; inMonth: boolean; isToday: boolean; chips: BoardChip[]; more: number };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const spokenDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
const href = (month: string, day?: string) => `/admin/redesign/calendar?month=${month}${day ? `&day=${day}` : ""}`;

export default function CalendarBoard({
  label,
  monthKey,
  prevMonth,
  nextMonth,
  today,
  initialDay,
  cells,
  entries,
  categories,
  clients,
}: {
  label: string;
  monthKey: string;
  prevMonth: string;
  nextMonth: string;
  today: string;
  initialDay: string;
  cells: BoardCell[];
  /** Every day of the six weeks → its entries, and the day asked for when it lies outside them. */
  entries: Record<string, CalEntry[]>;
  categories: React.ComponentProps<typeof CalendarDay>["categories"];
  clients: React.ComponentProps<typeof CalendarDay>["clients"];
}) {
  const [day, setDay] = useState(initialDay);
  const pick = (date: string) => {
    setDay(date);
    // The address follows without a server trip (the app router keeps it in step).
    window.history.replaceState(null, "", href(monthKey, date));
  };
  const dayEntries = entries[day] ?? [];
  const weekday = new Date(`${day}T12:00:00`).toLocaleDateString("en-GB", { weekday: "long" });

  return (
    <div className="rcl-cols">
      {/* ---- The month: a day opens on the right; a client's meeting opens their Meetings. */}
      <section className="rcl-col" aria-label="Month">
        <div className="rcl-head">
          <h2>{label}</h2>
          <div className="rcl-pan">
            <Link href={href(prevMonth)} scroll={false} className="trn-more" aria-label="Previous month">
              <ChevronLeftIcon />
            </Link>
            <Link href="/admin/redesign/calendar" scroll={false} className="trn-pill">
              Today
            </Link>
            <Link href={href(nextMonth)} scroll={false} className="trn-more" aria-label="Next month">
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
            {cells.map((cell) => (
              <div key={cell.date} className={`rcl-cell${cell.inMonth ? "" : " outside"}${cell.isToday ? " today" : ""}${cell.date === day ? " selected" : ""}`}>
                <button type="button" className="rcl-cell-link" onClick={() => pick(cell.date)} aria-label={`Open ${spokenDay(cell.date)}`} aria-current={cell.date === day ? "date" : undefined} />
                <span className="rcl-date">{Number(cell.date.slice(8, 10))}</span>
                <div className="rcl-chips">
                  {cell.chips.map((m) => {
                    const cls = `rcl-chip${m.clash ? " conflict" : ""}${m.done ? " done" : ""}${m.allDay ? " allday" : ""}`;
                    const style = { background: m.tint, color: m.ink, boxShadow: m.clash ? `inset 0 0 0 1px ${m.line}` : m.allDay ? `inset 0 -2px 0 ${m.ink}` : undefined };
                    const words = (
                      <>
                        {!m.allDay && <b>{m.time || "–"}</b>} {m.label}
                      </>
                    );
                    return m.clientId != null ? (
                      <Link key={m.id} href={`/admin/redesign/meetings?client=${m.clientId}`} scroll={false} className={cls} style={style} title={m.title}>
                        {words}
                      </Link>
                    ) : (
                      <button key={m.id} type="button" className={cls} style={style} title={m.title} onClick={() => pick(cell.date)}>
                        {words}
                      </button>
                    );
                  })}
                  {cell.more > 0 && <span className="rcl-more">+{cell.more} more</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---- The chosen day, hour by hour: its name and date on the page, what is booked on the right. */}
      <section className="rcl-col" aria-label="Day">
        <div className="rcl-head">
          <div className="rcl-titled">
            <h2>{day === today ? "Today" : weekday}</h2>
            <span>{dayMonth(day)}</span>
          </div>
          <span className="rcl-count">{dayEntries.length === 0 ? "Nothing booked" : `${dayEntries.length} ${dayEntries.length === 1 ? "entry" : "entries"}`}</span>
        </div>
        <div className="rcl-card rcl-day">
          <CalendarDay key={day} date={day} entries={dayEntries} categories={categories} clients={clients} />
        </div>
      </section>
    </div>
  );
}
