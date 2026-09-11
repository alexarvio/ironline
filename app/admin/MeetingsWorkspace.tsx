"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  addMeetingAction,
  addMeetingNoteAction,
  completeMeetingAction,
  removeMeetingAction,
  removeClientGoalAction,
  reorderClientGoalsAction,
  removeMeetingNoteAction,
  setMeetingStatusAction,
  updateMeetingAction,
} from "../lib/actions";
import type { GoalTracking } from "../lib/goalView";
import type { GoalEditorOptions } from "../lib/queries";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import DragList from "../components/DragList";
import MeetingStatusSelect, { type MeetingStatus } from "./MeetingStatusSelect";
import { GoalEditor } from "./GoalsPanel";

// The Meetings tab: the next call with everything to prepare it, the past
// calls with their notes, a month at a glance, and the form to book the
// next one. All data arrives from the server panel as plain props; the
// writes are the server actions.

export type WsGoal = {
  id: number;
  text: string;
  tone: "green" | "orange" | "muted";
  /** Live standing in a few words: "82.5 kg · behind", "75 × 12 · 5 kg to go". */
  status: string;
  /** What it is tracked by, in words. */
  def: string;
  done: boolean;
  meetingId: number | null;
  tracking: GoalTracking | null;
};
export type WsNote = { id: number; text: string; createdAt: string };
export type WsMeeting = {
  id: number;
  date: string;
  time: string;
  durationMinutes: number;
  topic: string;
  status: MeetingStatus;
  link: string | null;
  provider: string;
  host: string;
  prepNotes: string;
  notes: WsNote[];
  goals: WsGoal[];
};
export type WsOther = { date: string; time: string; durationMinutes: number; name: string };
export type WsDot = { date: string; time: string; durationMinutes: number; name: string; topic: string; mine: boolean; completed: boolean };

