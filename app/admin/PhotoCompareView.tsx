"use client";

import { useState } from "react";

type Photo = { slotId: number; label: string; src: string | null };
type PeriodPhotos = { period: string; label: string; photos: Photo[] };

// Side-by-side comparison between ANY two check-ins the coach picks — not
// just adjacent ones, e.g. Week 1 vs Week 8. Defaults to the very first and
// very latest so there's an immediately useful comparison on open.
export default function PhotoCompareView({ periodsData }: { periodsData: PeriodPhotos[] }) {
  const [aIndex, setAIndex] = useState(0);
  const [bIndex, setBIndex] = useState(periodsData.length - 1);

  if (periodsData.length < 2) return null;

  const a = periodsData[aIndex];
  const b = periodsData[bIndex];

  return (
    <div className="nutrition-table-wrap builder-card">
      <h3 className="builder-pill-heading">Compare progress</h3>
      <p className="empty-note" style={{ marginBottom: 14 }}>
        Pick any two check-ins to compare side by side — Week 1 vs Week 8, or whatever you want.
      </p>

      <div className="photo-compare-controls">
        <label>
          Compare
          <select value={aIndex} onChange={(e) => setAIndex(Number(e.target.value))}>
            {periodsData.map((p, i) => (
              <option key={p.period} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          with
          <select value={bIndex} onChange={(e) => setBIndex(Number(e.target.value))}>
            {periodsData.map((p, i) => (
              <option key={p.period} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="photo-compare-grid">
        {a.photos.map((photoA, i) => {
          const photoB = b.photos[i];
          return (
            <div key={photoA.slotId} className="photo-compare-pair">
              <div className="photo-compare-slot-label">{photoA.label}</div>
              <div className="photo-compare-images">
                <div className="photo-thumb-card">
                  {photoA.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoA.src} alt={photoA.label} className="photo-thumb-img" />
                  ) : (
                    <div className="photo-thumb-empty">Not uploaded</div>
                  )}
                  <div className="photo-thumb-label">{a.label}</div>
                </div>
                <div className="photo-thumb-card">
                  {photoB?.src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoB.src} alt={photoB.label} className="photo-thumb-img" />
                  ) : (
                    <div className="photo-thumb-empty">Not uploaded</div>
                  )}
                  <div className="photo-thumb-label">{b.label}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
