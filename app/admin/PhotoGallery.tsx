"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { savePhotoPeriodNoteAction } from "../lib/actions";

type Note = { shape: string; strengths: string; improvements: string; next_steps: string };

export type GalleryCell = {
  slotId: number;
  label: string;
  src: string | null;
  /** "22 Aug, 06:58" */
  shot: string | null;
  /** "22 Aug" */
  shotDay: string | null;
};

export type GallerySheet = {
  period: string;
  /** "Week 5" */
  title: string;
  /** "Wk 5" */
  short: string;
  /** The sheet open right now. */
  live: boolean;
  complete: boolean;
  /** "7 Sep", the day it opened */
  dateLabel: string;
  inCount: number;
  total: number;
  cells: GalleryCell[];
  note: Note;
  savedLabel: string | null;
  /** The weigh-in that fell inside this sheet, if any. */
  weight: number | null;
  /** The plan phase running on the day the sheet opened, per track. */
  phases: Record<PhaseTrack, string | null>;
};

type PhaseTrack = "nutrition" | "training";
const PHASE_TRACKS: { id: PhaseTrack; label: string }[] = [
  { id: "nutrition", label: "Nutrition" },
  { id: "training", label: "Training" },
];
// The rail's tile width and gap, so a phase bar spans exactly its weeks.
const TILE_WIDTH = 132;
const TILE_GAP = 10;

// Compare: how wide each of the two photos may grow. The pair centres in
// the card and still shrinks to fit a narrow screen.
type PairSize = "s" | "m" | "l" | "xl";
const PAIR_SIZES: { id: PairSize; label: string; px: number }[] = [
  { id: "s", label: "S", px: 240 },
  { id: "m", label: "M", px: 340 },
  { id: "l", label: "L", px: 460 },
  { id: "xl", label: "XL", px: 620 },
];

const NOTE_FIELDS: { name: keyof Note; label: string; placeholder: string }[] = [
  { name: "shape", label: "Shape", placeholder: "How they're looking overall" },
  { name: "strengths", label: "What's strong", placeholder: "What's going well" },
  { name: "improvements", label: "What we can improve", placeholder: "Areas to keep working on" },
  { name: "next_steps", label: "Next steps", placeholder: "What to focus on next" },
];

const DAY_MS = 86400000;
const daysApart = (a: string, b: string) =>
  Math.abs(Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / DAY_MS));
const kgDelta = (from: number, to: number) => {
  const d = Math.round((to - from) * 10) / 10;
  return `${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d).toFixed(1)} kg`;
};

function SaveNotesButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="pp-btn navy" disabled={pending}>
      {pending ? "Saving…" : "Save notes"}
    </button>
  );
}

function Hole({ className, live }: { className: string; live: boolean }) {
  return <span className={`${className} pp-hole`}>{live ? "Waiting" : "Never sent"}</span>;
}

function CompareGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="2" y="2" width="4" height="10" rx="1" fill="currentColor" />
      <rect x="8" y="2" width="4" height="10" rx="1" fill="currentColor" />
    </svg>
  );
}