export type MeetingsWorkspaceProps = {
  clientId: number;
  firstName: string;
  today: string;
  upcoming: WsMeeting | null;
  alsoScheduled: WsMeeting[];
  past: WsMeeting[];
  goals: WsGoal[];
  goalsSetLabel: string;
  dots: WsDot[];
  others: WsOther[];
  lastLink: string | null;
  goalOptions: GoalEditorOptions;
};

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / DAY);
const monthCap = (d: string) => parse(d).toLocaleDateString("en-US", { month: "short" });
const dayNum = (d: string) => String(parse(d).getDate());
const longDay = (d: string) => parse(d).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" });
const toMin = (t: string) => {
  const [h, m] = t.split(":").map((n) => Number(n) || 0);
  return h * 60 + m;
};
const fromMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
/** "9" → "09:00", "930" → "09:30", "14.30" → "14:30"; anything unreadable is left as typed. */
const tidyTime = (raw: string): string => {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  let h: number;
  let m: number;
  if (digits.length <= 2) {
    h = Number(digits);
    m = 0;
  } else {
    h = Number(digits.slice(0, digits.length - 2));
    m = Number(digits.slice(-2));
  }
  if (h > 23 || m > 59) return raw;
  return fromMin(h * 60 + m);
};
const endTime = (time: string, dur: number) => (time ? fromMin(toMin(time) + dur) : "");
const agoLabel = (today: string, date: string) => {
  const n = daysBetween(date, today);
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 7) return `${n} days ago`;
  const w = Math.round(n / 7);
  return `${w} week${w === 1 ? "" : "s"} ago`;
};
const inDaysLabel = (today: string, date: string) => {
  const n = daysBetween(today, date);
  return n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${n} days`;
};
const noteDate = (createdAt: string) => {
  const d = new Date(createdAt.replace(" ", "T"));
  return isNaN(d.getTime()) ? createdAt : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};
const STATUS_LABEL: Record<MeetingStatus, string> = { scheduled: "Scheduled", completed: "Completed", "no-show": "No-show", cancelled: "Cancelled" };

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export default function MeetingsWorkspace(p: MeetingsWorkspaceProps) {
  // The schedule form. Rescheduling loads an existing meeting into it.
  const [form, setForm] = useState({
    rescheduleId: null as number | null,
    date: p.today,
    time: "",
    duration: 30,
    topic: "",
    link: "",
  });
  const formRef = useRef<HTMLDivElement>(null);
  const [pending, start] = useTransition();
  const [goalEditing, setGoalEditing] = useState<"new" | number | null>(null);

  const reschedule = (m: WsMeeting) => {
    setForm({ rescheduleId: m.id, date: m.date, time: m.time, duration: m.durationMinutes, topic: m.topic, link: m.link ?? "" });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Overlap with another client at the chosen slot, as the coach types.
  const conflict = (() => {
    if (!form.time) return null;
    const s = toMin(form.time);
    const e = s + form.duration;
    return p.others.find((o) => o.date === form.date && toMin(o.time) < e && s < toMin(o.time) + o.durationMinutes) ?? null;
  })();

  const submit = (fd: FormData) =>
    start(async () => {
      // Whatever was typed for the time is tidied here too, in case the
      // field never lost focus before Schedule was pressed.
      fd.set("time", tidyTime(String(fd.get("time") ?? "")));
      if (form.rescheduleId != null) await updateMeetingAction(fd);
      else await addMeetingAction(fd);
      setForm({ rescheduleId: null, date: form.date, time: "", duration: 30, topic: "", link: "" });
    });

  return (
    <div className="mw-wrap">
    <div className="mw">
      <div className="mw-left">
        {p.upcoming ? (
          <UpcomingCard
            clientId={p.clientId}
            m={p.upcoming}
            today={p.today}
            goals={p.goals}
            goalsSetLabel={p.goalsSetLabel}
            onReschedule={() => reschedule(p.upcoming!)}
            goalEditing={goalEditing}
            onEditGoal={setGoalEditing}
            goalEditor={
              goalEditing != null ? (
                <GoalEditor
                  clientId={p.clientId}
                  goal={
                    goalEditing === "new"
                      ? null
                      : (() => {
                          const g = p.goals.find((x) => x.id === goalEditing);
                          return g ? { id: g.id, text: g.text, done: g.done, tracking: g.tracking, label: g.def } : null;
                        })()
                  }
                  options={p.goalOptions}
                  meetingId={goalEditing === "new" ? p.upcoming.id : null}
                  onClose={() => setGoalEditing(null)}
                />
              ) : null
            }
          />
        ) : (
          <div className="mw-empty">
            <strong>Nothing booked.</strong> Schedule the next call on the right; it shows in {p.firstName}&rsquo;s app the moment you do.
          </div>
        )}

        {p.alsoScheduled.length > 0 && (
          <section className="mw-also">
            <div className="mw-label-row">
              <span className="mw-label">Also scheduled</span>
            </div>
            {p.alsoScheduled.map((m) => (
              <div key={m.id} className="mw-row">
                <span className="mw-tile-sm">
                  <span className="mw-tile-sm-month">{monthCap(m.date)}</span>
                  <span className="mw-tile-sm-day">{dayNum(m.date)}</span>
                </span>
                <span className="mw-row-main">
                  <span className="mw-row-topic">{m.topic || "Check-in call"}</span>
                  <span className="mw-row-meta">
                    {longDay(m.date)}
                    {m.time ? ` · ${m.time} – ${endTime(m.time, m.durationMinutes)}` : ""} · {m.durationMinutes} min · {m.provider}
                  </span>
                </span>
                <span className="mw-row-tools">
                  <button type="button" className="mw-ghost" onClick={() => reschedule(m)}>
                    Reschedule
                  </button>
                  <ConfirmDeleteButton action={removeMeetingAction} hiddenFields={{ id: m.id }} label={`Delete meeting on ${m.date}`} />
                </span>
              </div>
            ))}
          </section>
        )}

        <PastMeetings past={p.past} today={p.today} />
      </div>

      <div className="mw-right">
        <MiniCalendar today={p.today} selected={form.date} dots={p.dots} onPick={(d) => setForm((f) => ({ ...f, date: d }))} />

        <div className="mw-card mw-form" ref={formRef}>
          <div className="mw-form-head">
            <span className="mw-card-title">{form.rescheduleId != null ? "Reschedule" : "Schedule a meeting"}</span>
            <span className={`mw-form-free${conflict ? " busy" : ""}`}>
              {longDay(form.date)} · {conflict ? "busy" : "free"}
            </span>
          </div>
          <form action={submit} className="mw-form-body">
            {form.rescheduleId != null ? <input type="hidden" name="id" value={form.rescheduleId} /> : <input type="hidden" name="clientId" value={p.clientId} />}
            <input type="hidden" name="durationMinutes" value={form.duration} />
            <div className="mw-grid2">
              <label className="mw-field">
                <span>Date</span>
                <input name="date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
              </label>
              <label className="mw-field">
                <span>Time</span>
                {/* A plain text field, not type="time": on a 12-hour locale the
                    native one shows an AM/PM slot and rejects the value until
                    it is filled. Typed as 24-hour, tidied on blur: 9 → 09:00,
                    930 → 09:30, 14.30 → 14:30. */}
                <input
                  name="time"
                  type="text"
                  inputMode="numeric"
                  placeholder="14:30"
                  value={form.time}
                  onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                  onBlur={(e) => setForm((f) => ({ ...f, time: tidyTime(e.target.value) }))}
                  onKeyDown={(e) => e.key === "Enter" && setForm((f) => ({ ...f, time: tidyTime(f.time) }))}
                  pattern="([01]?[0-9]|2[0-3]):[0-5][0-9]"
                  title="24-hour time, e.g. 14:30"
                />
              </label>
            </div>
            <div className="mw-field">
              <span>Duration</span>
              <div className="mw-chips">
                {[15, 30, 45, 60].map((d) => (
                  <button key={d} type="button" className={`mw-chip${form.duration === d ? " active" : ""}`} onClick={() => setForm((f) => ({ ...f, duration: d }))}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <label className="mw-field">
              <span>Topic</span>
              <input name="topic" type="text" value={form.topic} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="Week 6 check-in" />
            </label>
            <label className="mw-field">
              <span className="mw-field-row">
                Meeting link (optional)
                {p.lastLink && (
                  <button type="button" className="mw-textbtn" onClick={() => setForm((f) => ({ ...f, link: p.lastLink ?? "" }))}>
                    Reuse last
                  </button>
                )}
              </span>
              <input name="link" type="url" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} placeholder="https://meet.google.com/…" />
              <small>Detected provider shows as the button label. Clickable for both of you.</small>
            </label>
            <div className={`mw-info${conflict ? " warn" : ""}`}>
              {conflict
                ? `Overlaps with ${conflict.name}'s meeting at ${conflict.time} (${conflict.durationMinutes} min).`
                : "No overlap with other clients at this time."}
            </div>
            <div className="mw-form-foot">
              {form.rescheduleId != null && (
                <button type="button" className="mw-ghost" onClick={() => setForm({ rescheduleId: null, date: p.today, time: "", duration: 30, topic: "", link: "" })}>
                  Cancel
                </button>
              )}
              <button type="submit" className="mw-primary" disabled={pending}>
                {pending ? "Saving…" : form.rescheduleId != null ? "Save new time" : `Schedule · shows in ${p.firstName}'s app`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </div>
  );
}

