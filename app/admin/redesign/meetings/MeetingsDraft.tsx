"use client";

import { useState } from "react";
import type React from "react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { CalendarIcon, ChatIcon, ChevronDownIcon, ChevronLeftIcon, MoreIcon, PlayIcon, PlusIcon, TrashIcon } from "../../../components/icons";
import DateText from "../DateText";
import { ConfirmDialog, MessageDialog } from "../training/TrainingDraft";

// The calmer Meetings tab, as a draft on real data, in the Training draft's
// sheet. The next call with everything to prepare it, the calls after it,
// the past calls with their recap and notes, and a month in the schedule
// dialog to book the next one from.
//
// - The next call: the date tile, the topic (typed in place), when, and the
//   way in. Under it the prep notes, which are yours alone.
//   Cancel, reschedule, or mark it completed with a recap for the client.
// - Past calls: one row a call, newest first; open, the recap for the
//   what was agreed, written for the client.
// - Schedule: the month with this client's calls and everyone else's, the
//   picked day's bookings under it, and the same date typed beside.
// Nothing here saves: every action ends in a toast.

export type DraftGoal = { id: number; text: string; tone: "green" | "orange" | "muted"; status: string; def: string; done: boolean; meetingId: number | null };
export type DraftNote = { id: number; text: string; createdAt: string };
export type DraftMeeting = {
  id: number;
  date: string;
  time: string;
  durationMinutes: number;
  topic: string;
  status: "scheduled" | "completed" | "no-show" | "cancelled";
  link: string | null;
  provider: string;
  host: string;
  prepNotes: string;
  summary: string;
  notes: DraftNote[];
  goals: DraftGoal[];
};
export type DraftDot = { date: string; time: string; durationMinutes: number; name: string; topic: string; mine: boolean; completed: boolean };
export type DraftMeetings = {
  today: string;
  upcoming: DraftMeeting | null;
  alsoScheduled: DraftMeeting[];
  past: DraftMeeting[];
  goals: DraftGoal[];
  dots: DraftDot[];
  others: { date: string; time: string; durationMinutes: number; name: string }[];
  lastLink: string | null;
};

const draftOnly = (what: string) => toast(what, { description: "A draft: nothing saves here." });
const savedToast = (what: string) => toast.success("Saved", { description: `${what} (a draft: nothing really saved).` });
const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const monthCap = (d: string) => parse(d).toLocaleDateString("en-GB", { month: "short" });
const dayNum = (d: string) => String(parse(d).getDate());
const longDay = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
const shortDay = (d: string) => parse(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const toMin = (t: string) => {
  const [h, m] = t.split(":").map((x) => Number(x) || 0);
  return h * 60 + m;
};
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** "9" → "09:00", "930" → "09:30", "14.30" → "14:30"; anything unreadable is left as typed. */
const tidyTime = (raw: string) => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  const h = digits.length <= 2 ? Number(digits) : Number(digits.slice(0, -2));
  const m = digits.length <= 2 ? 0 : Number(digits.slice(-2));
  return h > 23 || m > 59 ? raw : fromMin(h * 60 + m);
};
const endTime = (time: string, dur: number) => (time ? fromMin(toMin(time) + dur) : "");
const inDaysLabel = (today: string, date: string) => {
  const n = daysBetween(today, date);
  return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
};
const STATUS: Record<DraftMeeting["status"], { text: string; cls: string }> = { scheduled: { text: "Scheduled", cls: "" }, completed: { text: "Completed", cls: "up" }, "no-show": { text: "No-show", cls: "down" }, cancelled: { text: "Cancelled", cls: "" } };
const providerOf = (link: string) => {
  try {
    const host = new URL(link.trim()).hostname.toLowerCase();
    if (host.endsWith("meet.google.com")) return "Google Meet";
    if (host.endsWith("zoom.us")) return "Zoom";
    if (host.endsWith("teams.microsoft.com") || host.endsWith("teams.live.com")) return "Teams";
    return "Join call";
  } catch {
    return null;
  }
};

type Dlg = { kind: "message"; label: string } | { kind: "schedule"; date: string; reschedule: DraftMeeting | null } | { kind: "link"; meetingId: number } | { kind: "complete"; meetingId: number } | { kind: "delete"; meetingId: number } | null;

