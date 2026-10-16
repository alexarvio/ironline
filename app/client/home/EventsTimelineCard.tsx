"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { eventTypeOf } from "../../lib/eventTypes";
import { buildTimeline, ITEM_WIDTH, STRIDE, type TimelineItem } from "../../lib/eventTimeline";
import { useOpenEvents } from "../CheckInContext";
import type { HomeEvents } from "../EventsCard";

// Home's events as a hairline timeline (15 Oct, restyled the same evening):
// every event a thin ring with a fine-line icon in its colour, strung along
// one hairline across the screen, past on the left, today in the middle,
// what is coming on the right. It opens centred on today; the centred ring
// is fully coloured with a faint halo and its title grows; past ones read as
// done. The whole list stays the Events screen.

const NEUTRAL = { color: "#5b6474", rgb: "91,100,116", icon: "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4" };
// A phase on the row: one flag, the track's colour, as the Events screen draws it.
const FLAG = "M5 21V4M5 4h11.5l-2.5 4.5 2.5 4.5H5";
const PHASES = {
  training: { color: "#3a3390", rgb: "58,51,144", icon: FLAG },
  nutrition: { color: "#1f7a4d", rgb: "31,122,77", icon: FLAG },
  lifestyle: { color: "#a8761f", rgb: "168,118,31", icon: FLAG },
};
type Chrome = { color: string; rgb: string; icon: string };
const chromeOf = (e: { kind: string | null; phase?: "training" | "nutrition" | "lifestyle" | null }): Chrome => {
  if (e.phase) return PHASES[e.phase];
  const t = eventTypeOf(e.kind);
  return { color: t.color, rgb: t.rgb, icon: t.icon };
};

/** A fine-line icon, 1.6 stroke, round caps and joins, no fills. */
function LineIcon({ path, size = 20 }: { path: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export default function EventsTimelineCard({ events, today }: { events: HomeEvents; today: string }) {
  const openEvents = useOpenEvents();
  const { items, todayIndex } = useMemo(
    () => buildTimeline(events.list.map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start, end: e.end, phase: e.phase ?? null })), today),
    [events.list, today],
  );
  const wrapRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  const [pos, setPos] = useState(todayIndex);
  const focused = Math.min(items.length - 1, Math.max(0, Math.round(pos)));
  const reduced = useRef(false);

  // The side padding puts the first and last ring within reach of the centre.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setSide(Math.max(0, (el.clientWidth - ITEM_WIDTH) / 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    return () => ro.disconnect();
  }, []);

  // Open on today, before the first paint, once the padding is known.
  const opened = useRef(false);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row || side === 0 || opened.current) return;
    row.scrollLeft = todayIndex * STRIDE;
    opened.current = true;
  }, [side, todayIndex]);

  // The scroll drives the ring scale and the focus, one update a frame.
  const raf = useRef(0);
  const lastFocused = useRef(todayIndex);
  const onScroll = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const row = rowRef.current;
      if (!row) return;
      const p = row.scrollLeft / STRIDE;
      setPos(p);
      const f = Math.round(p);
      if (f !== lastFocused.current) {
        lastFocused.current = f;
        try {
          navigator.vibrate?.(5);
        } catch {}
      }
    });
  }, []);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const scrollTo = (i: number) => rowRef.current?.scrollTo({ left: i * STRIDE, behavior: reduced.current ? "auto" : "smooth" });
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      scrollTo(Math.min(items.length - 1, Math.max(0, focused + (e.key === "ArrowLeft" ? -1 : 1))));
    }
  };
  const onToday = focused === todayIndex;

  return (
    <section ref={wrapRef} className="evt" aria-label="Events">
      <div className="evt-head">
        <span className="evt-eyebrow">Events</span>
        {onToday ? (
          <button type="button" className="evt-all" onClick={() => openEvents?.()}>
            See all
          </button>
        ) : (
          <button type="button" className="evt-today" onClick={() => scrollTo(todayIndex)} aria-label="Back to today">
            <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Today
          </button>
        )}
      </div>

      <div className="evt-wrap">
        <span className="evt-spine" aria-hidden="true" />
        <div ref={rowRef} className="evt-row" role="listbox" aria-label="Events" tabIndex={0} onScroll={onScroll} onKeyDown={onKey} style={{ paddingLeft: side, paddingRight: side }}>
          {items.map((it, i) => (
            <Item key={it.key} item={it} focused={i === focused} onPick={() => (i === focused ? (it.slot === "more" ? openEvents?.() : it.event ? openEvents?.(it.event.id) : openEvents?.()) : scrollTo(i))} />
          ))}
        </div>
      </div>

    </section>
  );
}

function Item({ item, focused, onPick }: { item: TimelineItem; focused: boolean; onPick: () => void }) {
  const c: Chrome = item.event ? chromeOf(item.event) : NEUTRAL;
  const icon = item.slot === "more" ? "M5 12h14M13 6l6 6-6 6" : c.icon;
  const cls = `evt-item ${item.slot}${focused ? " on" : ""}`;
  const spoken = item.slot === "more" ? "See all events" : item.event ? `${item.label}: ${item.event.title}, ${item.when}${item.slot === "past" ? ", done" : ""}` : "Today: nothing on, free day";
  return (
    <button type="button" role="option" aria-selected={focused} aria-label={spoken} className={cls} style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties} onClick={onPick}>
      <span className="evt-ring">
        {focused && <i className="evt-halo" aria-hidden="true" />}
        <LineIcon path={icon} />
      </span>
      <span className="evt-text">
        <span className="evt-label">{item.slot === "more" ? "All" : item.label}</span>
        <span className="evt-title">{item.slot === "more" ? "See all events" : item.event ? item.event.title : "Nothing on"}</span>
        <span className="evt-when">{item.slot === "more" ? "Past and coming" : item.when}</span>
      </span>
    </button>
  );
}
