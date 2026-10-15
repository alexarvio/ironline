"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { eventTypeOf } from "../../lib/eventTypes";
import { buildTimeline, ITEM_WIDTH, STRIDE, type TimelineItem } from "../../lib/eventTimeline";
import { useOpenEvents } from "../CheckInContext";
import { TypeIcon } from "../events/AddEventSheet";
import type { HomeEvents } from "../EventsCard";

// Home's events card as a swipeable timeline (15 Oct): every event on one
// row, past on the left, today in the middle, what is coming on the right.
// It opens centred on today; the centred one grows and takes its colour,
// the past ones read as done. The whole list stays the Events screen.

const NEUTRAL_RGB = "16,24,40";
const CALENDAR = "M4 6h16v14H4zM4 10h16M9 3v4M15 3v4";

/** A lighter start for the gradient: the type's colour pulled a quarter of the way to white. */
function lighter(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * 0.28);
  const r = mix((n >> 16) & 255), g = mix((n >> 8) & 255), b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export default function EventsTimelineCard({ events, today }: { events: HomeEvents; today: string }) {
  const openEvents = useOpenEvents();
  const { items, todayIndex } = useMemo(
    () => buildTimeline(events.list.filter((e) => !e.phase).map((e) => ({ id: e.id, kind: e.kind, title: e.title, start: e.start, end: e.end })), today),
    [events.list, today],
  );
  const cardRef = useRef<HTMLElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const [side, setSide] = useState(0);
  const [pos, setPos] = useState(todayIndex);
  const focused = Math.min(items.length - 1, Math.max(0, Math.round(pos)));
  const reduced = useRef(false);

  // The side padding puts the first and last item within reach of the centre.
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const measure = () => setSide(Math.max(0, (card.clientWidth - ITEM_WIDTH) / 2));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(card);
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

  // The scroll drives the scale and the focus, one update a frame.
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

  const focusedItem = items[focused];
  const focusedRgb = focusedItem?.event ? eventTypeOf(focusedItem.event.kind).rgb : NEUTRAL_RGB;
  const onToday = focused === todayIndex;

  // The dots: at most 12, a window around the focused one.
  const dots = useMemo(() => {
    const n = items.length;
    if (n <= 12) return items.map((_, i) => i);
    const start = Math.min(Math.max(0, focused - 6), n - 12);
    return Array.from({ length: 12 }, (_, k) => start + k);
  }, [items, focused]);

  return (
    <section ref={cardRef} className="evt" aria-label="Events" style={{ "--focus-rgb": focusedRgb } as React.CSSProperties}>
      <div className="evt-head">
        <span className="evt-eyebrow">Events</span>
        {onToday ? (
          <button type="button" className="evt-all" onClick={() => openEvents?.()}>
            See all ›
          </button>
        ) : (
          <button type="button" className="evt-back" onClick={() => scrollTo(todayIndex)} aria-label="Back to today">
            Back to today
          </button>
        )}
      </div>

      <div className="evt-wrap">
        <span className="evt-spine" aria-hidden="true" />
        <div ref={rowRef} className="evt-row" role="listbox" aria-label="Events" tabIndex={0} onScroll={onScroll} onKeyDown={onKey} style={{ paddingLeft: side, paddingRight: side }}>
          {items.map((it, i) => (
            <Item key={it.key} item={it} index={i} pos={pos} focused={i === focused} onPick={() => (i === focused ? (it.slot === "more" ? openEvents?.() : it.event ? openEvents?.(it.event.id) : openEvents?.()) : scrollTo(i))} />
          ))}
        </div>
      </div>

      <div className="evt-dots" aria-hidden="true">
        {dots.map((i) => (
          <i key={i} className={`evt-dot${i === focused ? " on" : ""}${i === todayIndex ? " today" : items[i].slot === "past" ? " past" : ""}`} />
        ))}
      </div>
    </section>
  );
}

function Item({ item, index, pos, focused, onPick }: { item: TimelineItem; index: number; pos: number; focused: boolean; onPick: () => void }) {
  const d = Math.min(Math.abs(index - pos), 2);
  const scale = 1.08 - d * 0.16;
  const t = item.event ? eventTypeOf(item.event.kind) : null;
  const style = {
    transform: `scale(${scale.toFixed(3)})`,
    ...(t ? { "--c": t.color, "--c2": lighter(t.color), "--rgb": t.rgb } : {}),
  } as React.CSSProperties;
  const slotClass = item.slot === "more" ? " more" : item.slot === "today" && !item.event ? " free" : ` ${item.slot}`;
  const spoken = item.slot === "more" ? "See all events" : item.event ? `${item.label}: ${item.event.title}, ${item.when}${item.slot === "past" ? ", done" : ""}` : "Today: nothing on, free day";
  return (
    <button type="button" role="option" aria-selected={focused} aria-label={spoken} className="evt-slot" onClick={onPick}>
      <span className={`evt-item${slotClass}${focused ? " on" : ""}`} style={style}>
        <span className="evt-tile" aria-hidden="true">
          {item.slot === "more" ? <TypeIcon path="M5 12h14M13 6l6 6-6 6" size={20} stroke={2.2} /> : t ? <TypeIcon path={t.icon} fill={t.fill} size={20} stroke={2.2} /> : <TypeIcon path={CALENDAR} size={20} stroke={2.2} />}
        </span>
        {item.slot === "more" ? (
          <>
            <span className="evt-label">All</span>
            <span className="evt-title">See all events ›</span>
            <span className="evt-when">Past and coming</span>
          </>
        ) : (
          <>
            <span className="evt-label">{item.label}</span>
            <span className="evt-title">{item.event ? item.event.title : "Nothing on"}</span>
            <span className="evt-when">{item.when}</span>
          </>
        )}
      </span>
    </button>
  );
}
