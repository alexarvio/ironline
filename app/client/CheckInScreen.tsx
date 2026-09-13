"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon } from "../components/icons";
import { logMetricPeriodAction, saveMeasurementCheckInAction } from "../lib/actions";

// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx for why
// a "use client" file importing queries.ts breaks the dev server). All data
// comes in as plain props, computed server-side by getCheckInSections().
export type CheckInMetric = {
  id: string;
  name: string;
  unit: string;
  step: string;
  value: string;
  hint: string | null;
  scaleMax: number | null;
};
export type CheckInSection = {
  id: "daily" | "weekly" | "measurements";
  label: string;
  intro: string;
  /** The client's note for this period, if they wrote one. */
  note: string | null;
  metrics: CheckInMetric[];
};
// Everything the screen needs, computed server-side by getCheckInSections()
// and handed down through AppShell. Progress pictures have their own screen.
export type CheckInProps = {
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  // Which segments still have no entry for their current period — drives
  // the dot on each tab so the client can see where action is needed.
  dueSections: string[];
};

// The whole check-in in one screen: three sections the client taps between,
// each a list of "what your coach asked for" rows. Inputs are controlled so
// the header's filled/total counter and the per-row underline react as you
// type; the actual save is a real form post to the same server actions the
// old separate forms used, so what reaches the coach is unchanged.
// "82.5", "82,5" and "82.50" are the same reading: the server stores the
// number, so comparing typed text against the persisted value numerically
// is what tells us whether anything has actually changed.
function sameNumber(a: string, b: string) {
  if (a === b) return true;
  if (a === "" || b === "") return false;
  return Number(a.replace(",", ".")) === Number(b.replace(",", "."));
}

// The input is plain text with a decimal keypad rather than type="number":
// on phones set to Finnish (and most of Europe) the keypad offers a comma,
// which a number input silently rejects, so the client could not type
// decimals. Here the comma becomes a dot and anything else non-numeric is
// dropped as it's typed. Rating scales take whole numbers only.
function cleanNumeric(raw: string, wholeOnly: boolean) {
  let out = "";
  let seenDot = false;
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") out += ch;
    else if ((ch === "." || ch === ",") && !wholeOnly && !seenDot) {
      out += ".";
      seenDot = true;
    }
  }
  return out;
}

