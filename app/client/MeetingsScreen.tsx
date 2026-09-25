"use client";

import { useState } from "react";
import { ChevronDownIcon, ChevronLeftIcon } from "../components/icons";
import { MeetingCard, type UpcomingMeeting } from "./HomeHub";

// Every call with the coach in one place: the next one as Home shows it
// (its link included), any booked after it, and a log of
// the ones that happened with what was agreed. Pushed over the tabs from
// Home's meeting card and the menu. Plain props, built in page.tsx.

/** A call that has happened: its date, what it was about, and the coach's recap for the client. */
export type PastMeetingView = {
  id: number;
  dayNumber: string;
  monthCap: string;
  /** "Sunday, September 14". */
  dateLabel: string;
  topic: string;
  /** The recap's one-line title; null, none written. */
  title: string | null;
  text: string | null;
  /** Marked a no-show by the coach. */
  missed: boolean;
};

export type MeetingsProps = { upcoming: NonNullable<UpcomingMeeting>[]; past: PastMeetingView[] };

export default function MeetingsScreen({ upcoming, past, coachName, onBack }: MeetingsProps & { coachName: string; onBack: () => void }) {
  const coachFirst = coachName.trim().split(/\s+/)[0] || "your coach";
  const [next, ...later] = upcoming;
  return (
    <>
      <header className="cn-header">
        <button type="button" className="cn-icon-btn" onClick={onBack} aria-label="Back">
          <ChevronLeftIcon />
        </button>
        <div className="cn-header-titles">
          <h1 className="cn-title">Meetings</h1>
        </div>
        <span className="cn-icon-spacer" aria-hidden="true" />
      </header>
      <main className="cn-body">
        <div className="mts-scroll">
          <section className="mts-section" aria-label="Next meeting">
            <div className="mts-head">Next</div>
            {next ? (
              <MeetingCard m={next} recap={null} coachFirstName={coachFirst} />
            ) : (
              <p className="mts-empty">Nothing booked yet. When {coachFirst} books a call, it shows here.</p>
            )}
          </section>

          {later.length > 0 && (
            <section className="mts-section" aria-label="Also booked">
              <div className="mts-head">Also booked</div>
              <ul className="mts-list">
                {later.map((m, i) => (
                  <li key={i} className="mts-row">
                    <span className="mts-leaf" aria-hidden="true">
                      <b>{m.dayNumber}</b>
                      <small>{m.monthCap}</small>
                    </span>
                    <span className="mts-row-text">
                      <span className="mts-row-title">{m.topic}</span>
                      <span className="mts-row-sub">{m.whenLabel}</span>
                    </span>
                    {m.link && (
                      <a className="mts-row-link" href={m.link} target="_blank" rel="noopener noreferrer">
                        Link
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mts-section" aria-label="Past meetings">
            <div className="mts-head">Past meetings</div>
            {past.length ? (
              <ul className="mts-list">
                {past.map((p, i) => (
                  <PastRow key={p.id} p={p} defaultOpen={i === 0} />
                ))}
              </ul>
            ) : (
              <p className="mts-empty">Your calls with {coachFirst} and what you agreed will build up here.</p>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

// One past call: the date leaf, what it was about, the recap's title; tap to
// read what was agreed. The newest opens on arrival.
function PastRow({ p, defaultOpen }: { p: PastMeetingView; defaultOpen: boolean }) {
  const hasRecap = !!p.text;
  const [open, setOpen] = useState(defaultOpen && hasRecap);
  const head = (
    <>
      <span className="mts-leaf" aria-hidden="true">
        <b>{p.dayNumber}</b>
        <small>{p.monthCap}</small>
      </span>
      <span className="mts-row-text">
        <span className="mts-row-sub">{p.topic}</span>
        <span className="mts-row-title">{p.missed ? "Missed" : p.title ?? (hasRecap ? "What we agreed" : "No notes yet")}</span>
      </span>
      {hasRecap && (
        <span className={`mts-chev${open ? " open" : ""}`} aria-hidden="true">
          <ChevronDownIcon />
        </span>
      )}
    </>
  );
  return (
    <li className={`mts-past${p.missed ? " missed" : ""}`} aria-label={`${p.dateLabel}: ${p.topic}`}>
      {hasRecap ? (
        <button type="button" className="mts-row mts-row-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {head}
        </button>
      ) : (
        <div className="mts-row">{head}</div>
      )}
      {hasRecap && (
        <div className={`mts-body${open ? " open" : ""}`} aria-hidden={!open}>
          <div className="mts-clip">
            <p className="mts-text">{p.text}</p>
          </div>
        </div>
      )}
    </li>
  );
}
