"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon } from "../components/icons";
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
  // Which segments still have no entry for their current period.
  dueSections: string[];
};

// The check-in as two tabs, Daily and Weekly, with the coach's measurements
// riding in Weekly. Each tab is one card of rows: the metric, its last
// reading, and a value pill (typed, or picked from a 1–N scale under it). A
// row already logged for this period turns steel blue. Save posts to the
// same server actions as before with the same fields: the weekly metrics to
// logMetricPeriodAction, the measurements to saveMeasurementCheckInAction.

type RowSource = "tracker" | "measurements";
type Row = { key: string; source: RowSource; metric: CheckInMetric };
type Tab = {
  id: "daily" | "weekly";
  label: string;
  intro: string;
  /** The tracker frequency posted with the metrics; null when the tab only holds measurements. */
  frequency: "daily" | "weekly" | null;
  note: string | null;
  rows: Row[];
};

function buildTabs(sections: CheckInSection[]): Tab[] {
  const daily = sections.find((s) => s.id === "daily");
  const weekly = sections.find((s) => s.id === "weekly");
  const measure = sections.find((s) => s.id === "measurements");
  const trackerRows = (s: CheckInSection): Row[] => s.metrics.map((m) => ({ key: `t${m.id}`, source: "tracker", metric: m }));
  const tabs: Tab[] = [];
  if (daily) {
    tabs.push({ id: "daily", label: "Daily", intro: "Every day, about twenty seconds.", frequency: "daily", note: daily.note, rows: trackerRows(daily) });
  }
  if (weekly || measure) {
    tabs.push({
      id: "weekly",
      label: "Weekly",
      intro: "Once a week, then it closes.",
      frequency: weekly ? "weekly" : null,
      note: weekly ? weekly.note : measure?.note ?? null,
      rows: [
        ...(weekly ? trackerRows(weekly) : []),
        ...(measure?.metrics ?? []).map((m): Row => ({ key: `m${m.id}`, source: "measurements", metric: m })),
      ],
    });
  }
  return tabs;
}

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
  const tabs = buildTabs(sections);
  // Home opens straight on whatever is due; measurements now live in Weekly.
  const wanted = initialSection === "measurements" ? "weekly" : initialSection;
  const [tabId, setTabId] = useState<Tab["id"] | undefined>(() => (tabs.find((t) => t.id === wanted) ?? tabs[0])?.id);
  // Seeded from what's already logged for the current period, so reopening
  // the screen shows what was sent rather than blanking it out.
  const [values, setValues] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(tabs.map((t) => [t.id, Object.fromEntries(t.rows.map((r) => [r.key, r.metric.value]))]))
  );
  // The note for the coach, per tab, edited alongside the numbers.
  const [notes, setNotes] = useState<Record<string, string>>(() => Object.fromEntries(tabs.map((t) => [t.id, t.note ?? ""])));
  const [pending, setPending] = useState(false);

  const active = tabs.find((t) => t.id === tabId) ?? tabs[0];

  // Derived from the active tab; all computed before the early return below
  // so the hooks that follow run in the same order on every render.
  const activeValues = active ? values[active.id] ?? {} : {};
  const activeNote = active ? notes[active.id] ?? "" : "";
  const noteDirty = !!active && activeNote.trim() !== (active.note ?? "").trim();
  const rows = active?.rows ?? [];
  const filled = rows.filter((r) => (activeValues[r.key] ?? "").length > 0);
  const complete = filled.length === rows.length && rows.length > 0;
  const remaining = rows.length - filled.length;

  // metric.value is what's actually persisted for this period, so comparing
  // the two tells us whether there's anything left to send. After a save the
  // server re-renders with the new values, so this settles on its own.
  const changedRow = (r: Row) => !sameNumber(activeValues[r.key] ?? "", r.metric.value);
  const dirty = rows.some(changedRow) || noteDirty;
  const savedSomething = rows.some((r) => r.metric.value.length > 0);
  const isSaved = !dirty && savedSomething;
  // A note on its own is fine once the numbers are in; it just can't be the
  // only thing sent for a period with nothing logged.
  const canSave = dirty && (filled.length > 0 || (noteDirty && savedSomething));

  // The confirmation shows after a save THIS visit lands, not on merely
  // opening a tab that was saved earlier.
  const submitted = useRef(false);
  const [justSaved, setJustSaved] = useState(false);
  // A saved tab folds into a "done" card; Edit reopens it, and a fresh save,
  // or Done, folds it back up.
  const [editing, setEditing] = useState(false);
  // The folded done card, opened to show the readings.
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (isSaved && submitted.current) {
      submitted.current = false;
      const t = setTimeout(() => {
        setJustSaved(true);
        setEditing(false);
      }, 0);
      return () => clearTimeout(t);
    }
  }, [isSaved]);
  const collapsed = isSaved && !editing;

  if (!active) {
    return (
      <div className="ci-screen">
        <header className="ci-head">
          <button type="button" className="ci-back" onClick={onBack} aria-label="Back to home">
            <ChevronLeftIcon />
          </button>
        </header>
        <p className="ci-empty">Your coach hasn&rsquo;t set up any check-in metrics yet.</p>
      </div>
    );
  }

  const setValue = (key: string, v: string) => {
    setJustSaved(false);
    setValues((prev) => ({ ...prev, [active.id]: { ...prev[active.id], [key]: v } }));
  };
  const switchTab = (id: Tab["id"]) => {
    setTabId(id);
    setEditing(false);
    setExpanded(false);
    setJustSaved(false);
  };
  // Leaving edit mode without saving puts back what the coach actually has.
  const stopEditing = () => {
    setValues((prev) => ({ ...prev, [active.id]: Object.fromEntries(active.rows.map((r) => [r.key, r.metric.value])) }));
    setEditing(false);
  };
  const showValue = (m: CheckInMetric) => (m.scaleMax ? `${m.value}/${m.scaleMax}` : `${m.value}${m.unit ? ` ${m.unit}` : ""}`);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || pending) return;
    submitted.current = true;
    setJustSaved(false);
    setPending(true);
    try {
      const trackerRows = active.rows.filter((r) => r.source === "tracker");
      const measureRows = active.rows.filter((r) => r.source === "measurements");
      // The note belongs to the tracker period when there is one.
      const noteWithTracker = active.frequency != null;
      if (trackerRows.length > 0 && active.frequency) {
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("date", today);
        fd.set("frequency", active.frequency);
        trackerRows.forEach((r) => fd.set(`metric_${r.metric.id}`, activeValues[r.key] ?? ""));
        fd.set("note", activeNote);
        await logMetricPeriodAction(fd);
      }
      if (measureRows.length > 0 && (measureRows.some(changedRow) || (!noteWithTracker && noteDirty))) {
        const fd = new FormData();
        fd.set("clientId", String(clientId));
        fd.set("date", today);
        measureRows.forEach((r) => fd.set(`field_${r.metric.id}`, activeValues[r.key] ?? ""));
        if (!noteWithTracker) fd.set("note", activeNote);
        await saveMeasurementCheckInAction(fd);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="ci-screen">
      <header className="ci-head">
        <button type="button" className="ci-back" onClick={onBack} aria-label="Back to home">
          <ChevronLeftIcon />
        </button>
        <div className="ci-head-titles">
          <h1 className="ci-title">Check-in</h1>
        </div>
        <div className="ci-count" aria-label={`${filled.length} of ${rows.length} filled in`}>
          <span className="ci-count-dot" aria-hidden="true" />
          {filled.length}
          <span className="ci-count-total">/ {rows.length}</span>
        </div>
      </header>

      {tabs.length > 1 && (
        <div className="ci-seg" role="tablist" aria-label="Check-in">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === active.id}
              className={`ci-seg-btn${t.id === active.id ? " on" : ""}`}
              onClick={() => switchTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div className="ci-scroll">
        {collapsed ? (
          <div className="ci-list">
            {/* Folded to its banner once logged; the banner opens the readings, Edit reopens the form. */}
            <div className={`ci-done${expanded ? "" : " closed"}`} role="status" aria-live="polite">
              <div className="ci-saved-banner">
                <button
                  type="button"
                  className="ci-saved-toggle"
                  onClick={() => setExpanded((x) => !x)}
                  aria-expanded={expanded}
                  aria-label={expanded ? "Hide what was logged" : "Show what was logged"}
                >
                  <span className="ci-saved-icon" aria-hidden="true">
                    <CheckIcon />
                  </span>
                  <span className="ci-saved-text">
                    <span className="ci-saved-title">{dateLabel}</span>
                    <span className="ci-saved-sub">{justSaved ? "Your coach can see it now." : "Your coach has it."}</span>
                  </span>
                  <span className={`ci-saved-chev${expanded ? " open" : ""}`} aria-hidden="true">
                    <ChevronDownIcon />
                  </span>
                </button>
                <button type="button" className="ci-saved-home" onClick={() => setEditing(true)}>
                  Edit
                </button>
              </div>
              {expanded && (
              <div className="ci-done-list">
                {(active.note ?? "").trim() !== "" && (
                  <div className="ci-done-note">
                    <span className="ci-done-note-label">Your note</span>
                    <span className="ci-done-note-text">{active.note}</span>
                  </div>
                )}
                {active.rows.map((r) => (
                  <div key={r.key} className="ci-done-row">
                    <span className="ci-done-name">{r.metric.name}</span>
                    <span className={`ci-done-value${r.metric.value ? "" : " empty"}`}>{r.metric.value ? showValue(r.metric) : "–"}</span>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        ) : (
          // Keyed by tab, so switching resets anything uncontrolled.
          <form key={active.id} id="ci-form" className="ci-list" onSubmit={save}>
            <p className="ci-intro">{active.intro}</p>

            <div className="ci-card">
              {active.rows.map((r) => {
                const m = r.metric;
                const value = activeValues[r.key] ?? "";
                // Logged: saved for this period and not changed since.
                const logged = m.value.length > 0 && sameNumber(value, m.value);
                const unit = m.scaleMax ? `/${m.scaleMax}` : m.unit || "";
                return (
                  <div key={r.key} className={`ci-row${logged ? " logged" : ""}`}>
                    <div className="ci-row-head">
                      <div className="ci-row-labels">
                        <div className="ci-row-name">
                          <span>{m.name}</span>
                          {logged && <CheckIcon />}
                        </div>
                        {m.hint && <div className="ci-row-last">{m.hint}</div>}
                      </div>
                      {m.scaleMax ? (
                        <div className="ci-pill">
                          <span className="ci-pill-value">{value || "—"}</span>
                          <span className="ci-pill-unit">{unit}</span>
                        </div>
                      ) : (
                        <label className="ci-pill">
                          <input
                            type="text"
                            inputMode="decimal"
                            autoComplete="off"
                            placeholder="—"
                            value={value}
                            onChange={(e) => setValue(r.key, cleanNumeric(e.target.value, false))}
                            aria-label={m.name}
                            className="ci-pill-input"
                          />
                          <span className="ci-pill-unit">{unit}</span>
                        </label>
                      )}
                    </div>
                    {m.scaleMax && (
                      <div className="ci-scale" style={{ gridTemplateColumns: `repeat(${m.scaleMax}, minmax(0, 1fr))` }}>
                        {Array.from({ length: m.scaleMax }, (_, i) => {
                          const n = String(i + 1);
                          const on = value === n;
                          return (
                            <button
                              key={n}
                              type="button"
                              className={`ci-scale-btn${on ? " on" : ""}`}
                              onClick={() => setValue(r.key, on ? "" : n)}
                              aria-pressed={on}
                              aria-label={`${m.name} ${n} of ${m.scaleMax}`}
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
            </div>

            <label className="ci-notefield">
              <span className="ci-notefield-label">Note for your coach</span>
              <textarea
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

      {/* No dock once the tab is folded up: the done card is the whole story,
          and its own Edit is the way back in. */}
      {!collapsed && (
        <div className="ci-dock">
          <div>
            <div className="ci-dock-kicker">{isSaved ? "Sent" : "Goes to your coach"}</div>
            <div className="ci-dock-label">
              {isSaved ? (complete ? "All updated" : "Your coach has it") : complete ? "All logged" : `${remaining} still empty`}
            </div>
          </div>
          {isSaved ? (
            <button type="button" className="ci-save secondary" onClick={stopEditing}>
              Done
            </button>
          ) : (
            <button type="submit" form="ci-form" className="ci-save" disabled={!canSave || pending}>
              {pending ? "Saving…" : "Save"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