export default function CheckInScreen({
  clientId,
  dateLabel,
  today,
  sections,
  initialSection,
  dueSections,
  onBack,
}: {
  clientId: number;
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  initialSection: string;
  dueSections: string[];
  onBack: () => void;
}) {
  const startIndex = Math.max(
    0,
    sections.findIndex((s) => s.id === initialSection)
  );
  const [sectionId, setSectionId] = useState(sections[startIndex]?.id ?? sections[0]?.id);
  // Seeded from what's already logged for the current period, so reopening
  // the screen shows what was sent rather than blanking it out.
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(
      sections.map((s) => [s.id, Object.fromEntries(s.metrics.map((m) => [m.id, m.value]))])
    )
  );

  const active = sections.find((s) => s.id === sectionId);

  // Derived from the active section; all computed before the early return
  // below so the hooks that follow run in the same order on every render.
  const activeValues = active ? values[active.id] ?? {} : {};
  // The note for the coach, per section, edited alongside the numbers.
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(sections.map((s) => [s.id, s.note ?? ""])));
  const activeNote = active ? notes[active.id] ?? "" : "";
  const noteDirty = !!active && activeNote.trim() !== (active.note ?? "").trim();
  const metrics = active?.metrics ?? [];
  const filled = metrics.filter((m) => (activeValues[m.id] ?? "").length > 0);
  const complete = filled.length === metrics.length && metrics.length > 0;
  const isMeasurements = active?.id === "measurements";
  const remaining = metrics.length - filled.length;

  // m.value is what's actually persisted for this period, so comparing the
  // two tells us whether there's anything left to send — no separate "saved"
  // flag to keep in sync, and editing a saved section re-arms Save by
  // itself. After a submit the server re-renders with the new values, so
  // this settles into the saved state on its own.
  const dirty = metrics.some((m) => !sameNumber(activeValues[m.id] ?? "", m.value)) || noteDirty;
  const savedSomething = metrics.some((m) => m.value.length > 0);
  const isSaved = !dirty && savedSomething;
  // A note on its own is fine once the numbers are in; it just can't be the
  // only thing sent for a period with nothing logged.
  const canSave = dirty && (filled.length > 0 || (noteDirty && savedSomething));

  // The confirmation banner shows after a save THIS visit lands — not on
  // merely opening a section that was saved earlier. `submitted` is armed
  // by the form's submit and disarmed when the server re-render brings the
  // values back matching (isSaved), which is the moment the save is real.
  const submitted = useRef(false);
  const [justSaved, setJustSaved] = useState(false);
  // A saved section shows as a collapsed "done" card rather than the open
  // form; Edit reopens it (a client may have typed something wrong), and a
  // fresh save, or Done, folds it back up.
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (isSaved && submitted.current) {
      submitted.current = false;
      // Deferred a tick so the state change isn't synchronous inside the effect.
      const t = setTimeout(() => {
        setJustSaved(true);
        setEditing(false);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isSaved]);
  const collapsed = isSaved && !editing;
  const armSubmit = () => {
    submitted.current = true;
    setJustSaved(false);
  };

  if (!active) {
    return (
      <div className="ci-screen">
        <p className="ci-empty">Your coach hasn&rsquo;t set up any check-in metrics yet.</p>
      </div>
    );
  }

  const setValue = (metricId: string, v: string) => {
    setJustSaved(false);
    setValues((prev) => ({ ...prev, [active.id]: { ...prev[active.id], [metricId]: v } }));
  };
  const switchSection = (id: CheckInSection["id"]) => {
    setSectionId(id);
    setEditing(false);
    setJustSaved(false);
  };
  // Leaving edit mode without saving puts back what the coach actually has.
  const stopEditing = () => {
    setValues((prev) => ({
      ...prev,
      [active.id]: Object.fromEntries(active.metrics.map((m) => [m.id, m.value])),
    }));
    setEditing(false);
  };
  const showValue = (m: CheckInMetric) =>
    m.scaleMax ? `${m.value}/${m.scaleMax}` : `${m.value}${m.unit ? ` ${m.unit}` : ""}`;

  return (
    <div className="ci-screen">
      <header className="ci-header">
        <button type="button" className="ci-back" onClick={onBack} aria-label="Back to home">
          <ChevronLeftIcon />
        </button>
        <div className="ci-header-titles">
          <div className="ci-kicker">{dateLabel}</div>
          <div className="ci-title">Check-in</div>
        </div>
        <div className="ci-progress">
          <div className={`ci-progress-count${complete ? " complete" : ""}`}>
            {filled.length}
            <span className="ci-progress-total">/{active.metrics.length}</span>
          </div>
          <div className="ci-progress-label">logged</div>
        </div>
      </header>

      {sections.length > 1 && (
        <div className="ci-tabs">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`ci-tab${s.id === active.id ? " active" : ""}`}
              onClick={() => switchSection(s.id)}
            >
              {s.label}
              {dueSections.includes(s.id) && <span className="ci-tab-dot" aria-label="Not logged yet" />}
            </button>
          ))}
        </div>
      )}

      <div className="ci-scroll">
      {collapsed ? (
        <div className="ci-body">
          <div className="ci-done" role="status" aria-live="polite">
            <div className="ci-saved-banner">
              <span className="ci-saved-icon" aria-hidden="true">
                ✓
              </span>
              <div className="ci-saved-text">
                <div className="ci-saved-title">{justSaved ? "Check-in saved" : "Already logged"}</div>
                <div className="ci-saved-sub">
                  {justSaved ? "Your coach can see it now." : "Your coach has it."}
                </div>
              </div>
              <button type="button" className="ci-saved-home" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
            <div className="ci-done-list">
              {(active.note ?? "").trim() !== "" && (
                <div className="ci-done-note">
                  <span className="ci-done-note-label">Your note</span>
                  <span className="ci-done-note-text">{active.note}</span>
                </div>
              )}
              {active.metrics.map((m) => (
                <div key={m.id} className="ci-done-row">
                  <span className="ci-done-name">{m.name}</span>
                  <span className={`ci-done-value${m.value ? "" : " empty"}`}>
                    {m.value ? showValue(m) : "–"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
      /* One form per section, keyed so switching sections resets the
          uncontrolled bits rather than carrying them over. */
      <form
        key={active.id}
        id="ci-form"
        className="ci-body"
        action={isMeasurements ? saveMeasurementCheckInAction : logMetricPeriodAction}
        onSubmit={armSubmit}
      >
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="date" value={today} />
        {!isMeasurements && <input type="hidden" name="frequency" value={active.id} />}

        <p className="ci-intro">{active.intro}</p>

        {active.metrics.map((m) => {
          const value = activeValues[m.id] ?? "";
          const has = value.length > 0;
          return (
            <div key={m.id} className="ci-metric">
              <div className="ci-metric-top">
                <div className="ci-metric-labels">
                  <div className="ci-metric-name">{m.name}</div>
                  {m.hint && <div className="ci-metric-hint">{m.hint}</div>}
                </div>
                <div className="ci-metric-input-wrap">
                  <input
                    type="text"
                    inputMode={m.scaleMax ? "numeric" : "decimal"}
                    autoComplete="off"
                    name={isMeasurements ? `field_${m.id}` : `metric_${m.id}`}
                    placeholder="–"
                    value={value}
                    onChange={(e) => setValue(m.id, cleanNumeric(e.target.value, !!m.scaleMax))}
                    aria-label={m.name}
                    className={`ci-input${has ? " filled" : ""}`}
                  />
                  {/* Always rendered, fixed width: a metric with no unit
                      (Steps) keeps the same right edge as one with (kg), so
                      the numerals line up down the list. */}
                  <span className="ci-metric-unit">{m.scaleMax ? `/${m.scaleMax}` : m.unit || ""}</span>
                </div>
              </div>
              {m.scaleMax && (
                <div className="ci-scale">
                  {Array.from({ length: m.scaleMax }, (_, i) => {
                    const n = String(i + 1);
                    const on = value === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        className={`ci-scale-btn${on ? " active" : ""}`}
                        onClick={() => setValue(m.id, on ? "" : n)}
                        aria-pressed={on}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <label className="ci-notefield">
          <span className="ci-notefield-label">Note for your coach</span>
          <textarea
            name="note"
            value={activeNote}
            onChange={(e) => setNotes((n) => ({ ...n, [active.id]: e.target.value }))}
            placeholder="Anything the numbers don't say: a tennis session, a bad night, a day off…"
            maxLength={500}
            rows={2}
          />
        </label>
      </form>
      )}
      </div>

      {/* No footer once the section is folded up: the done card is the whole
          story, and its own Edit is the way back in. */}
      {!collapsed && (
      <div className="ci-footer">
        <div className="ci-footer-labels">
          <div className="ci-footer-kicker">{isSaved ? "Sent" : "Goes to your coach"}</div>
          <div className={`ci-footer-label${isSaved ? " sent" : complete ? " complete" : ""}`}>
            {isSaved
              ? complete
                ? "All updated"
                : "Your coach has it"
              : complete
              ? "Everything filled in"
              : `${remaining} still empty`}
          </div>
        </div>
        {isSaved ? (
          <button type="button" className="ci-save secondary" onClick={stopEditing}>
            Done
          </button>
        ) : (
          <button type="submit" form="ci-form" className="ci-save" disabled={!canSave}>
            Save
          </button>
        )}
      </div>
      )}
    </div>
  );
}
