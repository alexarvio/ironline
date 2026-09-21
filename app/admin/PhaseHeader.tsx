"use client";

import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "../components/icons";
import type { PhaseTrack } from "../lib/db";
import { phaseChrome, TRACK_PALETTE } from "./phaseChrome";

// The band at the top of whatever phase is being edited — a programme on
// Training, a set of targets on Nutrition, a metric set on Measurements.
//
// One component, because a coach moving between those tabs should not have
// to re-read the same header in three shapes, and because the phase switcher
// IS the header: the name is the button. What used to be two cards (a rail
// of chips, then an "EDITING …" band under it) is one band, and the chips
// live in the menu the name opens. `kind` decides the eyebrow's wording and
// nothing else — do not fork this per tab.

export type PhaseKind = "programme" | "nutrition" | "lifestyle";
export type PhaseStatus = "live" | "scheduled" | "draft" | "past";

export type PhaseOption = {
  id: number;
  name: string;
  status: PhaseStatus;
  /** The Monday it starts (ISO), for ordering. Null while a draft has no dates. */
  start: string | null;
  /** "Aug 18 – Sep 28", already formatted. Empty while a draft has no dates. */
  dates: string;
  /** How many weeks long it is. */
  weeks: number;
  /** Which of those weeks the client is in — the running phase only. */
  week?: number | null;
};

const EYEBROW: Record<PhaseKind, string> = {
  programme: "Programme",
  nutrition: "Nutrition phase",
  lifestyle: "Lifestyle phase",
};

// The band is the TAB's colour: nutrition green, training purple, lifestyle
// beige, whatever state the phase is in, so each tab reads as its own track.
// The state is the chip's job, in the state's colours from phaseChrome (the
// same rule as the phase dialog and the Plan timeline: live in the track's
// colours, scheduled blue, draft peach), and a draft's band keeps its dashed
// edge. Where the chip would be the band's own colour (live) it goes white.
const TRACK_OF: Record<PhaseKind, PhaseTrack> = { programme: "training", nutrition: "nutrition", lifestyle: "lifestyle" };

const STATE_LABEL: Record<PhaseStatus, string> = {
  live: "Live",
  scheduled: "Scheduled",
  draft: "Draft",
  past: "Past",
};

/** Oldest first; a draft with no dates yet sorts to the end. */
const byStart = (a: PhaseOption, b: PhaseOption) => {
  if (a.start && b.start) return a.start < b.start ? -1 : a.start > b.start ? 1 : a.id - b.id;
  if (a.start) return -1;
  if (b.start) return 1;
  return a.id - b.id;
};

// What a coach wants open: what the client is doing now. Failing that, what
// they do next, and failing that the draft most recently started.
export function defaultPhaseId(phases: PhaseOption[]): number | null {
  const live = phases.find((p) => p.status === "live");
  if (live) return live.id;
  const next = phases.filter((p) => p.status === "scheduled").sort(byStart)[0];
  if (next) return next.id;
  const drafts = phases.filter((p) => p.status === "draft");
  if (drafts.length) return drafts.reduce((a, b) => (b.id > a.id ? b : a)).id;
  return phases[0]?.id ?? null;
}

/**
 * Which phase the tab is showing, kept in `?phase=` so a coach can link one.
 *
 * `initialId` is resolved on the server (the tab reads the search param), so
 * a shared link opens on its phase rather than flashing the default first.
 * `navigate` is for a tab whose contents are decided server-side from the
 * selection — Measurements, where the metric list belongs to the phase.
 * Everywhere else every phase is already rendered, so the address is
 * rewritten in place and the swap is instant.
 */
