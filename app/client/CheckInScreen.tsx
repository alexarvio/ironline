"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon } from "../components/icons";
import { logMetricPeriodAction, saveMeasurementCheckInAction, uploadProgressPhotoAction } from "../lib/actions";

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
  metrics: CheckInMetric[];
};
export type CheckInDelta = { name: string; value: string; unit: string };
export type CheckInPhotoSlot = { id: number; label: string; src: string | null };
export type CheckInCoachNote = { timeLabel: string; text: string } | null;
// Everything the screen needs, computed server-side by getCheckInSections()
// and handed down through AppShell.
export type CheckInProps = {
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  // "Fat loss · from Jun 15" — what the deltas below are measured against.
  phaseLabel: string | null;
  deltas: CheckInDelta[];
  photoSlots: CheckInPhotoSlot[];
  photoPeriodLabel: string;
  // Which segments still have no entry for their current period — drives
  // the dot on each tab so the client can see where action is needed.
  dueSections: string[];
  // Progress pictures only accept uploads while this period's set is
  // incomplete; once it's full there's nothing for the client to do until
  // the next one opens.
  photosDue: boolean;
  photosNextLabel: string;
  coachNote: CheckInCoachNote;
  photoHistory: ReactNode;
};

// The whole check-in in one screen: three sections the client taps between,
// each a list of "what your coach asked for" rows. Inputs are controlled so
// the header's filled/total counter and the per-row underline react as you
// type; the actual save is a real form post to the same server actions the
// old separate forms used, so what reaches the coach is unchanged.
export default function CheckInScreen({
  clientId,
  dateLabel,
  today,
  sections,
  initialSection,
  phaseLabel,
  deltas,
  photoSlots,
  photoPeriodLabel,
  dueSections,
  photosDue,
  photosNextLabel,
  coachNote,
  photoHistory,
  onBack,
}: {
  clientId: number;
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  initialSection: string;
  phaseLabel: string | null;
  deltas: CheckInDelta[];
  photoSlots: CheckInPhotoSlot[];
  photoPeriodLabel: string;
  dueSections: string[];
  photosDue: boolean;
  photosNextLabel: string;
  coachNote: CheckInCoachNote;
  // Past photo periods and the coach's written feedback on them, rendered
  // server-side and passed through. Not in the Check-in mockup, but it's
  // existing client-facing functionality that has nowhere else to live now
  // that Photos is no longer its own view.
  photoHistory: ReactNode;
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
  const dirty = metrics.some((m) => (activeValues[m.id] ?? "") !== m.value);
  const savedSomething = metrics.some((m) => m.value.length > 0);
  const isSaved = !dirty && savedSomething;
  const canSave = dirty && filled.length > 0;

  // The confirmation banner shows after a save THIS visit lands — not on
  // merely opening a section that was saved earlier. `submitted` is armed
  // by the form's submit and disarmed when the server re-render brings the
  // values back matching (isSaved), which is the moment the save is real.
  const submitted = useRef(false);
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (isSaved && submitted.current) {
      submitted.current = false;
      // Deferred a tick so the state change isn't synchronous inside the effect.
      const t = setTimeout(() => setJustSaved(true), 0);
      return () => clearTimeout(t);
    }
  }, [isSaved]);
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
              onClick={() => setSectionId(s.id)}
            >
              {s.label}
              {dueSections.includes(s.id) && <span className="ci-tab-dot" aria-label="Not logged yet" />}
            </button>
          ))}
        </div>
      )}

      <div className="ci-scroll">
      {/* One form per section, keyed so switching sections resets the
          uncontrolled bits (the file inputs) rather than carrying them over. */}
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

        {justSaved && (
          <div className="ci-saved-banner" role="status" aria-live="polite">
            <span className="ci-saved-icon" aria-hidden="true">
              ✓
            </span>
            <div className="ci-saved-text">
              <div className="ci-saved-title">Check-in saved</div>
              <div className="ci-saved-sub">Your coach can see it now.</div>
            </div>
            <button type="button" className="ci-saved-home" onClick={onBack}>
              Done
            </button>
          </div>
        )}

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
                    type="number"
                    step={m.step}
                    inputMode="decimal"
                    name={isMeasurements ? `field_${m.id}` : `metric_${m.id}`}
                    placeholder="–"
                    value={value}
                    onChange={(e) => setValue(m.id, e.target.value)}
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
      </form>

      {isMeasurements && (deltas.length > 0 || photoSlots.length > 0) && (
        <div className="ci-extras">
          {deltas.length > 0 && (
            <section className="ci-section">
              <div className="ci-section-head">
                <span className="ci-section-title">Since this phase started</span>
                {phaseLabel && <span className="ci-section-meta">{phaseLabel}</span>}
              </div>
              <div className="ci-deltas">
                {deltas.map((d) => (
                  <div key={d.name} className="ci-delta">
                    <div className="ci-delta-name">{d.name}</div>
                    <div className="ci-delta-value-row">
                      <span className="ci-delta-value">{d.value}</span>
                      {d.unit && <span className="ci-delta-unit">{d.unit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {photoSlots.length > 0 && (
            <section className="ci-section">
              <div className="ci-section-head">
                <span className="ci-section-title">Progress pictures</span>
                <span
                  className={`ci-section-count${
                    photoSlots.every((p) => p.src) ? " complete" : ""
                  }`}
                >
                  {photoSlots.filter((p) => p.src).length} of {photoSlots.length}
                </span>
              </div>
              <div className="ci-photos">
                {photoSlots.map((p) =>
                  // Uploading is only offered while this period's set is
                  // still incomplete — once it's full there's nothing for
                  // the client to do, so the tiles go read-only rather than
                  // inviting a pointless re-shoot.
                  photosDue ? (
                    <form key={p.id} action={uploadProgressPhotoAction} className="ci-photo-form">
                      <input type="hidden" name="clientId" value={clientId} />
                      <input type="hidden" name="slotId" value={p.id} />
                      <label className={`ci-photo${p.src ? " filled" : ""}`}>
                        {p.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.src} alt={p.label} className="ci-photo-img" />
                        ) : (
                          <span className="ci-photo-icon" aria-hidden="true">
                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                              <path
                                d="M2.5 6.2a1 1 0 0 1 1-1h1.7l.9-1.5h3.8l.9 1.5H15a1 1 0 0 1 1 1v7.3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V6.2z"
                                stroke="currentColor"
                                strokeWidth="1.3"
                                strokeLinejoin="round"
                              />
                              <circle cx="9" cy="10" r="2.6" stroke="currentColor" strokeWidth="1.3" />
                            </svg>
                          </span>
                        )}
                        <span className="ci-photo-label">{p.label}</span>
                        <input
                          type="file"
                          name="file"
                          accept="image/*"
                          capture="environment"
                          className="ci-photo-input"
                          onChange={(e) => e.currentTarget.form?.requestSubmit()}
                        />
                      </label>
                    </form>
                  ) : (
                    <div key={p.id} className={`ci-photo done${p.src ? " filled" : ""}`}>
                      {p.src && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.src} alt={p.label} className="ci-photo-img" />
                      )}
                      <span className="ci-photo-label">{p.label}</span>
                    </div>
                  )
                )}
              </div>
              <div className="ci-photo-note">
                {photosDue
                  ? `One set per ${photoPeriodLabel.toLowerCase()}. A new photo replaces this one.`
                  : photosNextLabel}
              </div>
              {photoHistory && <div className="ci-photo-history">{photoHistory}</div>}
            </section>
          )}
        </div>
      )}

      {coachNote && (
        <div className="ci-extras">
          <section className="ci-section">
            <span className="ci-section-title">Coach note</span>
            <div className="ci-note">
              <span className="ci-note-dot" aria-hidden="true" />
              <div className="ci-note-body">
                {/* The section heading above already says "Coach note", so the
                    row itself only carries the timestamp — unlike the mockup,
                    where this slot named the exercise the note was about.
                    Coach notes here are chat messages, which have no such
                    subject to show. */}
                <div className="ci-note-top">
                  <span className="ci-note-time">{coachNote.timeLabel}</span>
                </div>
                <div className="ci-note-text">{coachNote.text}</div>
              </div>
            </div>
          </section>
        </div>
      )}

      </div>

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
        <button type="submit" form="ci-form" className="ci-save" disabled={!canSave}>
          {isSaved ? "Saved ✓" : "Save"}
        </button>
      </div>
    </div>
  );
}