// Every sheet in one card: a rail of weeks along the top, and under it one
// of three views. The sheet (its photos and the coach's notes), one photo
// big with the rest of the sheet and the same angle on earlier sheets, or
// one angle at two weeks side by side.
export default function PhotoGallery({
  clientId,
  firstName,
  sheets,
}: {
  clientId: number;
  firstName: string;
  sheets: GallerySheet[];
}) {
  const [selected, setSelected] = useState(sheets[0]?.period ?? "");
  const [detail, setDetail] = useState<number | null>(null);
  const [compare, setCompare] = useState<{ left: string; right: string; slotId: number | null } | null>(null);
  const [showPhases, setShowPhases] = useState(true);
  const [pairSize, setPairSize] = useState<PairSize>("m");

  const byPeriod = new Map(sheets.map((s) => [s.period, s] as const));
  // `sheets` arrives newest first; everything the coach reads as a sequence
  // (the rail, the week menus, earlier sheets) runs Week 1 onwards.
  const chronological = [...sheets].reverse();

  // Phases over the rail: a row per track that has any, nutrition then
  // training, both at once. Neighbouring weeks in the same phase share a bar.
  const phaseRows = PHASE_TRACKS.filter((t) => sheets.some((s) => s.phases[t.id])).map((t) => {
    const bars: { key: string; name: string | null; weeks: number }[] = [];
    for (const s of chronological) {
      const name = s.phases[t.id];
      const last = bars[bars.length - 1];
      if (last && last.name === name) last.weeks += 1;
      else bars.push({ key: s.period, name, weeks: 1 });
    }
    return { track: t, bars };
  });
  const sheet = byPeriod.get(selected) ?? sheets[0];
  const cellCount = sheet?.cells.length ?? 0;

  // ← / → step through the angles while one photo is open; Esc goes back.
  useEffect(() => {
    if (detail == null || compare || cellCount === 0) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowRight") setDetail((d) => (d == null ? d : (d + 1) % cellCount));
      else if (e.key === "ArrowLeft") setDetail((d) => (d == null ? d : (d - 1 + cellCount) % cellCount));
      else if (e.key === "Escape") setDetail(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail, compare, cellCount]);

  // Week 1 sits at the left, so open with the rail scrolled to the newest end.
  const railRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const rail = railRef.current;
    if (rail) rail.scrollLeft = rail.scrollWidth;
  }, []);

  if (!sheet) return null;

  const oldest = sheets[sheets.length - 1];
  // Compare opens on the chosen sheet against the first one (or the newest,
  // when the chosen sheet is the first).
  const openCompare = (right: string, slotId: number | null) => {
    const left = right === oldest.period ? sheets[0].period : oldest.period;
    setCompare({ left, right, slotId });
    setDetail(null);
  };
  const toggleCompare = () => {
    if (compare) {
      setSelected(compare.right);
      setCompare(null);
    } else {
      openCompare(sheet.period, null);
    }
  };
  const pickTile = (period: string) => {
    if (compare) {
      if (period !== compare.right) setCompare({ ...compare, left: compare.right, right: period });
    } else {
      setSelected(period);
      setDetail(null);
    }
  };

  let head: { title: string; pill: boolean; meta: string; right: React.ReactNode };
  let body: React.ReactNode;

  if (compare) {
    const left = byPeriod.get(compare.left) ?? oldest;
    const right = byPeriod.get(compare.right) ?? sheets[0];
    const angles = [...right.cells, ...left.cells.filter((c) => !right.cells.some((r) => r.slotId === c.slotId))];
    const slotId = angles.some((a) => a.slotId === compare.slotId) ? compare.slotId : angles[0]?.slotId ?? null;
    const angle = angles.find((a) => a.slotId === slotId);
    const weightClause =
      left.weight != null && right.weight != null ? `${kgDelta(left.weight, right.weight)} between sheets` : null;
    head = {
      title: `${left.title} vs ${right.title}`,
      pill: false,
      meta: [angle?.label, `${daysApart(left.period, right.period)} days apart`, weightClause].filter(Boolean).join(" · "),
      right: (
        <div className="pp-view-selects">
          {(["left", "right"] as const).map((side, i) => (
            <span key={side} className="pp-view-select">
              {i === 1 && <span className="pp-compare-vs">vs</span>}
              <select
                className="pp-select"
                value={compare[side]}
                aria-label={side === "left" ? "First sheet" : "Second sheet"}
                onChange={(e) => setCompare({ ...compare, [side]: e.target.value })}
              >
                {chronological.map((s) => (
                  <option key={s.period} value={s.period}>
                    {s.title}
                  </option>
                ))}
              </select>
            </span>
          ))}
        </div>
      ),
    };
    body = (
      <>
        <div className="pp-compare-tools">
          <div className="pp-angle-row">
            {angles.map((a) => (
              <button
                key={a.slotId}
                type="button"
                className={`pp-angle-btn${a.slotId === slotId ? " active" : ""}`}
                aria-pressed={a.slotId === slotId}
                onClick={() => setCompare({ ...compare, slotId: a.slotId })}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div className="pp-size-tools">
            <span className="pp-tools-label">Size</span>
            <div className="pp-seg" role="radiogroup" aria-label="Photo size">
              {PAIR_SIZES.map((z) => (
                <button
                  key={z.id}
                  type="button"
                  role="radio"
                  aria-checked={pairSize === z.id}
                  className={`pp-seg-btn${pairSize === z.id ? " active" : ""}`}
                  onClick={() => setPairSize(z.id)}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="pp-pair">
          {[left, right].map((s, i) => {
            const c = s.cells.find((x) => x.slotId === slotId);
            return (
              <figure
                key={`${i}-${s.period}`}
                className="pp-pair-side"
                style={{ maxWidth: PAIR_SIZES.find((z) => z.id === pairSize)?.px }}
              >
                {c?.src ? (
                  <a className="pp-pair-frame" href={c.src} target="_blank" rel="noopener noreferrer" title="Open full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.src} alt={`${c.label}, ${s.title}`} />
                  </a>
                ) : (
                  <Hole className="pp-pair-frame" live={s.live} />
                )}
                <figcaption className={`pp-pair-cap${i === 1 ? " accent" : ""}`}>
                  <span className="pp-pair-title">{s.title}</span>
                  <span className="pp-pair-shot">{c?.shot ?? "—"}</span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      </>
    );
  } else if (detail != null) {
    const index = Math.min(detail, cellCount - 1);
    const cell = sheet.cells[index];
    const earlier = sheets
      .slice(sheets.indexOf(sheet) + 1)
      .reverse()
      .map((s) => ({ s, i: s.cells.findIndex((c) => c.slotId === cell.slotId) }))
      .filter((x) => x.i >= 0);
    head = {
      title: sheet.title,
      pill: sheet.live,
      meta: "",
      right: (
        <button type="button" className="pp-btn tint" onClick={() => setDetail(null)}>
          Back to the sheet
        </button>
      ),
    };
    body = (
      <div className="pp-detail">
        <div className="pp-detail-shot">
          {cell.src ? (
            <a className="pp-detail-frame" href={cell.src} target="_blank" rel="noopener noreferrer" title="Open full size">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cell.src} alt={`${cell.label}, ${sheet.title}`} />
            </a>
          ) : (
            <Hole className="pp-detail-frame" live={sheet.live} />
          )}
          {cellCount > 1 && (
            <div className="pp-detail-nav">
              <button type="button" className="pp-icon-btn" aria-label="Previous angle" onClick={() => setDetail((index - 1 + cellCount) % cellCount)}>
                ←
              </button>
              <span className="pp-faint">
                {index + 1} of {cellCount}
              </span>
              <button type="button" className="pp-icon-btn" aria-label="Next angle" onClick={() => setDetail((index + 1) % cellCount)}>
                →
              </button>
            </div>
          )}
        </div>
        <div className="pp-detail-side">
          <h3 className="pp-detail-name">{cell.label}</h3>
          <p className="pp-detail-when">{cell.shot ? `Shot ${cell.shot}` : sheet.live ? "Not in yet" : "Never sent"}</p>
          <div className="pp-detail-actions">
            {cell.src && (
              <a className="pp-btn navy" href={cell.src} target="_blank" rel="noopener noreferrer">
                Open full size
              </a>
            )}
            {sheets.length > 1 && (
              <button type="button" className="pp-btn tint" onClick={() => openCompare(sheet.period, cell.slotId)}>
                Compare this angle
              </button>
            )}
          </div>
          <div className="pp-strip">
            {sheet.cells.map((c, i) => (
              <button
                key={c.slotId}
                type="button"
                className={`pp-mini${i === index ? " current" : ""}`}
                aria-label={c.label}
                aria-current={i === index}
                onClick={() => setDetail(i)}
              >
                {c.src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.src} alt="" />
                ) : (
                  <span className="pp-mini-hole" />
                )}
              </button>
            ))}
          </div>
          {earlier.length > 0 && (
            <>
              <hr className="pp-hairline" />
              <span className="pp-label">Same angle, earlier sheets</span>
              <div className="pp-strip">
                {earlier.map(({ s, i }) => {
                  const c = s.cells[i];
                  return (
                    <button
                      key={s.period}
                      type="button"
                      className="pp-mini-wrap"
                      aria-label={`${c.label}, ${s.title}`}
                      onClick={() => {
                        setSelected(s.period);
                        setDetail(i);
                      }}
                    >
                      <span className="pp-mini">
                        {c.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.src} alt="" />
                        ) : (
                          <span className="pp-mini-hole" />
                        )}
                      </span>
                      <span className="pp-mini-label">{s.short}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  } else {
    head = { title: sheet.title, pill: sheet.live, meta: "", right: null };
    body = (
      <>
        <div className="pp-shots">
          {sheet.cells.map((c, i) => (
            <button key={c.slotId} type="button" className="pp-shot" onClick={() => setDetail(i)} aria-label={`Open ${c.label}`}>
              {c.src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="pp-shot-img" src={c.src} alt="" />
              ) : (
                <Hole className="pp-shot-img" live={sheet.live} />
              )}
              <span className="pp-shot-cap">
                <span className="pp-shot-name">{c.label}</span>
                <span className="pp-shot-date">{c.shotDay ?? ""}</span>
              </span>
            </button>
          ))}
        </div>

        <form key={sheet.period} action={savePhotoPeriodNoteAction} className="pp-notes">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="period" value={sheet.period} />
          <div className="pp-notes-head">
            <span className="pp-label">Your notes · {firstName} sees these on this sheet</span>
            {sheet.savedLabel && <span className="pp-faint">Saved {sheet.savedLabel}</span>}
          </div>
          <div className="pp-notes-grid">
            {NOTE_FIELDS.map((f) => (
              <label key={f.name} className="pp-note-field">
                <span className="pp-note-label">{f.label}</span>
                <textarea name={f.name} defaultValue={sheet.note[f.name]} rows={3} placeholder={f.placeholder} />
              </label>
            ))}
          </div>
          <div className="pp-notes-foot">
            <SaveNotesButton />
          </div>
        </form>
      </>
    );
  }

  return (
    <section className="pp-card pp-gallery">
      <div className="pp-gallery-head">
        <div>
          <span className="pp-eyebrow">Sheets</span>
          {compare && <p className="pp-gallery-help">Click any two weeks, or use the menus on the right</p>}
        </div>
        <div className="pp-gallery-tools">
          {phaseRows.length > 0 && (
            <button
              type="button"
              className={`pp-compare-btn${showPhases ? " active" : ""}`}
              aria-pressed={showPhases}
              onClick={() => setShowPhases((on) => !on)}
            >
              Phases
            </button>
          )}
          {sheets.length > 1 && (
            <button
              type="button"
              className={`pp-compare-btn${compare ? " active" : ""}`}
              aria-pressed={!!compare}
              onClick={toggleCompare}
            >
              <CompareGlyph />
              {compare ? "Back to one sheet" : "Compare"}
            </button>
          )}
        </div>
      </div>

      <div className="pp-rail" ref={railRef}>
        <div className="pp-rail-inner">
          {showPhases &&
            phaseRows.map((row) => (
              <div key={row.track.id} className="pp-phase-row" aria-label={`${row.track.label} phases`}>
                {row.bars.map((bar) => (
                  <span
                    key={bar.key}
                    className={`pp-phase ${bar.name ? row.track.id : "none"}`}
                    style={{ width: bar.weeks * TILE_WIDTH + (bar.weeks - 1) * TILE_GAP }}
                    title={bar.name ? `${row.track.label}: ${bar.name}` : undefined}
                  >
                    {bar.name}
                  </span>
                ))}
              </div>
            ))}
          <div className="pp-rail-tiles">
            {chronological.map((s) => {
              const on = compare ? s.period === compare.left || s.period === compare.right : s.period === sheet.period;
              return (
                <button
                  key={s.period}
                  type="button"
                  className={`pp-tile${on ? " selected" : ""}`}
                  aria-pressed={on}
                  onClick={() => pickTile(s.period)}
                >
                  <span className="pp-tile-top">
                    <span className="pp-tile-title">{s.title}</span>
                    {s.live ? (
                      <span className="pp-tile-badge open">Open</span>
                    ) : !s.complete ? (
                      <span className="pp-tile-badge">Partial</span>
                    ) : null}
                  </span>
                  <span className="pp-tile-dots" aria-hidden="true">
                    {s.cells.map((c) => (
                      <span key={c.slotId} className={`pp-tile-dot${c.src ? " in" : ""}`} />
                    ))}
                  </span>
                  <span className="pp-tile-foot">
                    <span>{s.dateLabel}</span>
                    <span>
                      {s.inCount} / {s.total}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="pp-view">
        <div className="pp-view-head">
          <div className="pp-view-titles">
            <div className="pp-view-titlerow">
              <span className="pp-view-title">{head.title}</span>
              {head.pill && <span className="pp-pill open">Open</span>}
            </div>
            {head.meta && <div className="pp-view-meta">{head.meta}</div>}
          </div>
          {head.right}
        </div>
        {body}
      </div>
    </section>
  );
}
