"use client";

import { useState } from "react";
import { ChevronLeftIcon } from "../components/icons";
import { EventSheet, standing, chromeOf, shortDate, type HomeEvent, type HomeEvents } from "./EventsCard";

// The Events screen (8 Oct), pushed from Home's "Coming up" card: everything
// in the client's life the plan should know about, to come and past, with
// Add at the top. Their own rows open the sheet to change or remove; the
// coach's are listed as they are, with the note the coach wrote.

export default function EventsScreen({ events, coachName, today, onBack }: { events: HomeEvents; coachName: string; today: string; onBack: () => void }) {
  const [open, setOpen] = useState<{ event: HomeEvent | null } | null>(null);
  const [peek, setPeek] = useState<HomeEvent | null>(null);
  const byStart = (a: HomeEvent, b: HomeEvent) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id);
  const coming = events.list.filter((e) => e.end >= today).sort(byStart);
  const past = events.list.filter((e) => e.end < today).sort(byStart).reverse();
  const tap = (e: HomeEvent) => (e.mine ? setOpen({ event: e }) : setPeek(peek?.id === e.id ? null : e));
  const row = (e: HomeEvent) => {
    const k = chromeOf(events.categories, e.kind);
    const isPast = e.end < today;
    return (
      <li key={e.id} className={`ev-row${isPast ? " past" : ""}`}>
        <button type="button" className="ev-row-btn" onClick={() => tap(e)} aria-label={e.mine ? `${e.title}, change` : e.title}>
          <i className="ev-dot" style={{ background: k.ink }} />
          <span className="ev-text">
            <span className="ev-title">{e.title}</span>
            <span className="ev-sub">
              {e.start === e.end ? shortDate(e.start) : `${shortDate(e.start)} – ${shortDate(e.end)}`} · {standing(today, e)}
              {k.label !== "Event" && ` · ${k.label}`}
              {!e.mine && ` · from ${coachName}`}
            </span>
            {peek?.id === e.id && e.note && <span className="ev-note">{e.note}</span>}
          </span>
          {e.mine && <span className="ev-chev" aria-hidden="true">›</span>}
        </button>
      </li>
    );
  };
  return (
    <>
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Events</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cn-body">
        <div className="mts-scroll ev-scroll">
          <button type="button" className="ev-add" onClick={() => setOpen({ event: null })}>
            + Add an event
            <small>A trip, an injury, the day you started something. {coachName} sees it on your plan.</small>
          </button>

          <section className="mts-section" aria-label="Coming up">
            <div className="mts-head">Coming up</div>
            {coming.length === 0 ? <p className="mts-empty">Nothing coming up. Tell {coachName} what is, so the plan can plan around it.</p> : <ul className="mts-list">{coming.map(row)}</ul>}
          </section>

          {past.length > 0 && (
            <section className="mts-section" aria-label="Past">
              <div className="mts-head">Past</div>
              <ul className="mts-list">{past.map(row)}</ul>
            </section>
          )}
        </div>
      </main>
      {open && <EventSheet event={open.event} categories={events.categories} coachName={coachName} today={today} onClose={() => setOpen(null)} />}
    </>
  );
}
