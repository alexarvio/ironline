import {
  addMeetingAction,
  addMeetingNoteAction,
  removeMeetingAction,
  removeMeetingNoteAction,
} from "../lib/actions";
import { getConflictsForClient, listMeetingNotes, listMeetings, localDateStr, MeetingConflict } from "../lib/queries";
import MeetingStatusSelect from "./MeetingStatusSelect";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

function otherSide(conflict: MeetingConflict, clientId: number) {
  return conflict.a.client_id === clientId ? conflict.b : conflict.a;
}

function MeetingCard({ meeting }: { meeting: ReturnType<typeof listMeetings>[number] }) {
  const notes = listMeetingNotes(meeting.id);

  return (
    <div className="nutrition-table-wrap">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <h3 style={{ margin: 0 }}>
            {meeting.date} {meeting.time && `· ${meeting.time} · ${meeting.duration_minutes}min`}
          </h3>
          <div className="exercise-meta">{meeting.topic || "No topic set"}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <MeetingStatusSelect meetingId={meeting.id} status={meeting.status} />
          <ConfirmDeleteButton
            action={removeMeetingAction}
            hiddenFields={{ id: meeting.id }}
            label={`Delete meeting on ${meeting.date}`}
          />
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <h4 style={{ margin: "0 0 8px", fontSize: "0.85rem", color: "var(--steel)" }}>Notes log</h4>
        {notes.length === 0 ? (
          <p className="empty-note" style={{ marginBottom: 10 }}>
            No notes yet.
          </p>
        ) : (
          <div className="invoice-list" style={{ marginBottom: 10 }}>
            {notes.map((n) => (
              <div key={n.id} className="invoice-row">
                <div>
                  <div className="invoice-desc">{n.text}</div>
                  <div className="exercise-meta">{n.created_at}</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <ConfirmDeleteButton action={removeMeetingNoteAction} hiddenFields={{ id: n.id }} label="Delete note" />
                </div>
              </div>
            ))}
          </div>
        )}
        <form action={addMeetingNoteAction} className="add-invoice-form">
          <input type="hidden" name="meetingId" value={meeting.id} />
          <input name="text" type="text" placeholder="Add a note…" required />
          <button className="btn" type="submit">
            Add note
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MeetingsPanel({ clientId }: { clientId: number }) {
  const meetings = listMeetings(clientId);
  const conflicts = getConflictsForClient(clientId);

  return (
    <div>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        Schedule check-in calls with this client and keep a running notes log for each one. Jot
        something down before, during, or after the call any time. Every meeting also shows up on
        the Calendar, and if a time overlaps with another client you&rsquo;ll see a warning below.
      </p>

      {conflicts.length > 0 && (
        <div className="conflict-banner">
          <strong>Double-booking warning</strong>
          <ul>
            {conflicts.map((c, i) => {
              const mine = c.a.client_id === clientId ? c.a : c.b;
              const other = otherSide(c, clientId);
              return (
                <li key={i}>
                  {mine.date} at {mine.time} ({mine.duration_minutes}min) overlaps with{" "}
                  <strong>{other.clientName}</strong>&rsquo;s meeting at {other.time}.
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="nutrition-table-wrap">
        <h3>Schedule a meeting</h3>
        <form action={addMeetingAction} className="add-invoice-form">
          <input type="hidden" name="clientId" value={clientId} />
          <input name="date" type="date" required defaultValue={localDateStr()} />
          <input name="time" type="time" />
          <input name="durationMinutes" type="number" min={5} step={5} defaultValue={60} title="Duration (minutes)" style={{ maxWidth: 90 }} />
          <input name="topic" type="text" placeholder="Topic (e.g. Monthly check-in)" />
          <button className="btn" type="submit">
            Schedule
          </button>
        </form>
      </div>

      {meetings.length === 0 ? (
        <p className="empty-note">No meetings scheduled yet.</p>
      ) : (
        meetings.map((m) => <MeetingCard key={m.id} meeting={m} />)
      )}
    </div>
  );
}
