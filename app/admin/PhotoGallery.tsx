"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { useFormStatus } from "react-dom";
import { savePhotoPeriodNoteAction } from "../lib/actions";
import { ChevronDownIcon } from "../components/icons";

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

type Compare = { left: string; right: string; slotId: number | null };

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

// Every sheet in one card, each its own row that folds open, like the days
// in Training: the title, how many photos came in and the plan phase it fell
// in; open, the photos and the coach's notes. All rows start folded and one
// is open at a time. Compare swaps the rows for two sheets side by side.
export default function PhotoGallery({
  clientId,
  firstName,
  sheets,
}: {
  clientId: number;
  firstName: string;
  sheets: GallerySheet[];
}) {
  const [openPeriod, setOpenPeriod] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const [compare, setCompare] = useState<Compare | null>(null);
  const [showPhases, setShowPhases] = useState(true);
  const [pairSize, setPairSize] = useState<PairSize>("m");

  // `sheets` arrives newest first; the rows read Week 1 downwards.
  const chronological = [...sheets].reverse();
  const openSheet = sheets.find((s) => s.period === openPeriod) ?? null;
  const cellCount = openSheet?.cells.length ?? 0;
  const hasPhases = sheets.some((s) => s.phases.nutrition || s.phases.training);

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

  if (sheets.length === 0) return null;
  const oldest = sheets[sheets.length - 1];

  const toggleSheet = (period: string) => {
    setDetail(null);
    setOpenPeriod((p) => (p === period ? null : period));
  };
  // Compare opens on the chosen sheet against the first one (or the newest,
  // when the chosen sheet is the first).
  const openCompare = (right: string, slotId: number | null) => {
    const left = right === oldest.period ? sheets[0].period : oldest.period;
    setCompare({ left, right, slotId });
    setDetail(null);
  };

  return (
    <section className="pp-card pp-gallery">
      <div className="pp-gallery-head">
        <div>
          <span className="pp-eyebrow">Sheets</span>
          {compare && <p className="pp-gallery-help">Pick the two sheets with the menus on the right</p>}
        </div>
        <div className="pp-gallery-tools">
          {hasPhases && !compare && (
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
              onClick={() => (compare ? setCompare(null) : openCompare(openSheet?.period ?? sheets[0].period, null))}
            >
              <CompareGlyph />
              {compare ? "Back to the sheets" : "Compare"}
            </button>
          )}
        </div>
      </div>

      {compare ? (
        <CompareView
          sheets={sheets}
          chronological={chronological}
          compare={compare}
          setCompare={setCompare}
          pairSize={pairSize}
          setPairSize={setPairSize}
        />
      ) : (
        <div className="pp-sheet-list">
          {chronological.map((s) => {
            const open = s.period === openPeriod;
            const phaseNames = PHASE_TRACKS.filter((t) => s.phases[t.id]);
            return (
              <article key={s.period} className={`pp-sheet-row${open ? " open" : ""}`}>
                <button type="button" className="pp-sheet-row-head" aria-expanded={open} onClick={() => toggleSheet(s.period)}>
                  <span className="pp-sheet-row-main">
                    <span className="pp-sheet-row-titlerow">
                      <span className="pp-sheet-row-title">{s.title}</span>
                      {s.live ? (
                        <span className="pp-tile-badge open">Open</span>
                      ) : !s.complete ? (
                        <span className="pp-tile-badge">Partial</span>
                      ) : null}
                    </span>
                    <span className="pp-sheet-row-meta">
                      {s.dateLabel} · {s.inCount} of {s.total}
                    </span>
                  </span>
                  {showPhases && phaseNames.length > 0 && (
                    <span className="pp-sheet-row-phases">
                      {phaseNames.map((t) => (
                        <span key={t.id} className={`pp-phase ${t.id}`} title={`${t.label}: ${s.phases[t.id]}`}>
                          {s.phases[t.id]}
                        </span>
                      ))}
                    </span>
                  )}
                  <span className="pp-tile-dots" aria-hidden="true">
                    {s.cells.map((c) => (
                      <span key={c.slotId} className={`pp-tile-dot${c.src ? " in" : ""}`} />
                    ))}
                  </span>
                  <span className={`pp-chevron${open ? " open" : ""}`} aria-hidden="true">
                    <ChevronDownIcon />
                  </span>
                </button>

                {open && (
                  <div className="pp-sheet-row-body">
                    {detail != null && s.cells.length > 0 ? (
                      <SheetDetail
                        sheet={s}
                        sheets={sheets}
                        index={Math.min(detail, s.cells.length - 1)}
                        setDetail={setDetail}
                        onJump={(period, i) => {
                          setOpenPeriod(period);
                          setDetail(i);
                        }}
                        onCompare={(slotId) => openCompare(s.period, slotId)}
                      />
                    ) : (
                      <SheetView clientId={clientId} firstName={firstName} sheet={s} onOpen={setDetail} />
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

// An open row: the sheet's photos (each opens big) and the coach's notes.
function SheetView({
  clientId,
  firstName,
  sheet,
  onOpen,
}: {
  clientId: number;
  firstName: string;
  sheet: GallerySheet;
  onOpen: (index: number) => void;
}) {
  return (
    <>
      <div className="pp-shots">
        {sheet.cells.map((c, i) => (
          <button key={c.slotId} type="button" className="pp-shot" onClick={() => onOpen(i)} aria-label={`Open ${c.label}`}>
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

// One photo big, with the rest of its sheet and the same angle on earlier sheets.
function SheetDetail({
  sheet,
  sheets,
  index,
  setDetail,
  onJump,
  onCompare,
}: {
  sheet: GallerySheet;
  sheets: GallerySheet[];
  index: number;
  setDetail: Dispatch<SetStateAction<number | null>>;
  onJump: (period: string, index: number) => void;
  onCompare: (slotId: number) => void;
}) {
  const count = sheet.cells.length;
  const cell = sheet.cells[index];
  const earlier = sheets
    .slice(sheets.indexOf(sheet) + 1)
    .reverse()
    .map((s) => ({ s, i: s.cells.findIndex((c) => c.slotId === cell.slotId) }))
    .filter((x) => x.i >= 0);

  return (
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
        {count > 1 && (
          <div className="pp-detail-nav">
            <button type="button" className="pp-icon-btn" aria-label="Previous angle" onClick={() => setDetail((index - 1 + count) % count)}>
              ←
            </button>
            <span className="pp-faint">
              {index + 1} of {count}
            </span>
            <button type="button" className="pp-icon-btn" aria-label="Next angle" onClick={() => setDetail((index + 1) % count)}>
              →
            </button>
          </div>
        )}
      </div>
      <div className="pp-detail-side">
        <button type="button" className="pp-btn tint sm" onClick={() => setDetail(null)}>
          Back to the sheet
        </button>
        <h3 className="pp-detail-name">{cell.label}</h3>
        <p className="pp-detail-when">{cell.shot ? `Shot ${cell.shot}` : sheet.live ? "Not in yet" : "Never sent"}</p>
        <div className="pp-detail-actions">
          {cell.src && (
            <a className="pp-btn navy" href={cell.src} target="_blank" rel="noopener noreferrer">
              Open full size
            </a>
          )}
          {sheets.length > 1 && (
            <button type="button" className="pp-btn tint" onClick={() => onCompare(cell.slotId)}>
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
                  <button key={s.period} type="button" className="pp-mini-wrap" aria-label={`${c.label}, ${s.title}`} onClick={() => onJump(s.period, i)}>
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
}

// Two sheets side by side, one angle at a time, at a size the coach picks.
function CompareView({
  sheets,
  chronological,
  compare,
  setCompare,
  pairSize,
  setPairSize,
}: {
  sheets: GallerySheet[];
  chronological: GallerySheet[];
  compare: Compare;
  setCompare: (c: Compare) => void;
  pairSize: PairSize;
  setPairSize: (size: PairSize) => void;
}) {
  const left = sheets.find((s) => s.period === compare.left) ?? chronological[0];
  const right = sheets.find((s) => s.period === compare.right) ?? sheets[0];
  const angles = [...right.cells, ...left.cells.filter((c) => !right.cells.some((r) => r.slotId === c.slotId))];
  const slotId = angles.some((a) => a.slotId === compare.slotId) ? compare.slotId : angles[0]?.slotId ?? null;
  const angle = angles.find((a) => a.slotId === slotId);
  const weightClause = left.weight != null && right.weight != null ? `${kgDelta(left.weight, right.weight)} between sheets` : null;
  const meta = [angle?.label, `${daysApart(left.period, right.period)} days apart`, weightClause].filter(Boolean).join(" · ");

  return (
    <div className="pp-view pp-compare-view">
      <div className="pp-view-head">
        <div className="pp-view-titles">
          <div className="pp-view-titlerow">
            <span className="pp-view-title">
              {left.title} vs {right.title}
            </span>
          </div>
          {meta && <div className="pp-view-meta">{meta}</div>}
        </div>
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
      </div>

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
            <figure key={`${i}-${s.period}`} className="pp-pair-side" style={{ maxWidth: PAIR_SIZES.find((z) => z.id === pairSize)?.px }}>
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
    </div>
  );
}
