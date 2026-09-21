"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { MessageLink } from "../lib/messageLinks";
import type { LinkTargets } from "../lib/queries";
import { placePopover, type Placement } from "../components/popover";

export type PickedLink = { link: MessageLink; label: string };

const WIDTH = 340;
type Area = "Training" | "Nutrition" | "Measurements";

// "Link to…" beside the message box: point the message at one thing in the
// client's app, which they can then tap straight through to. Three areas,
// the same the coach comments on — training (a session, or one exercise in
// it), nutrition (their targets, a day of their food diary) and measurements
// (the check-ins, their progress pictures). Only what the client can open is
// offered: the live programme's weeks up to this one, food diary days from
// the last two weeks.
export default function MessageLinkPicker({ targets, onPick }: { targets: LinkTargets; onPick: (p: PickedLink) => void }) {
  const [open, setOpen] = useState(false);
  const [area, setArea] = useState<Area>("Training");
  const [weekAt, setWeekAt] = useState(0);
  const [pos, setPos] = useState<Placement | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !btn.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const pick = (p: PickedLink) => {
    onPick(p);
    setOpen(false);
  };

  const week = targets.training[weekAt] ?? null;
  const nothing = { Training: targets.training.length === 0, Nutrition: !targets.nutrition && targets.foodDays.length === 0, Measurements: targets.checkins.length === 0 && !targets.photos };

  return (
    <>
      <button
        ref={btn}
        type="button"
        className={`msg-link-btn${open ? " on" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (!open) setPos(placePopover(btn.current, { width: WIDTH, maxHeight: 460, minHeight: 200 }));
          setOpen((o) => !o);
        }}
      >
        <LinkIcon />
        Link to…
      </button>

      {open &&
        createPortal(
          <div ref={panel} className="msg-link-pop" role="dialog" aria-label="Link the message to" style={{ ...(pos ?? {}), width: WIDTH }}>
            <div className="msg-link-tabs" role="tablist">
              {(["Training", "Nutrition", "Measurements"] as Area[]).map((a) => (
                <button key={a} type="button" role="tab" aria-selected={area === a} className={area === a ? "on" : undefined} onClick={() => setArea(a)}>
                  {a}
                </button>
              ))}
            </div>

            <div className="msg-link-list">
              {area === "Training" &&
                (nothing.Training ? (
                  <p className="msg-link-empty">No live programme to link to yet.</p>
                ) : (
                  week && (
                    <>
                      {/* Newest week first; the arrows walk back through the weeks the client has had. */}
                      <div className="msg-link-week">
                        <button type="button" onClick={() => setWeekAt((i) => Math.min(targets.training.length - 1, i + 1))} disabled={weekAt >= targets.training.length - 1} aria-label="Earlier week">
                          ‹
                        </button>
                        <b>{week.label}</b>
                        <button type="button" onClick={() => setWeekAt((i) => Math.max(0, i - 1))} disabled={weekAt === 0} aria-label="Later week">
                          ›
                        </button>
                      </div>
                      {week.sessions.map((s) => (
                        <div key={s.dayId} className="msg-link-group">
                          <button type="button" className="msg-link-row head" onClick={() => pick({ link: { kind: "session", dayId: s.dayId }, label: `${s.title}, ${week.label}` })}>
                            {s.title}
                            <small>whole session</small>
                          </button>
                          {s.exercises.map((e) => (
                            <button
                              key={e.assignmentId}
                              type="button"
                              className="msg-link-row sub"
                              onClick={() => pick({ link: { kind: "exercise", dayId: s.dayId, assignmentId: e.assignmentId }, label: `${e.name} · ${s.title}, ${week.label}` })}
                            >
                              {e.name}
                            </button>
                          ))}
                        </div>
                      ))}
                    </>
                  )
                ))}

              {area === "Nutrition" &&
                (nothing.Nutrition ? (
                  <p className="msg-link-empty">No nutrition targets or logged food to link to yet.</p>
                ) : (
                  <>
                    {targets.nutrition && (
                      <button type="button" className="msg-link-row head" onClick={() => pick({ link: { kind: "nutrition" }, label: "Nutrition targets" })}>
                        Nutrition targets
                      </button>
                    )}
                    {targets.foodDays.length > 0 && <div className="msg-link-label">Food diary</div>}
                    {targets.foodDays.map((d) => (
                      <button key={d.date} type="button" className="msg-link-row sub" onClick={() => pick({ link: { kind: "food", date: d.date }, label: `Food diary · ${d.label}` })}>
                        {d.label}
                      </button>
                    ))}
                  </>
                ))}

              {area === "Measurements" &&
                (nothing.Measurements ? (
                  <p className="msg-link-empty">No check-ins or progress pictures set up yet.</p>
                ) : (
                  <>
                    {targets.checkins.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="msg-link-row head"
                        onClick={() => pick({ link: { kind: "checkin", section: c }, label: c === "daily" ? "Daily check-in" : "Weekly check-in" })}
                      >
                        {c === "daily" ? "Daily check-in" : "Weekly check-in"}
                      </button>
                    ))}
                    {targets.photos && (
                      <button type="button" className="msg-link-row head" onClick={() => pick({ link: { kind: "photos" }, label: "Progress pictures" })}>
                        Progress pictures
                      </button>
                    )}
                  </>
                ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export function LinkIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}