export function usePhases(
  phases: PhaseOption[],
  { initialId = null, navigate = false }: { initialId?: number | null; navigate?: boolean } = {}
) {
  const router = useRouter();
  const [picked, setPicked] = useState<number | null>(initialId);
  const current =
    phases.find((p) => p.id === picked) ??
    phases.find((p) => p.id === initialId) ??
    phases.find((p) => p.id === defaultPhaseId(phases)) ??
    null;
  const id = current?.id ?? null;

  useEffect(() => {
    if (id == null) return;
    // The server decides what is under the band in navigate mode, so only a
    // pick the coach actually made is worth a round trip.
    if (navigate && (picked == null || picked === initialId)) return;
    const url = new URL(window.location.href);
    // Already says so. Checked before writing either way: it is what stops a
    // navigation whose answer differs from what was asked for going round
    // again on the next render.
    if (url.searchParams.get("phase") === String(id)) return;
    url.searchParams.set("phase", String(id));
    if (navigate) router.replace(`${url.pathname}${url.search}`, { scroll: false });
    // null, not window.history.state: handed its own state back, Next takes
    // the write for one of its own and ignores it, and the next refresh (any
    // save) puts the old address back.
    else window.history.replaceState(null, "", url);
  }, [id, picked, initialId, navigate, router]);

  const select = useCallback((next: number) => setPicked(next), []);
  return { phases, current, currentId: id, select };
}

