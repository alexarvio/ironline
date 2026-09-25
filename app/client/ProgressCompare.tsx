"use client";

import { useState } from "react";
import { PhotoViewer } from "./PhotoPeriodHistoryRow";

// The client's Compare, on the progress-pictures screen: two sheets side by
// side, one angle at a time, the earlier on the left. Both sheets are picked
// (the first and the latest to start with), the angle from a row of chips,
// and how far apart they were sits between the two. Only sheets with at
// least one picture in them are offered.

export type CompareSheet = {
  period: string;
  title: string;
  cells: { slotId: number; label: string; src: string | null }[];
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dm = (s: string) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
const daysApart = (a: string, b: string) => Math.abs(Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000));
const apartLabel = (days: number) => (days >= 14 ? `${Math.round(days / 7)} weeks apart` : `${days} day${days === 1 ? "" : "s"} apart`);

export default function ProgressCompare({ sheets }: { sheets: CompareSheet[] }) {
  // Oldest first, and only those with something in them.
  const withPics = sheets.filter((s) => s.cells.some((c) => c.src)).sort((a, b) => (a.period < b.period ? -1 : 1));
  const [before, setBefore] = useState(withPics[0]?.period ?? "");
  const [after, setAfter] = useState(withPics[withPics.length - 1]?.period ?? "");
  const [slot, setSlot] = useState<number | null>(null);
  // A photo tapped: full screen, swiping between Before and After.
  const [viewing, setViewing] = useState<number | null>(null);

  if (withPics.length < 2) {
    return <p className="pc-cmp-empty">Compare needs two sheets with pictures in them. Your next sheet will make it possible.</p>;
  }
  const A = withPics.find((s) => s.period === before) ?? withPics[0];
  const B = withPics.find((s) => s.period === after) ?? withPics[withPics.length - 1];
  // Every angle either sheet has, the later sheet's order first.
  const angles = [...B.cells, ...A.cells.filter((c) => !B.cells.some((b) => b.slotId === c.slotId))];
  const slotId = angles.some((a) => a.slotId === slot) ? slot : (angles.find((a) => A.cells.some((c) => c.slotId === a.slotId && c.src) && B.cells.some((c) => c.slotId === a.slotId && c.src)) ?? angles[0])?.slotId ?? null;

  // The pair, full size: Before then After, those that were taken.
  const big = [A, B].flatMap((sh, i) => {
    const c = sh.cells.find((x) => x.slotId === slotId);
    return c?.src ? [{ slotId: c.slotId * 10 + i, label: `${i === 0 ? "Before" : "After"} · ${dm(sh.period)}`, src: c.src }] : [];
  });
  return (
    <div className="pc-cmp">
      <div className="pc-cmp-picks">
        <SheetPick label="Before" sheets={withPics} value={A.period} exclude={B.period} onChange={setBefore} />
        <SheetPick label="After" sheets={withPics} value={B.period} exclude={A.period} onChange={setAfter} />
      </div>

      <div className="pc-cmp-angles" role="radiogroup" aria-label="Angle">
        {angles.map((a) => (
          <button key={a.slotId} type="button" role="radio" aria-checked={a.slotId === slotId} className={a.slotId === slotId ? "on" : ""} onClick={() => setSlot(a.slotId)}>
            {a.label}
          </button>
        ))}
      </div>

      <div className="pc-cmp-pair">
        {[A, B].map((s, i) => {
          const c = s.cells.find((x) => x.slotId === slotId);
          return (
            <figure key={`${i}-${s.period}`} className="pc-cmp-side">
              {c?.src ? (
                <button type="button" className="pc-cmp-zoom" onClick={() => setViewing(big.findIndex((b) => b.src === c.src))} aria-label={`${c.label}, ${s.title}: full screen`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app */}
                  <img src={c.src} alt={`${c.label}, ${s.title}`} />
                </button>
              ) : (
                <span className="pc-cmp-hole">Not taken</span>
              )}
              <figcaption>
                <b>{i === 0 ? "Before" : "After"}</b>
                <small>{dm(s.period)}</small>
              </figcaption>
            </figure>
          );
        })}
      </div>
      <p className="pc-cmp-apart">{apartLabel(daysApart(A.period, B.period))} · tap a photo to see it bigger</p>
      {viewing != null && big[viewing] && (
        <PhotoViewer photos={big} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} title="Compare" />
      )}
    </div>
  );
}

/** One side's sheet, from a plain select: the phone's own picker. */
function SheetPick({ label, sheets, value, exclude, onChange }: { label: string; sheets: CompareSheet[]; value: string; exclude: string; onChange: (v: string) => void }) {
  return (
    <label className="pc-cmp-pick">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {sheets.map((s) => (
          <option key={s.period} value={s.period} disabled={s.period === exclude}>
            {s.title}
          </option>
        ))}
      </select>
    </label>
  );
}