export default function MeetingsDraft({ firstName, plan }: { firstName: string; plan: DraftMeetings }) {
  const today = plan.today;
  // Everything on screen lives in state so the draft can show what an action would do.
  const [meetings, setMeetings] = useState<DraftMeeting[]>([...(plan.upcoming ? [plan.upcoming] : []), ...plan.alsoScheduled, ...plan.past]);
  const [dlg, setDlg] = useState<Dlg>(null);
  const close = () => setDlg(null);
  const patchMeeting = (id: number, f: Partial<DraftMeeting>) => setMeetings((prev) => prev.map((m) => (m.id === id ? { ...m, ...f } : m)));
  const byId = (id: number) => meetings.find((m) => m.id === id) ?? null;

  const scheduled = meetings.filter((m) => m.status === "scheduled" && m.date >= today).sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1));
  const upcoming = scheduled[0] ?? null;
  const also = scheduled.slice(1);
  const past = meetings.filter((m) => !(m.status === "scheduled" && m.date >= today)).sort((a, b) => (a.date < b.date ? 1 : -1));
  const [openPast, setOpenPast] = useState<number | null>(past[0]?.id ?? null);
  const [selectedDay, setSelectedDay] = useState(upcoming?.date ?? today);
  // The month's dots: what came from the server, with what was done here on top.
  const dots: DraftDot[] = [...plan.dots.filter((d) => !d.mine || meetings.some((m) => m.date === d.date && m.time === d.time && m.status !== "cancelled")), ...meetings.filter((m) => m.id < 0 && m.status !== "cancelled").map((m) => ({ date: m.date, time: m.time, durationMinutes: m.durationMinutes, name: firstName, topic: m.topic, mine: true, completed: m.status === "completed" }))];

  const pGrid = { gridTemplateColumns: "20px 140px minmax(200px, 1fr) 130px 32px", columnGap: 24 } as const;

  return (
    <div className="rd">
      {/* ---- Header. */}
      <header className="rd-head">
        <div className="rd-head-main">
          <span className="rd-eyebrow">Meetings</span>
          <h1 className="rd-title">{firstName}&rsquo;s calls</h1>
        </div>
        <div className="rd-head-actions">
          <button type="button" className="rd-btn primary" onClick={() => setDlg({ kind: "schedule", date: selectedDay, reschedule: null })}>
            <PlusIcon /> Schedule a meeting
          </button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger className="rd-btn ghost" aria-label="More for meetings">
              <MoreIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="pb-menu">
              <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: "Meetings" })}>
                <ChatIcon /> Message about meetings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="rt-cols">
        <div className="rt-main">
          {/* ---- The next call. */}
          <section className="rd-session open rn-card">
            <div className="rn-card-head">
              <h2>Next call</h2>
              {upcoming && (
                <div className="rt-actions">
                  <button type="button" className="rd-btn" onClick={() => setDlg({ kind: "schedule", date: upcoming.date, reschedule: upcoming })}>
                    <CalendarIcon /> Reschedule
                  </button>
                  <button type="button" className="rd-btn primary" onClick={() => setDlg({ kind: "complete", meetingId: upcoming.id })}>
                    Mark completed
                  </button>
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger className="rd-btn ghost" aria-label="More for the next call">
                      <MoreIcon />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="pb-menu">
                      <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "delete", meetingId: upcoming.id })}>
                        <TrashIcon /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
            {upcoming ? (
              <>
                <div className="rt-band">
                  <span className="rt-tile">
                    <small>{monthCap(upcoming.date)}</small>
                    <b>{dayNum(upcoming.date)}</b>
                  </span>
                  <div className="rt-band-main">
                    <span className="rt-eyebrow">Upcoming · {inDaysLabel(today, upcoming.date)}</span>
                    <input
                      className="rt-topic"
                      value={upcoming.topic}
                      onChange={(e) => patchMeeting(upcoming.id, { topic: e.target.value })}
                      onBlur={() => upcoming.topic.trim() !== (plan.upcoming?.topic ?? "") && savedToast(`Topic: ${upcoming.topic.trim() || "Check-in call"}`)}
                      onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
                      placeholder="Topic"
                      aria-label="Topic"
                    />
                    <span className="rt-when">
                      {longDay(upcoming.date)}
                      {upcoming.time ? ` · ${upcoming.time} – ${endTime(upcoming.time, upcoming.durationMinutes)}` : ""} · {upcoming.durationMinutes} min
                    </span>
                  </div>
                  <div className="rt-band-right">
                    {upcoming.link ? (
                      <>
                        <a className="rd-btn primary" href={upcoming.link} target="_blank" rel="noopener noreferrer">
                          <PlayIcon /> Join {upcoming.provider}
                        </a>
                        <span className="rt-host">
                          {upcoming.host}{" "}
                          <button type="button" onClick={() => setDlg({ kind: "link", meetingId: upcoming.id })}>
                            edit
                          </button>
                        </span>
                      </>
                    ) : (
                      <button type="button" className="rd-btn" onClick={() => setDlg({ kind: "link", meetingId: upcoming.id })}>
                        <PlusIcon /> Add a link
                      </button>
                    )}
                  </div>
                </div>
                <div className="rt-body">
                  <PrepNotes
                    key={upcoming.id}
                    value={upcoming.prepNotes}
                    onSave={(v) => {
                      patchMeeting(upcoming.id, { prepNotes: v });
                      savedToast("Prep notes");
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="rd-full">Nothing booked. Schedule the next call from the calendar; it shows in {firstName}&rsquo;s app the moment you do.</p>
            )}
          </section>

          {/* ---- Also scheduled. */}
          {also.length > 0 && (
            <section className="rd-session open rn-card">
              <div className="rn-card-head">
                <h2>Also scheduled</h2>
              </div>
              <div className="rd-rows">
                {also.map((m) => (
                  <div key={m.id} className="rd-row">
                    <div className="rd-row-main static" style={pGrid}>
                      <span />
                      <span className="rt-tile sm">
                        <small>{monthCap(m.date)}</small>
                        <b>{dayNum(m.date)}</b>
                      </span>
                      <span className="rd-ex">
                        <span className="rd-ex-name">{m.topic || "Check-in call"}</span>
                        <small>
                          {longDay(m.date)}
                          {m.time ? ` · ${m.time} – ${endTime(m.time, m.durationMinutes)}` : ""} · {m.durationMinutes} min · {m.provider}
                        </small>
                      </span>
                      <span className="rd-num quiet">{inDaysLabel(today, m.date)}</span>
                      <span className="rd-row-more">
                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${m.topic || "call"}`}>
                            <MoreIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="pb-menu">
                            <DropdownMenuItem onSelect={() => setDlg({ kind: "schedule", date: m.date, reschedule: m })}>
                              <CalendarIcon /> Reschedule
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "delete", meetingId: m.id })}>
                              <TrashIcon /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- Past calls. */}
          <section className="rd-session open rn-card">
            <div className="rn-card-head">
              <h2>Past calls</h2>
            </div>
            {past.length === 0 ? (
              <p className="rd-full">Nothing yet.</p>
            ) : (
              <div className="rd-rows">
                <div className="rd-cols" aria-hidden="true" style={pGrid}>
                  <span />
                  <span>Date</span>
                  <span>Call</span>
                  <span>Status</span>
                  <span />
                </div>
                {past.map((m) => {
                  const isOpen = openPast === m.id;
                  const st = STATUS[m.status];
                  return (
                    <div key={m.id} className={`rd-row rn-day${isOpen ? " open" : ""}`}>
                      <div className="rd-row-main" style={pGrid} onClick={() => setOpenPast((x) => (x === m.id ? null : m.id))} role="button" tabIndex={0} aria-expanded={isOpen} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpenPast((x) => (x === m.id ? null : m.id)))}>
                        <span className={`rd-chev${isOpen ? " open" : ""}`} aria-hidden="true">
                          <ChevronDownIcon />
                        </span>
                        <span className="rd-ex">
                          <span className="rd-ex-name">{shortDay(m.date)}</span>
                        </span>
                        <span className="rd-ex">
                          <span className="rd-ex-name">{m.topic || "Check-in call"}</span>
                        </span>
                        <span>
                          <span className={`rd-set rn-vs ${st.cls}`}>{st.text}</span>
                        </span>
                        <span className="rd-row-more" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu modal={false}>
                            <DropdownMenuTrigger className="rd-btn ghost sm" aria-label={`More for ${m.topic || "call"}`}>
                              <MoreIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="pb-menu">
                              <DropdownMenuItem onSelect={() => setDlg({ kind: "message", label: `${m.topic || "Check-in call"} · ${shortDay(m.date)}` })}>
                                <ChatIcon /> Message about this call
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setDlg({ kind: "delete", meetingId: m.id })}>
                                <TrashIcon /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </span>
                      </div>
                      {isOpen && <PastBody m={m} onPatch={(f) => patchMeeting(m.id, f)} />}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* ---- The month, and the picked day's bookings. */}
      </div>

      {/* ---- Dialogs. One open at a time. */}
      <Dialog open={dlg != null} onOpenChange={(o) => !o && close()}>
        {dlg?.kind === "message" && (
          <MessageDialog
            firstName={firstName}
            label={dlg.label}
            onSend={() => {
              toast.success("Sent", { description: `${firstName} gets it on Home, linked to ${dlg.label} (a draft: nothing really sent).` });
              close();
            }}
          />
        )}
        {dlg?.kind === "schedule" && (
          <ScheduleDialog
            date={dlg.date}
            reschedule={dlg.reschedule}
            lastLink={plan.lastLink}
            dots={dots}
            today={today}
            onSave={(v) => {
              if (dlg.reschedule) {
                patchMeeting(dlg.reschedule.id, { ...v, provider: v.link ? (providerOf(v.link) ?? "Join call") : "", host: v.link ? new URL(v.link).hostname : "" });
                savedToast(`Moved to ${longDay(v.date)}${v.time ? ` at ${v.time}` : ""} · ${firstName} sees the new time`);
              } else {
                setMeetings((prev) => [...prev, { id: -Date.now(), ...v, status: "scheduled", provider: v.link ? (providerOf(v.link) ?? "Join call") : "", host: v.link ? new URL(v.link).hostname : "", prepNotes: "", summary: "", notes: [], goals: [] }]);
                savedToast(`${v.topic || "Check-in call"} on ${longDay(v.date)}${v.time ? ` at ${v.time}` : ""} · ${firstName} sees it on Home`);
              }
              setSelectedDay(v.date);
              close();
            }}
          />
        )}
        {dlg?.kind === "link" && byId(dlg.meetingId) && (
          <LinkDialog
            value={byId(dlg.meetingId)!.link ?? ""}
            onSave={(link) => {
              patchMeeting(dlg.meetingId, { link: link || null, provider: link ? (providerOf(link) ?? "Join call") : "", host: link ? new URL(link).hostname : "" });
              savedToast(link ? `Link: ${firstName} gets a Join button` : "Link removed");
              close();
            }}
          />
        )}
        {dlg?.kind === "complete" && byId(dlg.meetingId) && (
          <CompleteDialog
            firstName={firstName}
            value={byId(dlg.meetingId)!.summary}
            onComplete={(summary) => {
              patchMeeting(dlg.meetingId, { status: "completed", summary });
              setOpenPast(dlg.meetingId);
              savedToast(summary ? `Completed, recap sent to ${firstName}'s Home` : "Completed");
              close();
            }}
          />
        )}
        {dlg?.kind === "delete" && byId(dlg.meetingId) && (
          <ConfirmDialog
            title={`Delete ${byId(dlg.meetingId)!.topic || "this call"}?`}
            description="The call goes, with its notes and recap. Goals set in it stay."
            confirm="Delete"
            danger
            onConfirm={() => {
              setMeetings((prev) => prev.filter((m) => m.id !== dlg.meetingId));
              draftOnly("Call deleted");
              close();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

/** The coach's prep notes on the next call: typed, then saved on purpose. */
function PrepNotes({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [text, setText] = useState(value);
  const changed = text.trim() !== value.trim();
  return (
    <div className="rt-col">
      <div className="rd-cols" aria-hidden="true">
        <span>Prep notes</span>
      </div>
      <textarea className="rt-prep" value={text} onChange={(e) => setText(e.target.value)} placeholder="What to cover, what to ask, what changed since last time…" aria-label="Prep notes" onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && changed && onSave(text.trim())} />
      {/* The moment the notes differ from what is saved, the bar comes up under the card, as on a session. */}
      {changed && (
        <div className="rd-pending rt-bar">
          <span className="rd-pending-count">1</span>
          <span className="rd-pending-text">Prep notes changed · yours only, never sent</span>
          <button type="button" className="rd-pending-ghost" onClick={() => setText(value)}>
            Discard
          </button>
          <button type="button" className="rd-pending-apply" onClick={() => onSave(text.trim())}>
            Save notes
          </button>
        </div>
      )}
    </div>
  );
}

/** An open past call: what was agreed, written for the client. */
function PastBody({ m, onPatch }: { m: DraftMeeting; onPatch: (f: Partial<DraftMeeting>) => void }) {
  const [recap, setRecap] = useState(m.summary);
  return (
    <div className="rt-past">
      <div className="rt-recap">
        <div className="rt-recap-head">
          <span className="rd-cols">What was agreed</span>
        </div>
        <textarea value={recap} onChange={(e) => setRecap(e.target.value)} rows={3} placeholder="What you covered and what you agreed…" aria-label="What was agreed" onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && recap.trim() !== m.summary.trim() && (onPatch({ summary: recap.trim() }), savedToast(`Agreed on ${shortDay(m.date)}`))} />
      </div>
      {recap.trim() !== m.summary.trim() && (
        <div className="rd-pending rt-bar">
          <span className="rd-pending-count">1</span>
          <span className="rd-pending-text">What was agreed changed · lands on {"the client's"} Home under the next call</span>
          <button type="button" className="rd-pending-ghost" onClick={() => setRecap(m.summary)}>
            Discard
          </button>
          <button type="button" className="rd-pending-apply" onClick={() => (onPatch({ summary: recap.trim() }), savedToast(`Agreed on ${shortDay(m.date)}`))}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

/** The month at a glance: this client's calls, everyone else's, and the picked day's bookings under it. */
function MiniCalendar({ today, selected, dots, onPick }: { today: string; selected: string; dots: DraftDot[]; onPick: (d: string) => void }) {
  const [cursor, setCursor] = useState(() => selected.slice(0, 7));
  const [y, mo] = cursor.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, mo, 0).getDate();
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => isoOf(new Date(y, mo - 1, i + 1)))];
  // Always six rows, so the month never changes height as it turns.
  while (cells.length < 42) cells.push(null);
  const shift = (n: number) => setCursor(isoOf(new Date(y, mo - 1 + n, 1)).slice(0, 7));
  const byDate = new Map<string, DraftDot[]>();
  dots.forEach((d) => byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]));
  const onDay = [...(byDate.get(selected) ?? [])].sort((a, b) => (a.time < b.time ? -1 : 1));
  return (
    <div className="rt-cal">
      <div className="rt-cal-head">
        <b>{first.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</b>
        <span className="rt-cal-nav">
          <button type="button" className="rd-btn ghost sm" onClick={() => shift(-1)} aria-label="Previous month">
            <ChevronLeftIcon />
          </button>
          <button type="button" className="rd-btn ghost sm next" onClick={() => shift(1)} aria-label="Next month">
            <ChevronLeftIcon />
          </button>
        </span>
      </div>
      <div className="rt-cal-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="rt-cal-dow">
            {d}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button key={i} type="button" className={`rt-cal-cell${d === today ? " today" : ""}${d === selected ? " selected" : ""}${d < today ? " past" : ""}`} onClick={() => onPick(d)} aria-pressed={d === selected}>
              {Number(d.slice(8))}
              <span className="rt-cal-dots" aria-hidden="true">
                {(byDate.get(d) ?? []).slice(0, 3).map((x, j) => (
                  <i key={j} className={x.mine ? "mine" : ""} />
                ))}
              </span>
            </button>
          ) : (
            <span key={i} />
          ),
        )}
      </div>
      <div className="rt-day">
        <div className="rt-day-head">
          <span>{longDay(selected)}</span>
        </div>
        <div className="rt-day-list">
          {onDay.length === 0 ? (
            <p className="rt-empty" style={{ padding: 0 }}>
              Nothing booked.
            </p>
          ) : (
            onDay.map((e, i) => (
              <div key={i} className={`rt-day-row${e.mine ? " mine" : ""}`}>
                <b>{e.time ? `${e.time} – ${endTime(e.time, e.durationMinutes)}` : "no time"}</b>
                <span>
                  {e.name}
                  {e.topic ? ` · ${e.topic}` : ""}
                  {e.completed ? " · done" : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="rt-legend">
        <span>
          <i className="mine" /> this client
        </span>
        <span>
          <i /> others
        </span>
      </div>
    </div>
  );
}

/** Booking a call, or moving one: the day, a 24-hour time, how long, what about, the way in. */
function ScheduleDialog({ date: initialDate, reschedule, lastLink, dots, today, onSave }: { date: string; reschedule: DraftMeeting | null; lastLink: string | null; dots: DraftDot[]; today: string; onSave: (v: { date: string; time: string; durationMinutes: number; topic: string; link: string | null }) => void }) {
  const [date, setDate] = useState(reschedule?.date ?? initialDate);
  const [time, setTime] = useState(reschedule?.time ?? "");
  const [duration, setDuration] = useState(reschedule?.durationMinutes ?? 30);
  const [topic, setTopic] = useState(reschedule?.topic ?? "");
  const [link, setLink] = useState(reschedule?.link ?? "");
  // Overlap with another client at the chosen slot, as the coach types.
  const linkOk = link.trim() === "" || providerOf(link) != null;
  return (
    <DialogContent className="rd-dlg rt-dlg">
      <DialogHeader>
        <DialogTitle>{reschedule ? "Reschedule" : "Schedule a meeting"}</DialogTitle>
      </DialogHeader>
      {/* The month on the left, with the day's bookings under it; the same date typed on the right. */}
      <div className="rdd-cols">
        <div className="rt-dlg-cal">
          <MiniCalendar today={today} selected={date} dots={dots} onPick={setDate} />
        </div>
        <div className="rdd-fields">
          <div className="rd-field-row">
            <label className="rd-field">
              <span>Date</span>
              <DateText value={date} onChange={setDate} label="Date" />
            </label>
            <label className="rd-field">
              <span>Time · 24h</span>
              <input type="text" inputMode="numeric" value={time} onChange={(e) => setTime(e.target.value)} onBlur={() => setTime(tidyTime(time))} placeholder="14:30" />
            </label>
          </div>
          <div className="rd-field">
            <span>Duration</span>
            <div className="rt-durations">
              {[15, 30, 45, 60].map((d) => (
                <button key={d} type="button" className={`rd-chip${duration === d ? " on" : ""}`} onClick={() => setDuration(d)}>
                  {d} min
                </button>
              ))}
            </div>
          </div>
          <label className="rd-field">
            <span>Topic</span>
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Week 6 check-in" maxLength={80} autoFocus={!reschedule} />
          </label>
          <label className="rd-field">
            <span className="rd-field-row" style={{ justifyContent: "space-between" }}>
              Meeting link · optional
              {lastLink && !link && (
                <button type="button" className="rd-ex-btn" style={{ color: "#2f5d8f", letterSpacing: 0, textTransform: "none" }} onClick={() => setLink(lastLink)}>
                  Reuse last
                </button>
              )}
            </span>
            <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" />
          </label>
        </div>
      </div>
      <DialogFooter>
        <span className="rd-dlg-hint grow">{link.trim() && !linkOk ? "That does not look like a link yet." : ""}</span>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!date || !linkOk} onClick={() => onSave({ date, time: tidyTime(time), durationMinutes: duration, topic: topic.trim(), link: link.trim() || null })}>
          {reschedule ? "Move the call" : "Schedule"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

/** The call's link, on its own so a long URL has room and the provider is read back before saving. */
function LinkDialog({ value, onSave }: { value: string; onSave: (link: string) => void }) {
  const [link, setLink] = useState(value);
  const provider = link.trim() ? providerOf(link) : null;
  const ok = link.trim() === "" || provider != null;
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>{value ? "Meeting link" : "Add a meeting link"}</DialogTitle>
      </DialogHeader>
      <label className="rd-field">
        <span>Link</span>
        <input type="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/abc-defg-hij" autoFocus onKeyDown={(e) => e.key === "Enter" && ok && onSave(link.trim())} />
      </label>
      <DialogFooter>
        <span className="rd-dlg-hint grow">{link.trim() && !provider ? "That does not look like a link yet." : ""}</span>
        <DialogClose className="rd-btn">Cancel</DialogClose>
        <button type="button" className="rd-btn primary" disabled={!ok} onClick={() => onSave(link.trim())}>
          {value ? (link.trim() ? "Save link" : "Remove link") : "Add link"}
        </button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Marking a call completed: the last chance to tell the client what came out of it. */
function CompleteDialog({ firstName, value, onComplete }: { firstName: string; value: string; onComplete: (summary: string) => void }) {
  const [recap, setRecap] = useState(value);
  return (
    <DialogContent className="rd-dlg">
      <DialogHeader>
        <DialogTitle>How did the call go?</DialogTitle>
        <DialogDescription>What you write here reaches {firstName} on their Home, under their next call. Your prep notes stay yours.</DialogDescription>
      </DialogHeader>
      <label className="rd-field">
        <span>Recap for {firstName}</span>
        <textarea rows={4} value={recap} onChange={(e) => setRecap(e.target.value)} placeholder="What you covered and what you agreed…" autoFocus onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && recap.trim() && onComplete(recap.trim())} />
      </label>
      <DialogFooter>
        <button type="button" className="rd-btn" onClick={() => onComplete("")}>
          Complete without one
        </button>
        <button type="button" className="rd-btn primary" disabled={!recap.trim()} onClick={() => onComplete(recap.trim())}>
          Save and complete
        </button>
      </DialogFooter>
    </DialogContent>
  );
}
