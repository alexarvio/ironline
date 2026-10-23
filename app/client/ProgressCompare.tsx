"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../components/icons";
import { PhotoViewer } from "./PhotoPeriodHistoryRow";

// The client's Compare on the Shape update screen (23 Oct, Alex): the phone twin of the coach's
// (admin/redesign/pictures/CompareDialog.tsx), in the client's hairline voice, flat on the page.
//
// - Side by side | Slider as the capsule, remembered on this phone.
// - The two sheets as white hairline pills across the width, the left over the left photo; each opens
//   the phone's own picker, and picking the other side's sheet swaps the two. Any two sheets with
//   photos, the first and the latest to start with.
// - The angle from a row of chips.
// - Side by side: the two 3:4 photos, a tap opens one big. Slider: one stage, the right sheet under
//   the left, cut at a line dragged anywhere on it (or stepped with ← → by 5).
// - Under them how far apart the two sheets are.

export type CompareSheet = {
  period: string;
  title: string;
  cells: { slotId: number; label: string; src: string | null }[];
};

type View = "side" | "slider";
const VIEW_KEY = "pc-cmp-view";

const daysApart = (a: string, b: string) => Math.abs(Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000));
const apartLabel = (days: number) => {
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} apart`;
  if (days < 61) return `${Math.round(days / 7)} weeks apart`;
  const months = Math.round(days / 30.44);
  return `${months} month${months === 1 ? "" : "s"} apart`;
};

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// A sheet named short, so a pill never cuts two sheets to the same words: `19 Nov` ("Sheet of 19 Nov")
// or `Sep` ("September sheet"), the year after it when it isn't this one.
function nameOf(s: CompareSheet) {
  const [y, m, d] = s.period.split("-").map(Number);
  const day = / sheet$/.test(s.title) ? MON[m - 1] : `${d} ${MON[m - 1]}`;
  return y === new Date().getFullYear() ? day : `${day} ${y}`;
}

function readView(): View {
  try {
    return window.localStorage.getItem(VIEW_KEY) === "slider" ? "slider" : "side";
  } catch {
    return "side";
  }
}

export default function ProgressCompare({ sheets }: { sheets: CompareSheet[] }) {
  // Oldest first, and only those with something in them.
  const withPics = sheets.filter((s) => s.cells.some((c) => c.src)).sort((a, b) => (a.period < b.period ? -1 : 1));
  const [pair, setPair] = useState({ a: withPics[0]?.period ?? "", b: withPics[withPics.length - 1]?.period ?? "" });
  const [slot, setSlot] = useState<number | null>(null);
  // Mounted only once Compare is tapped, so the phone's own memory can be read straight away.
  const [view, setView] = useState<View>(() => (typeof window === "undefined" ? "side" : readView()));
  useEffect(() => {
    try {
      window.localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* private window: not remembered */
    }
  }, [view]);
  // A photo tapped: full screen, swiping between the two.
  const [viewing, setViewing] = useState<number | null>(null);

  if (withPics.length < 2) return <p className="pc-cmp-empty">Nothing to compare yet</p>;

  const A = withPics.find((s) => s.period === pair.a) ?? withPics[0];
  const B = withPics.find((s) => s.period === pair.b && s.period !== A.period) ?? [...withPics].reverse().find((s) => s.period !== A.period) ?? withPics[withPics.length - 1];
  // Picking the sheet the other side shows swaps the two.
  const pick = (side: "a" | "b", period: string) =>
    setPair(() => {
      const cur = { a: A.period, b: B.period };
      const other = side === "a" ? cur.b : cur.a;
      if (period === other) return { a: cur.b, b: cur.a };
      return { ...cur, [side]: period };
    });

  // Every angle either sheet has a photo for, the right sheet's order first.
  const angles = [...B.cells, ...A.cells.filter((c) => !B.cells.some((b) => b.slotId === c.slotId))].filter((a) =>
    [A, B].some((sh) => sh.cells.some((c) => c.slotId === a.slotId && c.src)),
  );
  const slotId = angles.some((a) => a.slotId === slot) ? slot : (angles.find((a) => A.cells.some((c) => c.slotId === a.slotId && c.src) && B.cells.some((c) => c.slotId === a.slotId && c.src)) ?? angles[0])?.slotId ?? null;
  const angleLabel = angles.find((a) => a.slotId === slotId)?.label ?? "";
  const srcOf = (sh: CompareSheet) => sh.cells.find((x) => x.slotId === slotId)?.src ?? null;

  // The pair, full size: those that were taken, the left first.
  const big = [A, B].flatMap((sh, i) => {
    const src = srcOf(sh);
    return src ? [{ slotId: i, label: nameOf(sh), src }] : [];
  });

  return (
    <div className="pc-cmp">
      <div className="pc-cmp-view" role="radiogroup" aria-label="View">
        {(
          [
            ["side", "Side by side"],
            ["slider", "Slider"],
          ] as const
        ).map(([v, label]) => (
          <button key={v} type="button" role="radio" aria-checked={view === v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
            {label}
          </button>
        ))}
      </div>

      <div className="pc-cmp-picks">
        <SheetPick label="Left sheet" sheets={withPics} value={A.period} onChange={(p) => pick("a", p)} />
        <SheetPick label="Right sheet" sheets={withPics} value={B.period} onChange={(p) => pick("b", p)} />
      </div>

      <div className="pc-cmp-angles" role="radiogroup" aria-label="Angle">
        {angles.map((a) => (
          <button key={a.slotId} type="button" role="radio" aria-checked={a.slotId === slotId} className={a.slotId === slotId ? "on" : ""} onClick={() => setSlot(a.slotId)}>
            {a.label}
          </button>
        ))}
      </div>

      {view === "side" ? (
        <div className="pc-cmp-pair">
          {[A, B].map((s, i) => {
            const src = srcOf(s);
            return (
              <figure key={`${i}-${s.period}`} className="pc-cmp-side">
                {src ? (
                  <button type="button" className="pc-cmp-zoom" onClick={() => setViewing(big.findIndex((b) => b.slotId === i))} aria-label={`${angleLabel}, ${nameOf(s)}: full screen`}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app */}
                    <img src={src} alt={`${angleLabel}, ${nameOf(s)}`} decoding="async" />
                  </button>
                ) : (
                  <span className="pc-cmp-hole">Not taken</span>
                )}
              </figure>
            );
          })}
        </div>
      ) : (
        <Reveal left={nameOf(A)} right={nameOf(B)} leftSrc={srcOf(A)} rightSrc={srcOf(B)} angle={angleLabel} />
      )}

      <p className="pc-cmp-apart">{apartLabel(daysApart(A.period, B.period))}</p>
      {viewing != null && big[viewing] && <PhotoViewer photos={big} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} title={angleLabel || "Compare"} />}
    </div>
  );
}

/** One side's sheet: a white hairline pill with the phone's own picker laid over it, see-through. */
function SheetPick({ label, sheets, value, onChange }: { label: string; sheets: CompareSheet[]; value: string; onChange: (v: string) => void }) {
  const current = sheets.find((s) => s.period === value);
  return (
    <label className="pc-cmp-pick">
      <span className="pc-cmp-pick-title">{current ? nameOf(current) : ""}</span>
      <ChevronDownIcon />
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {sheets.map((s) => (
          <option key={s.period} value={s.period}>
            {nameOf(s)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** The slider: one stage, the right sheet underneath, the left on top cut at the line. A sideways drag
 *  anywhere moves the line (an up-and-down one still scrolls the page), a tap puts it there, ← → step by 5. */
function Reveal({ left, right, leftSrc, rightSrc, angle }: { left: string; right: string; leftSrc: string | null; rightSrc: string | null; angle: string }) {
  const [pos, setPos] = useState(50);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; on: boolean } | null>(null);
  const at = (clientX: number) => {
    const r = stage.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={stage}
      className="pc-cmp-stage"
      onPointerDown={(e) => {
        if (e.pointerType === "mouse" && e.button !== 0) return;
        const mouse = e.pointerType === "mouse";
        drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, on: mouse };
        if (mouse) {
          e.currentTarget.setPointerCapture(e.pointerId);
          at(e.clientX);
        }
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.id !== e.pointerId) return;
        if (!d.on) {
          const dx = Math.abs(e.clientX - d.x);
          const dy = Math.abs(e.clientY - d.y);
          if (dx < 6 && dy < 6) return;
          // Up and down is the page scrolling, not the line.
          if (dx <= dy) {
            drag.current = null;
            return;
          }
          d.on = true;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* the pointer already went */
          }
        }
        at(e.clientX);
      }}
      onPointerUp={(e) => {
        const d = drag.current;
        if (d && d.id === e.pointerId && !d.on) at(e.clientX);
        drag.current = null;
      }}
      onPointerCancel={() => (drag.current = null)}
    >
      {rightSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
        <img className="pc-cmp-layer" src={rightSrc} alt={`${angle}, ${right}`} draggable={false} decoding="async" />
      ) : (
        <span className="pc-cmp-layer pc-cmp-none">
          <span style={{ left: `${(pos + 100) / 2}%` }}>Not taken</span>
        </span>
      )}
      <div className="pc-cmp-layer pc-cmp-over" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        {leftSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
          <img src={leftSrc} alt={`${angle}, ${left}`} draggable={false} decoding="async" />
        ) : (
          <span className="pc-cmp-layer pc-cmp-none">
            <span style={{ left: `${pos / 2}%` }}>Not taken</span>
          </span>
        )}
      </div>
      <span className="pc-cmp-line" style={{ left: `${pos}%` }} aria-hidden="true" />
      <span
        className="pc-cmp-handle"
        style={{ left: `${pos}%` }}
        role="slider"
        tabIndex={0}
        aria-label={`${left} and ${right}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") {
            e.preventDefault();
            setPos((p) => Math.max(0, p - 5));
          }
          if (e.key === "ArrowRight") {
            e.preventDefault();
            setPos((p) => Math.min(100, p + 5));
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
        </svg>
      </span>
      <span className="pc-cmp-tag left">{left}</span>
      <span className="pc-cmp-tag right">{right}</span>
    </div>
  );
}