function UpcomingCard({
  clientId,
  m,
  today,
  goals,
  goalsSetLabel,
  onReschedule,
  goalEditing,
  onEditGoal,
  goalEditor,
}: {
  clientId: number;
  m: WsMeeting;
  today: string;
  goals: WsGoal[];
  goalsSetLabel: string;
  onReschedule: () => void;
  goalEditing: "new" | number | null;
  onEditGoal: (which: "new" | number | null) => void;
  goalEditor: React.ReactNode;
}) {
  const [topic, setTopic] = useState(m.topic);
  const [link, setLink] = useState(m.link ?? "");
  const [editingLink, setEditingLink] = useState(false);
  const [prep, setPrep] = useState(m.prepNotes);
  const [prepState, setPrepState] = useState<"saved" | "typing" | "saving">("saved");
  const [, start] = useTransition();

  const save = (fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set("id", String(m.id));
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
    return updateMeetingAction(fd);
  };

  // Topic and prep notes save themselves 800ms after the last keystroke.
  const firstTopic = useRef(true);
  useEffect(() => {
    if (firstTopic.current) {
      firstTopic.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (topic.trim() !== m.topic) start(() => save({ topic: topic.trim() }));
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setPrepState("typing");
    const t = setTimeout(() => {
      setPrepState("saving");
      start(async () => {
        await save({ prepNotes: prep });
        setPrepState("saved");
      });
    }, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prep]);

  const commitLink = () => {
    setEditingLink(false);
    if (link.trim() !== (m.link ?? "")) start(() => save({ link: link.trim() }));
  };

  return (
    <div className="mw-card mw-upcoming">
      <div className="mw-band">
        <div className="mw-tile">
          <span className="mw-tile-month">{monthCap(m.date)}</span>
          <span className="mw-tile-day">{dayNum(m.date)}</span>
        </div>
        <div className="mw-band-body">
          <div className="mw-eyebrow">Upcoming · {inDaysLabel(today, m.date)}</div>
          <input
            className="mw-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onBlur={() => topic.trim() !== m.topic && start(() => save({ topic: topic.trim() }))}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
            placeholder="Topic"
            aria-label="Topic"
          />
          <div className="mw-band-when">
            {longDay(m.date)}
            {m.time ? ` · ${m.time} – ${endTime(m.time, m.durationMinutes)}` : ""} · {m.durationMinutes} min
          </div>
        </div>
        <div className="mw-band-right">
          {editingLink ? (
            <input
              className="mw-link-input"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={commitLink}
              onKeyDown={(e) => e.key === "Enter" && commitLink()}
              placeholder="https://meet.google.com/…"
              autoFocus
              aria-label="Meeting link"
            />
          ) : m.link ? (
            <>
              <a className="mw-join" href={m.link} target="_blank" rel="noopener noreferrer">
                <CameraIcon /> Join {m.provider}
              </a>
              <span className="mw-link-host">
                {m.host}{" "}
                <button type="button" className="mw-link-edit" onClick={() => setEditingLink(true)}>
                  edit
                </button>
              </span>
            </>
          ) : (
            <button type="button" className="mw-join ghost" onClick={() => setEditingLink(true)}>
              + Add link
            </button>
          )}
        </div>
      </div>

      <div className="mw-upcoming-body">
        <div className="mw-col">
          <div className="mw-label-row">
            <span className="mw-label">Goals to review</span>
            <span className="mw-label-right">{goalsSetLabel}</span>
          </div>
          {goals.length === 0 && <p className="mw-muted">No goals yet.</p>}
          <DragList
            onReorder={(ids) => void reorderClientGoalsAction(clientId, ids)}
            items={goals.map((g) => ({
              id: g.id,
              node:
                goalEditing === g.id ? (
                  <div className="mw-goal-editing">{goalEditor}</div>
                ) : (
                  <div className="mw-goal">
                    <span className={`mw-dot ${g.tone}`} />
                    <span className="mw-goal-text">{g.text}</span>
                    {g.status && <span className={`mw-goal-status ${g.tone}`}>{g.status}</span>}
                    <span className="mw-goal-tools">
                      <button type="button" className="ad-goal-edit" onClick={() => onEditGoal(g.id)}>
                        Edit
                      </button>
                      <ConfirmDeleteButton action={removeClientGoalAction} hiddenFields={{ id: g.id }} label={`Delete goal: ${g.text}`} />
                    </span>
                  </div>
                ),
            }))}
          />
          {goalEditing === "new" ? (
            goalEditor
          ) : (
            <button type="button" className="mw-add-goal" onClick={() => onEditGoal("new")} disabled={goalEditing != null}>
              + Add goal
            </button>
          )}
        </div>
        <div className="mw-col">
          <div className="mw-label-row">
            <span className="mw-label">Prep notes</span>
            <span className="mw-label-right">private</span>
          </div>
          <textarea className="mw-prep" value={prep} onChange={(e) => setPrep(e.target.value)} placeholder="What to cover, what to ask, what changed since last time…" />
          <div className="mw-prep-foot">
            <span className="mw-muted">
              {prepState === "saved" ? "Saved" : prepState === "saving" ? "Saving…" : "Typing…"} · shows to client: <b>date, time, topic, link</b>
            </span>
            <span className="mw-prep-actions">
              <form action={setMeetingStatusAction}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="status" value="cancelled" />
                <button type="submit" className="mw-ghost" title="Cancel this meeting; it moves to past as cancelled">
                  Cancel
                </button>
              </form>
              <button type="button" className="mw-ghost" onClick={onReschedule}>
                Reschedule
              </button>
              <form action={completeMeetingAction}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="mw-complete">
                  Mark completed
                </button>
              </form>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PastMeetings({ past, today }: { past: WsMeeting[]; today: string }) {
  const [openId, setOpenId] = useState<number | null>(past[0]?.id ?? null);
  return (
    <section className="mw-past">
      <div className="mw-label-row">
        <span className="mw-label">Past meetings · {past.length}</span>
        <span className="mw-label-right">Newest first</span>
      </div>
      {past.length === 0 && <p className="mw-muted">Nothing yet.</p>}
      {past.map((m) => {
        const open = m.id === openId;
        return (
          <div key={m.id} className={`mw-past-row${open ? " open" : ""}`}>
            <button type="button" className="mw-past-head" onClick={() => setOpenId(open ? null : m.id)} aria-expanded={open}>
              <span className="mw-tile-sm">
                <span className="mw-tile-sm-month">{monthCap(m.date)}</span>
                <span className="mw-tile-sm-day">{dayNum(m.date)}</span>
              </span>
              <span className="mw-row-main">
                <span className="mw-row-topic">{m.topic || "Check-in call"}</span>
                <span className="mw-row-meta">
                  {parse(m.date).toLocaleDateString("en-US", { weekday: "long" })}
                  {m.time ? ` ${m.time}` : ""} · {m.durationMinutes} min · {m.provider}
                </span>
              </span>
              <span className={`mw-pill ${m.status}`}>{STATUS_LABEL[m.status]}</span>
              <span className="mw-row-summary">
                {agoLabel(today, m.date)} · {m.goals.length} goal{m.goals.length === 1 ? "" : "s"} set · {m.notes.length} note{m.notes.length === 1 ? "" : "s"}
              </span>
              <span className={`mw-chev${open ? " up" : ""}`}>⌄</span>
            </button>
            {open && (
              <div className="mw-past-body">
                <div className="mw-past-tools">
                  <MeetingStatusSelect meetingId={m.id} status={m.status} />
                  <ConfirmDeleteButton action={removeMeetingAction} hiddenFields={{ id: m.id }} label={`Delete meeting on ${m.date}`} />
                </div>
                <div className="mw-past-cols">
                  <div className="mw-col">
                    <div className="mw-label">Meeting notes</div>
                    {m.notes.length === 0 && <p className="mw-muted">No notes yet.</p>}
                    {m.notes.map((n) => (
                      <div key={n.id} className="mw-note">
                        <div className="mw-note-text">{n.text}</div>
                        <div className="mw-note-foot">
                          <span className="mw-note-time">{noteDate(n.createdAt)}</span>
                          <span className="mw-note-del">
                            <ConfirmDeleteButton action={removeMeetingNoteAction} hiddenFields={{ id: n.id }} label="Delete note" />
                          </span>
                        </div>
                      </div>
                    ))}
                    <form action={addMeetingNoteAction} className="mw-note-add">
                      <input type="hidden" name="meetingId" value={m.id} />
                      <input name="text" type="text" placeholder="Add a note…" required />
                      <button type="submit" className="mw-ghost">
                        Add
                      </button>
                    </form>
                  </div>
                  <div className="mw-col">
                    <div className="mw-label">Goals set in this meeting</div>
                    {m.goals.length === 0 && <p className="mw-muted">None set here.</p>}
                    {m.goals.map((g) => (
                      <div key={g.id} className="mw-goal">
                        <span className={`mw-dot ${g.done ? "green" : g.tone}`} />
                        <span className="mw-goal-text">
                          {g.text}
                          <span className="mw-goal-def">{g.def}</span>
                        </span>
                      </div>
                    ))}
                    {m.goals.length > 0 && (
                      <div className="mw-muted mw-goals-foot">
                        Live status comes from the Goals card · {m.goals.filter((g) => !g.done).length} active / {m.goals.filter((g) => g.done).length} closed
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

function MiniCalendar({ today, selected, dots, onPick }: { today: string; selected: string; dots: WsDot[]; onPick: (d: string) => void }) {
  const [cursor, setCursor] = useState(() => selected.slice(0, 7));
  const [y, mo] = cursor.split("-").map(Number);
  const first = new Date(y, mo - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, mo, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => iso(new Date(y, mo - 1, i + 1)))];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => {
    const d = new Date(y, mo - 1 + n, 1);
    setCursor(iso(d).slice(0, 7));
  };
  const byDate = new Map<string, WsDot[]>();
  dots.forEach((d) => byDate.set(d.date, [...(byDate.get(d.date) ?? []), d]));
  const label = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="mw-card mw-cal">
      <div className="mw-cal-head">
        <span className="mw-card-title">{label}</span>
        <span className="mw-cal-nav">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month">
            ‹
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month">
            ›
          </button>
        </span>
      </div>
      <div className="mw-cal-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="mw-cal-dow">
            {d}
          </span>
        ))}
        {cells.map((d, i) =>
          d ? (
            <button
              key={i}
              type="button"
              className={`mw-cal-cell${d === today ? " today" : ""}${d === selected ? " selected" : ""}`}
              onClick={() => onPick(d)}
            >
              {Number(d.slice(8))}
              <span className="mw-cal-dots">
                {(byDate.get(d) ?? []).slice(0, 3).map((x, j) => (
                  <span key={j} className={`mw-cal-dot${x.mine ? (x.completed ? " done" : " mine") : ""}`} />
                ))}
              </span>
            </button>
          ) : (
            <span key={i} />
          )
        )}
      </div>
      {/* What is already booked on the picked day, so a slot is chosen
          around it rather than on top of it. */}
      <div className="mw-cal-day">
        <div className="mw-cal-day-head">{parse(selected).toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short" })}</div>
        {(byDate.get(selected) ?? []).length === 0 ? (
          <div className="mw-cal-day-empty">Nothing booked</div>
        ) : (
          [...(byDate.get(selected) ?? [])]
            .sort((a, b) => (a.time < b.time ? -1 : 1))
            .map((e, i) => (
              <div key={i} className={`mw-cal-day-row${e.mine ? " mine" : ""}${e.completed ? " done" : ""}`}>
                <span className="mw-cal-day-time">{e.time ? `${e.time} – ${endTime(e.time, e.durationMinutes)}` : "no time"}</span>
                <span className="mw-cal-day-who">
                  {e.name}
                  {e.topic ? ` · ${e.topic}` : ""}
                </span>
                {e.completed && <span className="mw-cal-day-tick">✓</span>}
              </div>
            ))
        )}
      </div>
      <div className="mw-cal-legend">
        <span>
          <i className="mw-cal-dot mine" /> this client
        </span>
        <span>
          <i className="mw-cal-dot done" /> completed
        </span>
        <span>
          <i className="mw-cal-dot" /> others
        </span>
        <a href={`/admin?view=calendar&month=${cursor}&day=${selected}`} className="mw-textbtn">
          Open calendar →
        </a>
      </div>
    </div>
  );
}
