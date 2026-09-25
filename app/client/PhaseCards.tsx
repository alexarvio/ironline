"use client";

import { useEffect, useRef, useState } from "react";
import { AppleIcon, ChevronDownIcon, DumbbellIcon, HeartIcon } from "../components/icons";
import { useNavigateTab, useOpenCheckIn, useOpenFood } from "./CheckInContext";
import FitTitle from "./FitTitle";

// Home's "Your plan": the live phase on each track, training → nutrition →
// lifestyle. A carousel of picture cards (tap one to open its tab), one card
// or three; a stack layout remains for a caller that asks for it.

/** The next session, for the training card's Start button. */
export type PhaseNextSession = { dayId: number; name: string; live: boolean } | null;
/** Today's food diary, for the nutrition card's Log button. */
export type PhaseFoodToday = { eaten: number; target: number | null } | null;

export type HomePhase = {
  id: number;
  track: "nutrition" | "training" | "lifestyle";
  /** As the coach typed it. */
  name: string;
  /** yyyy-mm-dd, first and last day. */
  start: string;
  end: string | null;
  /** The coach's cover, a stock one, or the track's default; null: its colour. */
  coverUrl: string | null;
  objectives: string[];
  note: string | null;
};

const TRACK_LABEL = { nutrition: "Nutrition", training: "Training", lifestyle: "Lifestyle" } as const;
const TRACK_ICON = { nutrition: <AppleIcon />, training: <DumbbellIcon />, lifestyle: <HeartIcon /> };
// The tab each track opens; lifestyle has none yet.
const TRACK_TAB = { nutrition: "nutrition", training: "training", lifestyle: null } as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const DAY = 86400000;
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY;
const short = (s: string) => `${Number(s.slice(8, 10))} ${MONTHS[Number(s.slice(5, 7)) - 1]}`;
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type Progress = {
  /** 0–100; the fill and the knob. */
  p: number;
  /** "Wk 4 of 12", or "Week 4" with no end. */
  weekLabel: string;
  /** "12 days left", "Last day", "Starts in 3 days", "Ended 2 Sep · waiting on Finlay". */
  leftLabel: string | null;
  /** The left label is the faint overdue line rather than the track's ink. */
  overdue: boolean;
  openEnded: boolean;
  /** "{p}% through", or "Started 17 Aug" with no end. */
  throughLabel: string;
};

// Compares yyyy-mm-dd days only, so the time of day never moves anything.
function progressOf(ph: HomePhase, today: string, coachName: string): Progress {
  const t = dayNum(today);
  const s = dayNum(ph.start);
  if (!ph.end) {
    const week = Math.max(1, Math.ceil((t - s + 1) / 7));
    return { p: 0, weekLabel: `Week ${week}`, leftLabel: null, overdue: false, openEnded: true, throughLabel: `Started ${short(ph.start)}` };
  }
  const e = dayNum(ph.end);
  const totalDays = e - s + 1;
  const elapsed = Math.min(totalDays, Math.max(0, t - s + 1));
  const p = Math.min(100, Math.max(0, Math.round((elapsed / totalDays) * 100)));
  const weeks = Math.ceil(totalDays / 7);
  const week = Math.max(1, Math.ceil(elapsed / 7));
  // Just the week they are in: "of 7" read as a countdown.
  const weekLabel = `Week ${Math.min(week, weeks)}`;
  if (t < s) {
    const n = s - t;
    return { p: 0, weekLabel, leftLabel: `Starts in ${n} day${n === 1 ? "" : "s"}`, overdue: false, openEnded: false, throughLabel: "0% through" };
  }
  if (t > e) {
    return { p: 100, weekLabel, leftLabel: `Ended ${short(ph.end)} · waiting on ${coachName}`, overdue: true, openEnded: false, throughLabel: "100% through" };
  }
  const n = e - t;
  // In whole weeks while two or more are left (20 days: "2 weeks left"),
  // then in days.
  const leftLabel = n === 0 ? "Last day" : n >= 14 ? `${Math.floor(n / 7)} weeks left` : `${n} day${n === 1 ? "" : "s"} left`;
  return { p, weekLabel, leftLabel, overdue: false, openEnded: false, throughLabel: `${p}% through` };
}

