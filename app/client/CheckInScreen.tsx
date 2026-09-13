"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon } from "../components/icons";
import { saveCheckInAction, uploadProgressPhotoAction } from "../lib/actions";

// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx for why
// a "use client" file importing queries.ts breaks the dev server). All data
// comes in as plain props, computed server-side by getCheckInSections().
export type CheckInTrend = {
  points: { date: string; value: number; carried?: boolean }[];
  phaseName: string | null;
  startLabel: string;
  first: number;
  latest: number;
  change: number;
};
export type CheckInMetric = {
  id: string;
  name: string;
  unit: string;
  step: string;
  value: string;
  hint: string | null;
  scaleMax: number | null;
  /** The metric's movement inside the current phase; null until two readings. */
  trend: CheckInTrend | null;
};
export type CheckInSection = {
  id: "daily" | "weekly" | "measurements";
  label: string;
  intro: string;
  /** The client's note for this period, if they wrote one. */
  note: string | null;
  metrics: CheckInMetric[];
};
export type CheckInDelta = { name: string; value: string; unit: string };
export type CheckInPhotoSlot = { id: number; label: string; src: string | null };
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
  photoHistory: ReactNode;
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
  photoSlots,
  photoPeriodLabel,
  photosDue,
  photosNextLabel,
  photoHistory,
  onBack,
}: {
  clientId: number;
  dateLabel: string;
  today: string;
  sections: CheckInSection[];
  /** Kept for the caller; the screen is one list now, so nothing opens on a section. */
  initialSection: string;
  phaseLabel: string | null;
  deltas: CheckInDelta[];
  photoSlots: CheckInPhotoSlot[];
  photoPeriodLabel: string;
  dueSections: string[];
  photosDue: boolean;
  photosNextLabel: string;
  photoHistory: ReactNode;
  onBack: () => void;
}) {
  // One list: every metric the coach asked for that is due now. Dailies
  // every day, weeklies once their window opens, measurements alongside.
  // A metric id can repeat across kinds (metric 1, field 1), so state is
  // keyed by kind and id together.
  type Row = CheckInMetric & { kind: CheckInSection["id"]; group: string; key: string };
  const rows: Row[] = sections.flatMap((sec) =>
    sec.metrics.map((m) => ({ ...m, kind: sec.id, group: sec.label, key: `${sec.id}:${m.id}` }))
  );
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(rows.map((r) => [r.key, r.value])));
  const savedNote = (sections.find((sec) => sec.id === "daily") ?? sections[0])?.note ?? "";
  const [note, setNote] = useState(savedNote);
  const noteDirty = note.trim() !== savedNote.trim();

  const filled = rows.filter((r) => (values[r.key] ?? "").length > 0);
  const complete = filled.length === rows.length && rows.length > 0;
  const remaining = rows.length - filled.length;
  const dirty = rows.some((r) => !sameNumber(values[r.key] ?? "", r.value)) || noteDirty;
  const savedSomething = rows.some((r) => r.value.length > 0);
  const isSaved = !dirty && savedSomething;
  const canSave = dirty && (filled.length > 0 || (noteDirty && savedSomething));

  const submitted = useRef(false);
  const [justSaved, setJustSaved] = useState(false);
  const [editing, setEditing] = useState(false);
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
  const armSubmit = () => {
    submitted.current = true;
    setJustSaved(false);
  };

  if (rows.length === 0) {
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
        </header>
        <p className="ci-empty">Your coach hasn&rsquo;t set up any check-in metrics yet.</p>
      </div>
    );
  }

  const setValue = (key: string, v: string) => {
    setJustSaved(false);
    setValues((prev) => ({ ...prev, [key]: v }));
  };
  const stopEditing = () => {
    setValues(Object.fromEntries(rows.map((r) => [r.key, r.value])));
    setNote(savedNote);
    setEditing(false);
  };
  const showValue = (m: CheckInMetric) =>
    m.scaleMax ? `${m.value}/${m.scaleMax}` : `${m.value}${m.unit ? ` ${m.unit}` : ""}`;
  const inputName = (r: Row) => (r.kind === "measurements" ? `field_${r.id}` : `metric_${r.id}`);
  // A group caption only where a second kind joins the dailies, so the
  // client knows why a row is here today.
  const groups = Array.from(new Set(rows.map((r) => r.group)));
  const withTrend = rows.filter((r) => r.trend);
  const trendScope = withTrend[0]?.trend ?? null;

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
            <span className="ci-progress-total">/{rows.length}</span>
          </div>
          <div className="ci-progress-label">logged</div>
        </div>
      </header>

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
                <div className="ci-saved-sub">{justSaved ? "Your coach can see it now." : "Your coach has it."}</div>
              </div>
              <button type="button" className="ci-saved-home" onClick={() => setEditing(true)}>
                Edit
              </button>
            </div>
            <div className="ci-done-list">
              {savedNote.trim() !== "" && (
                <div className="ci-done-note">
                  <span className="ci-done-note-label">Your note</span>
                  <span className="ci-done-note-text">{savedNote}</span>
                </div>
              )}
              {rows.map((r) => (
                <div key={r.key} className="ci-done-row">
                  <span className="ci-done-name">{r.name}</span>
                  <span className={`ci-done-value${r.value ? "" : " empty"}`}>{r.value ? showValue(r) : "–"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
      <form id="ci-form" className="ci-body" action={saveCheckInAction} onSubmit={armSubmit}>
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="date" value={today} />

        {groups.map((group) => (
          <div key={group} className="ci-group">
            {groups.length > 1 && <div className="ci-group-label">{group}</div>}
            {rows.filter((r) => r.group === group).map((m) => {
              const value = values[m.key] ?? "";
              const has = value.length > 0;
              return (
                <div key={m.key} className="ci-metric">
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
                        name={inputName(m)}
                        placeholder="–"
                        value={value}
                        onChange={(e) => setValue(m.key, cleanNumeric(e.target.value, !!m.scaleMax))}
                        aria-label={m.name}
                        className={`ci-input${has ? " filled" : ""}`}
                      />
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
                            onClick={() => setValue(m.key, on ? "" : n)}
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
          </div>
        ))}

        <label className="ci-notefield">
          <span className="ci-notefield-label">Note for your coach</span>
          <textarea
            name="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything the numbers don't say: a tennis session, a bad night, a day off…"
            maxLength={500}
            rows={2}
          />
        </label>
      </form>
      )}

      {withTrend.length > 0 && (
        <div className="ci-extras">
          <section className="ci-section">
            <div className="ci-section-head">
              <span className="ci-section-title">Your progress</span>
              {trendScope && (
                <span className="ci-section-meta">
                  {trendScope.phaseName ?? "This phase"} · {trendScope.startLabel}
                </span>
              )}
            </div>
            <div className="ci-trends">
              {withTrend.map((m) => (
                <MetricTrend key={m.key} name={m.name} trend={m.trend!} unit={m.unit} scaleMax={m.scaleMax} />
              ))}
            </div>
          </section>
        </div>
      )}

      {photoSlots.length > 0 && (
        <div className="ci-extras">
          <section className="ci-section">
            <div className="ci-section-head">
              <span className="ci-section-title">Progress pictures</span>
              <span className={`ci-section-count${photoSlots.every((p) => p.src) ? " complete" : ""}`}>
                {photoSlots.filter((p) => p.src).length} of {photoSlots.length}
              </span>
            </div>
            <div className="ci-photos">
              {photoSlots.map((p) =>
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
              {photosDue ? `One set per ${photoPeriodLabel.toLowerCase()}. A new photo replaces this one.` : photosNextLabel}
            </div>
            {photoHistory && <div className="ci-photo-history">{photoHistory}</div>}
          </section>
        </div>
      )}

      </div>

      {!collapsed && (
      <div className="ci-footer">
        <div className="ci-footer-labels">
          <div className="ci-footer-kicker">{isSaved ? "Sent" : "Goes to your coach"}</div>
          <div className={`ci-footer-label${isSaved ? " sent" : complete ? " complete" : ""}`}>
            {isSaved ? (complete ? "All updated" : "Your coach has it") : complete ? "Everything filled in" : `${remaining} still empty`}
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

// ---- A metric's movement inside the current phase -------------------------
// One card per metric: the name and latest reading up top, a bar per
// reading underneath (the latest in the accent, the rest quiet), and the
// change since the phase began. Tapping opens the readings as a list. The
// first bar can be the last reading of the phase before, carried over as
// this phase's starting line; it is drawn outlined so the client can tell.
function MetricTrend({ name, trend, unit, scaleMax }: { name: string; trend: CheckInTrend; unit: string; scaleMax: number | null }) {
  const [open, setOpen] = useState(false);
  const values = trend.points.map((pt) => pt.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Bars need headroom and a floor, or a steady weight reads as a flat
  // wall and a small dip as a cliff. Scales run from zero.
  const pad = scaleMax ? 0 : max === min ? Math.max(1, Math.abs(max) * 0.05) : (max - min) * 0.6;
  const lo = scaleMax ? 0 : min - pad;
  const hi = scaleMax ? scaleMax : max + pad;
  const pct = (v: number) => Math.max(0.08, Math.min(1, (v - lo) / (hi - lo || 1)));
  const fmt = (v: number) => (scaleMax ? `${v}/${scaleMax}` : `${v}${unit ? ` ${unit}` : ""}`);
  const sign = trend.change > 0 ? "+" : trend.change < 0 ? "\u2212" : "";
  const changeText = trend.change === 0 ? "No change" : `${sign}${Math.abs(trend.change)}${scaleMax ? "" : unit ? ` ${unit}` : ""}`;
  const dateLabel = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const shown = trend.points.slice(-12);
  return (
    <div className={`ci-trend${open ? " open" : ""}`}>
      <button type="button" className="ci-trend-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="ci-trend-head">
          <span className="ci-trend-name">{name}</span>
          <span className="ci-trend-latest">{fmt(trend.latest)}</span>
        </div>
        <div className="ci-trend-bars" aria-hidden="true">
          {shown.map((pt, i) => (
            <span
              key={pt.date}
              className={`ci-trend-bar${i === shown.length - 1 ? " last" : ""}${pt.carried ? " carried" : ""}`}
              style={{ height: `${pct(pt.value) * 100}%` }}
              title={`${dateLabel(pt.date)} · ${fmt(pt.value)}`}
            />
          ))}
        </div>
        <div className="ci-trend-foot">
          <span className="ci-trend-from">
            {fmt(trend.first)} {trend.startLabel}
          </span>
          <span className={`ci-trend-change${trend.change === 0 ? " flat" : ""}`}>{changeText}</span>
        </div>
      </button>
      {open && (
        <ul className="ci-trend-list">
          {[...trend.points].reverse().map((pt) => (
            <li key={pt.date}>
              <span className="ci-trend-list-date">
                {dateLabel(pt.date)}
                {pt.carried ? " · before this phase" : ""}
              </span>
              <span className="ci-trend-list-value">{fmt(pt.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