export default function PhaseHeader({
  kind,
  phases,
  currentId,
  onSelect,
  onNew,
  newLabel = "+ New phase",
  primary,
  secondary,
  editDates,
  emptyAction,
}: {
  kind: PhaseKind;
  phases: PhaseOption[];
  currentId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  /** Training says "programme"; everywhere else a phase is a phase. */
  newLabel?: string;
  /** The one Navy button this state has: "Schedule it", "Make it live", or none. */
  primary?: ReactNode;
  /** The rare quiet control a state carries — back to draft, delete a draft. */
  secondary?: ReactNode;
  /** The tab's own "Edit dates" button; it knows which dialog to open. */
  editDates?: ReactNode;
  /** Shown instead of everything when the client has no phase on this track. */
  emptyAction?: ReactNode;
}) {
  const current = phases.find((p) => p.id === currentId) ?? null;
  const [open, setOpen] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const switchRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const items = useRef<Record<string, HTMLButtonElement | null>>({});

  const groups = useMemo(() => {
    const of = (status: PhaseStatus) => phases.filter((p) => p.status === status).sort(byStart);
    return [
      { label: "Live now", items: of("live") },
      { label: "Scheduled", items: of("scheduled") },
      { label: "Draft", items: of("draft") },
    ].filter((g) => g.items.length > 0);
  }, [phases]);
  // History reads newest first: the phase that just ended is the one being
  // looked back at, not the one from six months ago.
  const past = useMemo(() => phases.filter((p) => p.status === "past").sort(byStart).reverse(), [phases]);

  // The menu's focus order, so ↑/↓ walk what is actually on screen.
  const order = useMemo(() => {
    const keys: string[] = [];
    groups.forEach((g) => g.items.forEach((p) => keys.push(`p${p.id}`)));
    if (past.length) {
      if (showPast) past.forEach((p) => keys.push(`p${p.id}`));
      else keys.push("more");
    }
    keys.push("new");
    return keys;
  }, [groups, past, showPast]);

  const close = useCallback(() => {
    setOpen(false);
    switchRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!menuRef.current?.contains(t) && !switchRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  // Opening lands on the phase being edited, so ↓ from there is the next one.
  useEffect(() => {
    if (!open) return;
    (items.current[`p${currentId}`] ?? items.current[order[0]])?.focus();
  }, [open, currentId, order]);

  const move = (delta: number) => {
    const els = order.map((k) => items.current[k]).filter((el): el is HTMLButtonElement => !!el);
    const at = els.indexOf(document.activeElement as HTMLButtonElement);
    els[(at + delta + els.length) % els.length]?.focus();
  };

  // No phase on this track at all: the band says so and offers the one thing
  // worth doing. Nothing to switch between, so there is no switcher.
  if (!current) {
    return (
      <div className="ph-band">
        <div className="ph-left">
          <div className="ph-eyebrow">{EYEBROW[kind]}</div>
          <div className="ph-name ph-name-empty">No phase yet</div>
        </div>
        {emptyAction && <div className="ph-right">{emptyAction}</div>}
      </div>
    );
  }

  // The span and how long it is, and nothing else. "2 scheduled after this"
  // came and went with the data rather than with the phase, so the same line
  // read differently on Training and on Nutrition for no reason a coach could
  // see — and what is queued behind this one is one click away in the menu.
  const context = [
    current.dates || "No dates yet",
    current.week != null ? `week ${current.week} of ${current.weeks}` : `${current.weeks} week${current.weeks === 1 ? "" : "s"} planned`,
  ];

  const item = (p: PhaseOption) => (
    <button
      key={p.id}
      ref={(el) => {
        items.current[`p${p.id}`] = el;
      }}
      type="button"
      role="menuitem"
      className={`ph-item${p.id === current.id ? " current" : ""}`}
      onClick={() => {
        onSelect(p.id);
        close();
      }}
    >
      <span className="ph-item-left">
        <span className={`ph-dot ${p.status}`} aria-hidden="true" />
        <span className="ph-item-name">{p.name || "Untitled"}</span>
      </span>
      <span className="ph-item-dates">{p.dates || `${p.weeks}w`}</span>
    </button>
  );

  const chrome = phaseChrome(TRACK_OF[kind], current.status);
  const band = TRACK_PALETTE[TRACK_OF[kind]].tint;
  return (
    <div className={`ph-band${chrome.dashed ? " draft" : ""}`} style={{ background: band }}>
      <div className="ph-left">
        <div className="ph-eyebrow">{EYEBROW[kind]}</div>

        <div className="ph-switch-wrap">
          <button
            ref={switchRef}
            type="button"
            className={`ph-switch${open ? " open" : ""}`}
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown" && !open) {
                e.preventDefault();
                setOpen(true);
              }
            }}
          >
            <span className="ph-name">{current.name || "Untitled"}</span>
            <span className="ph-chev" aria-hidden="true">
              <ChevronDownIcon />
            </span>
          </button>

          {open && (
            <div
              ref={menuRef}
              className="ph-menu"
              role="menu"
              aria-label={`Switch ${EYEBROW[kind].toLowerCase()}`}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(-1);
                }
              }}
            >
              {groups.map((g) => (
                <div key={g.label} className="ph-menu-group">
                  <div className="ph-menu-label">{g.label}</div>
                  {g.items.map(item)}
                </div>
              ))}

              {past.length > 0 &&
                (showPast ? (
                  <div className="ph-menu-group">
                    <div className="ph-menu-label">Past</div>
                    {past.map(item)}
                  </div>
                ) : (
                  <button
                    ref={(el) => {
                      items.current.more = el;
                    }}
                    type="button"
                    role="menuitem"
                    className="ph-more"
                    onClick={() => setShowPast(true)}
                  >
                    {past.length} earlier phase{past.length === 1 ? "" : "s"}
                  </button>
                ))}

              <div className="ph-menu-foot">
                <button
                  ref={(el) => {
                    items.current.new = el;
                  }}
                  type="button"
                  role="menuitem"
                  className="ph-new"
                  onClick={() => {
                    setOpen(false);
                    onNew();
                  }}
                >
                  {newLabel}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="ph-context">{context.join(" · ")}</div>
      </div>

      {/* What you can do to this phase on the top line, what it IS on the one
          under. The state used to sit in front of the buttons, level with the
          eyebrow, which put a word that never changes at the start of a row
          you read for its actions — and made the three tabs look different
          from each other whenever one of them had an extra control. */}
      <div className="ph-right">
        <div className="ph-actions">
          {secondary}
          {primary}
          {editDates}
        </div>
        <span className={`ph-state ${current.status}`} style={{ background: chrome.chipBg === band ? "#fff" : chrome.chipBg, color: chrome.chipInk }}>
          <span className={`ph-dot ${current.status}`} aria-hidden="true" />
          {STATE_LABEL[current.status]}
        </span>
      </div>
    </div>
  );
}