export default function PhaseCards({
  phases,
  coachName,
  today: serverToday,
  layout,
  nextSession = null,
  food = null,
  weekDone = null,
  checkInCount = null,
}: {
  phases: HomePhase[];
  coachName: string;
  nextSession?: PhaseNextSession;
  food?: PhaseFoodToday;
  /** Every session this week done: when the next week starts. */
  weekDone?: { nextWeekLabel: string } | null;
  /** The check-in as its screen shows it, for the lifestyle card. */
  checkInCount?: { done: number; total: number } | null;
  /** The server's date, until the phone's own is known. */
  today: string;
  layout?: "carousel" | "stack";
}) {
  const [today, setToday] = useState(serverToday);
  useEffect(() => {
    const tick = () => setToday(localToday());
    const first = setTimeout(tick, 0);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearTimeout(first);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  if (phases.length === 0) return null;
  // The picture cards always, one phase or three; the stack stays for a caller that asks.
  const mode = layout ?? "carousel";
  return (
    // No heading: the cards sit straight under the greeting.
    <section className={`pc-plan ${mode}`} aria-label="Your plan">
      {mode === "carousel" ? (
        <PhaseCardCarousel phases={phases} coachName={coachName} today={today} nextSession={nextSession} food={food} weekDone={weekDone} checkInCount={checkInCount} />
      ) : (
        <div className="pc-stack">
          {phases.map((ph, i) => (
            <PhaseCardStack key={ph.id} ph={ph} coachName={coachName} today={today} defaultOpen={i === 0} />
          ))}
        </div>
      )}
    </section>
  );
}

function cardLabel(ph: HomePhase, pr: Progress) {
  return `${TRACK_LABEL[ph.track]} phase: ${ph.name}, ${pr.openEnded ? pr.weekLabel : pr.throughLabel}${pr.leftLabel ? `, ${pr.leftLabel}` : ""}`;
}

function Bar({ pr, small }: { pr: Progress; small?: boolean }) {
  if (pr.openEnded) return <div className={`pc-bar open${small ? " sm" : ""}`} aria-hidden="true" />;
  return (
    <div className={`pc-bar${small ? " sm" : ""}`} role="progressbar" aria-valuenow={pr.p} aria-valuemin={0} aria-valuemax={100} aria-label={pr.throughLabel}>
      <span className="pc-bar-fill" style={{ width: `${pr.p}%` }} />
      <span className="pc-bar-knob" style={{ left: `${pr.p}%` }} />
    </div>
  );
}

function Cover({ ph, eager }: { ph: HomePhase; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  // A picture that failed before React was listening: onError never comes.
  useEffect(() => {
    const img = ref.current;
    if (!img?.complete || img.naturalWidth > 0) return;
    const t = setTimeout(() => setFailed(true), 0);
    return () => clearTimeout(t);
  }, []);
  if (!ph.coverUrl || failed) return null;
  // eslint-disable-next-line @next/next/no-img-element -- an upload served by the app's own route, or a public file
  return <img ref={ref} className="pc-cover" src={ph.coverUrl} alt="" draggable={false} loading={eager ? "eager" : "lazy"} onError={() => setFailed(true)} />;
}

// ---- A · carousel ---------------------------------------------------------

function PhaseCardCarousel({ phases, coachName, today, nextSession, food, weekDone, checkInCount }: { phases: HomePhase[]; coachName: string; today: string; nextSession: PhaseNextSession; food: PhaseFoodToday; weekDone: { nextWeekLabel: string } | null; checkInCount: { done: number; total: number } | null }) {
  const goToTab = useNavigateTab();
  const openFood = useOpenFood();
  const openCheckIn = useOpenCheckIn();
  const kcal = (v: number) => Math.round(v).toLocaleString("en-US");
  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  // Which cards have their objectives open: none, on arrival.
  const [openObj, setOpenObj] = useState<number[]>([]);
  const toggleObj = (id: number) => setOpenObj((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  const onScroll = () => {
    const el = scroller.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    setActive(Math.min(phases.length - 1, Math.round(el.scrollLeft / (card.offsetWidth + 12))));
  };
  // A finger swipes it natively. A mouse (the phone preview on a computer)
  // drags it: snapping is off while the mouse moves it, then it settles on
  // the nearest card, and a drag is not taken as a tap on the card.
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !scroller.current) return;
    drag.current = { x: e.clientX, left: scroller.current.scrollLeft, moved: false };
    dragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    const el = scroller.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 5) return;
    if (!d.moved) {
      d.moved = true;
      el.setPointerCapture(e.pointerId);
      el.style.scrollSnapType = "none";
    }
    el.scrollLeft = d.left - dx;
  };
  const onPointerUp = () => {
    const d = drag.current;
    const el = scroller.current;
    drag.current = null;
    if (!d?.moved || !el) return;
    dragged.current = true;
    const card = el.firstElementChild as HTMLElement | null;
    const step = (card?.offsetWidth ?? 300) + 12;
    const i = Math.max(0, Math.min(phases.length - 1, Math.round(el.scrollLeft / step)));
    el.scrollTo({ left: i * step, behavior: "smooth" });
    setTimeout(() => {
      el.style.scrollSnapType = "";
    }, 450);
  };
  const open = (ph: HomePhase) => {
    // The end of a mouse drag, not a tap.
    if (dragged.current) {
      dragged.current = false;
      return;
    }
    const tab = TRACK_TAB[ph.track];
    if (tab) goToTab?.(tab);
  };
  return (
    <>
      <div ref={scroller} className="pc-scroller" role="region" aria-label="Your phases" tabIndex={0} onScroll={onScroll} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {phases.map((ph, i) => {
          const pr = progressOf(ph, today, coachName);
          const objOpen = openObj.includes(ph.id);
          const tab = TRACK_TAB[ph.track];
          return (
            <article
              key={ph.id}
              className={`pc-card${tab ? " link" : ""}`}
              data-track={ph.track}
              aria-label={cardLabel(ph, pr)}
              onClick={() => open(ph)}
            >
              <Cover ph={ph} eager={i === 0} />
              <span className="pc-scrim" aria-hidden="true" />
              <div className="pc-top">
                <span className="pc-track-chip">
                  <span className="pc-icon">{TRACK_ICON[ph.track]}</span>
                  {TRACK_LABEL[ph.track]}
                </span>
                <span className="pc-week-chip">{pr.weekLabel}</span>
              </div>
              <div className="pc-panel">
                <h3 className="pc-name-h">
                  <FitTitle className="pc-name" min={16}>
                    {ph.name}
                  </FitTitle>
                </h3>
                {/* How long is left, the bar, and the first and last day under it. */}
                <div className="pc-progress">
                  <div className="pc-progress-row">
                    <span className={`pc-left${pr.overdue ? " overdue" : ""}`}>{pr.leftLabel ?? pr.throughLabel}</span>
                  </div>
                  <Bar pr={pr} />
                  {ph.end && (
                    <div className="pc-ends">
                      <span>{short(ph.start)}</span>
                      <span>{short(ph.end)}</span>
                    </div>
                  )}
                </div>
                {/* Each track's one thing to do now: training opens the next
                    session (Start session is pressed there), nutrition opens today's food
                    diary, lifestyle opens the check-in. */}
                {ph.track === "training" && nextSession && (
                  <ActionRow
                    label={nextSession.live ? "In progress" : "Up next"}
                    name={nextSession.name}
                    action={nextSession.live ? "Resume" : "Start"}
                    onClick={() => goToTab?.("training", nextSession.dayId)}
                  />
                )}
                {ph.track === "training" && !nextSession && weekDone && (
                  <ActionRow label="Week done" name={`Next week starts ${weekDone.nextWeekLabel}`} action="View" onClick={() => goToTab?.("training")} />
                )}
                {ph.track === "nutrition" && (
                  <ActionRow
                    label="Today"
                    name={food?.target ? `${kcal(food.target)} kcal` : "Your food diary"}
                    action="Log"
                    onClick={() => (openFood ? openFood() : goToTab?.("nutrition"))}
                  />
                )}
                {ph.track === "lifestyle" && openCheckIn && (
                  <ActionRow
                    label="Check-in"
                    name={checkInCount ? (checkInCount.done >= checkInCount.total ? "All logged" : `${checkInCount.done} of ${checkInCount.total} logged`) : "Today's check-in"}
                    action="Check in"
                    onClick={() => openCheckIn("daily")}
                  />
                )}
                {/* The coach's objectives, folded to one row so every card
                    opens the same size, whatever the coach has set. */}
                {ph.objectives.length > 0 && (
                  <div className="pc-obj">
                    <button
                      type="button"
                      className="pc-obj-toggle"
                      aria-expanded={objOpen}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleObj(ph.id);
                      }}
                    >
                      <span className="pc-obj-label">Objectives from {coachName}</span>
                      <span className={`pc-obj-chev${objOpen ? " open" : ""}`} aria-hidden="true">
                        <ChevronDownIcon />
                      </span>
                    </button>
                    {/* Always there, its height eased open: the panel grows
                        upwards smoothly and the list fades in under the row. */}
                    <div className={`pc-obj-body${objOpen ? " open" : ""}`} aria-hidden={!objOpen}>
                      <div className="pc-obj-clip">
                        <ol className="pc-obj-list">
                          {ph.objectives.slice(0, 3).map((o, j) => (
                            <li key={j}>
                              <span className="pc-obj-n">{j + 1}</span>
                              <span className="pc-obj-text">{o}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {phases.length > 1 && (
        <div className="pc-dots" aria-hidden="true">
          {phases.map((ph, i) => (
            <span key={ph.id} className={`pc-dot${i === active ? " on" : ""}`} data-track={ph.track} />
          ))}
        </div>
      )}
    </>
  );
}

// A card's one thing to do: what it is on the left, a small white button on
// the right. Its own tap only: the card around it opens the tab.
function ActionRow({ label, name, action, onClick }: { label: string; name: string; action: string; onClick: () => void }) {
  return (
    <div className="pc-next">
      <span className="pc-next-text">
        <span className="pc-next-label">{label}</span>
        <span className="pc-next-name">{name}</span>
      </span>
      <button
        type="button"
        className="pc-start"
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        {action}
      </button>
    </div>
  );
}

// ---- B · stack ------------------------------------------------------------

const openKey = (id: number) => `ironline:phase-open:${id}`;

function PhaseCardStack({ ph, coachName, today, defaultOpen }: { ph: HomePhase; coachName: string; today: string; defaultOpen: boolean }) {
  const goToTab = useNavigateTab();
  const [open, setOpen] = useState(defaultOpen);
  // What was left open or shut this visit, once on the phone.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const v = window.sessionStorage.getItem(openKey(ph.id));
        if (v != null) setOpen(v === "1");
      } catch {}
    }, 0);
    return () => clearTimeout(t);
  }, [ph.id]);
  const toggle = () => {
    setOpen((o) => {
      try {
        window.sessionStorage.setItem(openKey(ph.id), o ? "0" : "1");
      } catch {}
      return !o;
    });
  };
  const pr = progressOf(ph, today, coachName);
  const tab = TRACK_TAB[ph.track];
  const bodyId = `ph-body-${ph.id}`;
  return (
    <article className="pc-scard" data-track={ph.track} aria-label={cardLabel(ph, pr)}>
      <button type="button" className="pc-shead" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
        <span className="pc-thumb">
          <Cover ph={ph} />
          <span className="pc-icon">{TRACK_ICON[ph.track]}</span>
        </span>
        <span className="pc-scol">
          <span className="pc-srow">
            <span className="pc-strack">{TRACK_LABEL[ph.track]}</span>
            <span className="pc-sweek">
              {pr.weekLabel}
              <span className={`pc-chev${open ? " open" : ""}`}>
                <ChevronDownIcon />
              </span>
            </span>
          </span>
          <span className="pc-sname">{ph.name}</span>
          <Bar pr={pr} small />
          <span className="pc-srow">
            <span className="pc-sdates">{ph.end ? `${short(ph.start)} – ${short(ph.end)}` : `Started ${short(ph.start)}`}</span>
            {pr.leftLabel && <span className={`pc-left${pr.overdue ? " overdue" : ""}`}>{pr.leftLabel}</span>}
          </span>
        </span>
      </button>
      <div id={bodyId} className={`pc-sbody-wrap${open ? " open" : ""}`}>
        <div className="pc-sbody-clip">
          <div className="pc-sbody">
            {ph.objectives.length > 0 && (
              <>
                <span className="pc-obj-label">Objectives from {coachName}</span>
                <ol className="pc-obj-list">
                  {ph.objectives.map((o, j) => (
                    <li key={j}>
                      <span className="pc-obj-n">{j + 1}</span>
                      <span className="pc-obj-text">{o}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
            {ph.note && <p className="pc-snote">&ldquo;{ph.note}&rdquo;</p>}
            {tab && (
              <button type="button" className="pc-sopen" onClick={() => goToTab?.(tab)}>
                Open {TRACK_LABEL[ph.track].toLowerCase()} →
              </button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
