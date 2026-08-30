"use client";

import { useRef, useState } from "react";
import { LineChart, Point } from "../components/LineChart";

// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx/
// CheckInHub.tsx for why a "use client" file importing queries.ts breaks
// the dev server). All data comes in as plain props, computed server-side.
export type TrendMetric = {
  id: string;
  name: string;
  points: Point[];
  currentValueLabel: string;
  unitLabel: string;
  trendLabel: string;
  trendGood: boolean;
  rangeLabel: string;
  avgLabel: string;
};

// Home Dark's full-bleed trend band: one 100%-wide, center-snapped slide per
// metric (gradient chart filling the whole panel, value/trend/range text
// laid over it) with dot pagination underneath — swipe or tap a dot to move
// between metrics. No card, no heading; the panel *is* the background.
export default function TrendCarousel({ metrics }: { metrics: TrendMetric[] }) {
  const [index, setIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);

  const goTo = (i: number) => {
    setIndex(i);
    const el = carouselRef.current;
    const slide = el?.firstElementChild as HTMLElement | null;
    if (!el || !slide) return;
    el.scrollTo({ left: i * slide.getBoundingClientRect().width, behavior: "smooth" });
  };

  const onScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    if (i !== index) setIndex(i);
  };

  if (metrics.length === 0) return null;

  return (
    <section className="trend-carousel-section">
      <div className="trend-carousel car" ref={carouselRef} onScroll={onScroll}>
        {metrics.map((m) => (
          <div key={m.id} className="trend-slide">
            <LineChart points={m.points} bleed gradientId={`trend-grad-${m.id}`} />
            <div className="trend-slide-overlay">
              <div>
                <div className="trend-slide-head">
                  <span className="trend-slide-name">{m.name}</span>
                  <span className="trend-slide-trend" style={{ color: m.trendGood ? "var(--fp-accent)" : "var(--fp-warn)" }}>
                    {m.trendLabel}
                  </span>
                </div>
                <div className="trend-slide-value-row">
                  <span className="trend-slide-value">{m.currentValueLabel}</span>
                  <span className="trend-slide-unit">{m.unitLabel}</span>
                </div>
              </div>
              <div className="trend-slide-foot">
                <span>{m.rangeLabel}</span>
                <span>{m.avgLabel}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {metrics.length > 1 && (
        <div className="trend-dots">
          {metrics.map((m, i) => (
            <button
              key={m.id}
              type="button"
              className="trend-dot-btn"
              aria-label={m.name}
              onClick={() => goTo(i)}
            >
              <span
                className="trend-dot"
                style={{ width: i === index ? 20 : 5, background: i === index ? "var(--fp-accent)" : "#3a3a32" }}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
