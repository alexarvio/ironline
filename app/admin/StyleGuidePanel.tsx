"use client";

import { useState } from "react";
import PhaseHeader, { type PhaseOption } from "./PhaseHeader";
import { pageWindow } from "../lib/pager";
import { TrashIcon } from "../components/icons";

// The house style, rendered from the real classes.
//
// A written guide cannot be checked against a screen — you have to hold the
// rule in your head while you look at the thing. This page IS the stylesheet:
// every swatch and every button below uses the class the product uses, so it
// cannot drift from what ships. If something here looks wrong, the app looks
// wrong too, and fixing it here fixes it everywhere.
//
// The rules in words live in docs/UI-GUIDELINES.md; `npm run audit:ui` greps
// for the four that keep drifting.

const PHASES: PhaseOption[] = [
  { id: 1, name: "Calistenia", status: "live", start: "2026-08-17", dates: "Aug 17 – Sep 20", weeks: 5, week: 5 },
  { id: 2, name: "Peak", status: "scheduled", start: "2026-09-21", dates: "Sep 21 – Oct 11", weeks: 3 },
  { id: 3, name: "Untitled", status: "draft", start: null, dates: "", weeks: 3 },
];

const SWATCHES: [string, string, string][] = [
  ["#1e3a6e", "Navy", "buttons that write, headings on a band"],
  ["#2f5d8f", "Accent", "links, focus rings, selected states"],
  ["#e6ecf3", "Tint", "card header bands, selected rows"],
  ["#141a24", "Ink", "headings, the first cell in a row"],
  ["#313851", "Text", "body copy"],
  ["#5b6474", "Muted", "labels, second cells"],
  ["#8b93a1", "Faint", "placeholders, hints, footers"],
  ["#dfe3e8", "Border", "card and input outlines"],
  ["#eceff3", "Hairline", "dividers inside a card"],
  ["#F4F7FC", "Page", "every screen background"],
  ["#2f7a3f", "Good", "on target, done"],
  ["#b3471d", "Warning", "off target, draft, unsaved"],
  ["#a32d2d", "Destructive", "delete"],
];

const FIGURES = [
  { label: "Training", value: "0 of 3", sub: "sessions this week" },
  { label: "Nutrition goal", value: "2,929 kcal", sub: "P 235 · C 315 · F 81" },
  { label: "Weight", value: "90 kg", sub: "level this phase" },
  { label: "Invoices", value: "1", sub: "outstanding", warn: true },
];

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="pl-card">
      <div className="pl-card-head">
        <div className="pl-card-titles">
          <span className="pl-eyebrow">{title}</span>
          <span className="pl-helper">{hint}</span>
        </div>
      </div>
      <div className="sg-body">{children}</div>
    </section>
  );
}

export default function StyleGuidePanel() {
  const [phase, setPhase] = useState(1);
  const [page, setPage] = useState(3);

  return (
    <div className="sg">
      <Section title="The one question" hint="Everything below follows from it">
        <p className="sg-lead">
          <strong>Does this button commit something?</strong> Add, Save, Apply, Deploy, Schedule, Make it live — those
          write, so they are navy and filled, one per card. Everything else is never filled.
        </p>
      </Section>

      <Section title="Buttons" hint="Navy fill means it writes">
        <div className="sg-row">
          <button type="button" className="ad-btn-primary">Save</button>
          <button type="button" className="ad-btn-primary" disabled>Save</button>
          <button type="button" className="ad-btn-secondary">Cancel</button>
          <button type="button" className="ph-minor">Back to draft</button>
          <button type="button" className="nw-edit-phase">Edit dates</button>
        </div>
        <p className="sg-note">
          Primary, the same disabled, secondary, quiet text, outlined. The primary is defined once in{" "}
          <code>globals.css</code> under “The executing button” — a new screen adds its selector there rather than
          picking a fill of its own.
        </p>

        <div className="sg-row">
          <button type="button" className="pb-add-session" style={{ maxWidth: 260 }}>
            + Add session
          </button>
          <span className="sg-note sg-inline">Adding a row opens a form; it writes nothing. Dashed, navy letters.</span>
        </div>

        <div className="sg-row sg-on-navy">
          <button type="button" className="pb-pending-apply">Apply</button>
          <span>A primary on a navy surface inverts: white fill, navy letters.</span>
        </div>

        <div className="sg-row">
          <button type="button" className="row-icon-btn row-icon-danger" aria-label="Delete">
            <TrashIcon />
          </button>
          <span className="sg-note sg-inline">
            The bin, the same everywhere — bare and grey where it sits, red when you reach for it. Hover it.
          </span>
        </div>
      </Section>

      <Section title="Two levels of heading" hint="And only two">
        <div className="sg-demo-card">
          <div className="pl-card-head">
            <div className="pl-card-titles">
              <span className="pl-eyebrow">The card</span>
              <span className="pl-helper">Tinted band, navy letters, at most one button</span>
            </div>
            <div className="pl-card-tools">
              <button type="button" className="pl-primary">Add phase</button>
            </div>
          </div>
          <div className="nl-block-strip sg-strip">
            <span className="nw-label">A section inside it</span>
          </div>
          <div className="sg-demo-body">
            White with navy letters. Same voice, no fill, so the card header still sits above its sections.
          </div>
        </div>
      </Section>

      <Section title="The phase band" hint="Training, Nutrition and Measurements, identically">
        <div className="sg-demo-card">
          <PhaseHeader
            kind="programme"
            phases={PHASES}
            currentId={phase}
            onSelect={setPhase}
            onNew={() => {}}
            primary={phase === 1 ? undefined : <button type="button" className="ph-primary">Schedule it</button>}
            editDates={<button type="button" className="nw-edit-phase">Edit dates</button>}
          />
          <div className="sg-demo-body">Switch phase above to see each state. Actions on top, what it IS underneath.</div>
        </div>
      </Section>

      <Section title="Figures" hint="Archivo, tabular, black unless it needs you to act">
        <div className="ch-stats">
          {FIGURES.map((s) => (
            <div key={s.label} className="ch-stat">
              <span className="ch-stat-label">{s.label}</span>
              <span className="ch-stat-body">
                <span className={`ch-stat-value${s.warn ? " warn" : ""}`}>{s.value}</span>
                <span className="ch-stat-unit">{s.sub}</span>
              </span>
            </div>
          ))}
        </div>
        <p className="sg-note">
          Only the overdue invoice is coloured. A zero, or a count still in progress, is not a problem — it is black.
        </p>
      </Section>

      <Section title="Colour" hint="A colour always carries a meaning">
        <div className="sg-swatches">
          {SWATCHES.map(([hex, name, use]) => (
            <div key={hex} className="sg-swatch">
              <span className="sg-chip" style={{ background: hex }} />
              <span className="sg-swatch-name">{name}</span>
              <span className="sg-swatch-hex">{hex}</span>
              <span className="sg-swatch-use">{use}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Pages" hint="Fifteen rows, then the next fifteen">
        <nav className="pg" aria-label="Example pages">
          <button type="button" className="pg-step" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            ‹ Newer
          </button>
          <span className="pg-nums">
            {pageWindow(page, 12).map((n, i) =>
              n === "gap" ? (
                <span key={`g${i}`} className="pg-gap">
                  …
                </span>
              ) : (
                <button key={n} type="button" className={`pg-num${n === page ? " on" : ""}`} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            )}
          </span>
          <button
            type="button"
            className="pg-step"
            onClick={() => setPage(Math.min(12, page + 1))}
            disabled={page === 12}
          >
            Older ›
          </button>
        </nav>
      </Section>
    </div>
  );
}
