"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { groupColour } from "../../lib/muscleGroups";
import { useKeyboardInset } from "../useKeyboardInset";

// "Swap exercise" (14 Oct, after the New event and gym pop-ups): a centred
// pop-up, not a sheet. The machine is taken: the client picks one of the
// coach's suggestions (the session's own, else the library's substitutes,
// ranked), or writes what they did, for today only. The glow and pill take
// the exercise's muscle-group colour. A thumb plays the demo without picking
// the row. The workout keeps running behind it.

export type SwapSuggestion = { id: number; name: string; note: string | null; video: string | null };
export type SwapChoice = { libraryExerciseId: number | null; customName: string | null };

const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
const isUpload = (url: string) => url.startsWith("/uploads/") || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);

export default function SwapExerciseDialog({
  exercise,
  targets,
  suggestions,
  current,
  coach,
  photoSent = false,
  onSwap,
  onPhoto,
  onClose,
}: {
  exercise: { name: string; group: string };
  targets: { sets: number; reps: string; rpe: number | null; time: string | null };
  /** In the coach's order; none, and the field is the only choice. */
  suggestions: SwapSuggestion[];
  /** The swap in place, when the pop-up is opened again. */
  current: { libraryExerciseId: number | null; name: string } | null;
  coach: { firstName: string; photo: string | null };
  /** A photo of the machine already went to the coach. */
  photoSent?: boolean;
  onSwap: (choice: SwapChoice) => void;
  /** A photo of the machine, through the existing photo flow. Absent: no link. */
  onPhoto?: () => void;
  onClose: () => void;
}) {
  const c = groupColour(exercise.group);
  const list = suggestions;
  const currentPick = current?.libraryExerciseId != null && list.some((s) => s.id === current.libraryExerciseId) ? current.libraryExerciseId : null;
  const [picked, setPicked] = useState<number | null>(currentPick ?? (current ? null : list[0]?.id ?? null));
  const [own, setOwn] = useState(current && current.libraryExerciseId == null ? current.name : "");
  const [ownOn, setOwnOn] = useState(picked == null);
  const [lightbox, setLightbox] = useState<SwapSuggestion | null>(null);
  const [closing, setClosing] = useState(false);
  const kb = useKeyboardInset();
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
  }, []);
  const close = () => {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 180);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (lightbox ? setLightbox(null) : close());
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- close is stable enough for a key handler
  }, [lightbox]);
  const chosen = ownOn ? (own.trim() ? { name: own.trim(), id: null as number | null } : null) : list.find((s) => s.id === picked) ? { name: list.find((s) => s.id === picked)!.name, id: picked } : null;
  const keeping = !!current && !!chosen && (chosen.id != null ? chosen.id === current.libraryExerciseId : current.libraryExerciseId == null && chosen.name === current.name);
  const label = !chosen ? "Pick or write one" : keeping ? `Keep ${chosen.name}` : `Swap for ${chosen.name}`;
  const go = () => {
    if (!chosen) return;
    if (keeping) {
      close();
      return;
    }
    setClosing(true);
    setTimeout(() => onSwap(chosen.id != null ? { libraryExerciseId: chosen.id, customName: null } : { libraryExerciseId: null, customName: chosen.name }), 180);
  };
  const targetLine = useMemo(() => {
    const parts = [`${targets.sets} × ${targets.time ? targets.time : targets.reps || "—"}`];
    if (targets.rpe != null && !targets.time) parts.push(`RPE ${targets.rpe}`);
    return parts.join(" · ");
  }, [targets]);

  return createPortal(
    <div className={`sw-overlay${closing ? " closing" : ""}`} role="presentation" onClick={close}>
      <div className={`sw-card${closing ? " closing" : ""}${kb ? " kb" : ""}`} style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties} role="dialog" aria-modal="true" aria-label={`Swap ${exercise.name}`} onClick={(e) => e.stopPropagation()}>
        <span className="sw-glow" aria-hidden="true" />
        <span className="sw-wash" aria-hidden="true" />
        <div className="sw-in">
          <header className="sw-head">
            <div className="sw-head-text">
              <div className="sw-title-row">
                <h2 className="sw-title">Swap exercise</h2>
              </div>
              {/* No muscle-group chip and no explanation line (17 Oct, Alex): the title and the choices say enough. */}
            </div>
            <button ref={first} type="button" className="sw-close" onClick={close} aria-label="Close">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </header>

          <div className="sw-targets">
            <span className="sw-targets-label">Targets carry over</span>
            <span className="sw-targets-val">{targetLine}</span>
          </div>

          {list.length > 0 && (
            <div className="sw-block">
              <span className="sw-label">
                <span className="sw-avatar" aria-hidden="true">
                  {coach.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the coach's upload
                    <img src={coach.photo} alt="" />
                  ) : (
                    coach.firstName.slice(0, 1).toUpperCase()
                  )}
                </span>
                Suggested by {coach.firstName}
              </span>
              <div className="sw-rows" role="radiogroup" aria-label={`Suggested by ${coach.firstName}`}>
                {list.map((s) => {
                  const on = !ownOn && picked === s.id;
                  return (
                    <div
                      key={s.id}
                      role="radio"
                      aria-checked={on}
                      tabIndex={0}
                      className={`sw-row${on ? " on" : ""}`}
                      onClick={() => {
                        setPicked(s.id);
                        setOwnOn(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setPicked(s.id);
                          setOwnOn(false);
                        }
                      }}
                    >
                      {s.video ? (
                        <button
                          type="button"
                          className="sw-thumb"
                          aria-label={`Play demo of ${s.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setLightbox(s);
                          }}
                        >
                          <Poster url={s.video} />
                          <span className="sw-playdisc" aria-hidden="true">
                            <svg viewBox="0 0 24 24">
                              <path d="M8 5.5v13l11-6.5z" />
                            </svg>
                          </span>
                        </button>
                      ) : (
                        <span className="sw-thumb none" aria-hidden="true">
                          No demo
                        </span>
                      )}
                      <span className="sw-text">
                        <span className="sw-name">{s.name}</span>
                        <span className={`sw-note${s.note ? "" : " none"}`}>{s.note ? `“${s.note}”` : "No note"}</span>
                      </span>
                      <span className="sw-check" aria-hidden="true">
                        {on && (
                          <svg viewBox="0 0 24 24">
                            <path d="m5 12.5 4.5 4.5L19 7.5" />
                          </svg>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="sw-block">
            <span className="sw-label">{list.length ? "Or write what you did" : "What did you do instead?"}</span>
            <label className={`sw-field${ownOn ? " on" : ""}`}>
              <input
                value={own}
                maxLength={60}
                placeholder="e.g. Neutral-grip pulldown"
                enterKeyHint="done"
                autoComplete="off"
                aria-label="What you did instead"
                onFocus={() => setOwnOn(true)}
                onChange={(e) => {
                  setOwn(e.target.value);
                  setOwnOn(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.currentTarget.blur();
                    go();
                  }
                }}
              />
            </label>
          </div>

          <div className="sw-actions">
            <button type="button" className={`sw-primary${chosen ? "" : " off"}`} aria-disabled={!chosen} aria-label={label} onClick={go}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />
              </svg>
              <span>{label}</span>
            </button>
            {/* No photo-of-the-machine link here (17 Oct, Alex): the exercise's camera already does it. */}
          </div>
        </div>
      </div>
      {lightbox && lightbox.video && (
        <div className="sw-lightbox" role="dialog" aria-label={`${lightbox.name} demo`} onClick={(e) => (e.stopPropagation(), setLightbox(null))}>
          <button type="button" className="sw-lightbox-x" aria-label="Close the demo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
          <span className="sw-lightbox-name">{lightbox.name}</span>
          {isUpload(lightbox.video) ? (
            <video src={lightbox.video} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
          ) : ytId(lightbox.video) ? (
            <iframe src={`https://www.youtube.com/embed/${ytId(lightbox.video)}?autoplay=1&playsinline=1`} title={`${lightbox.name} demo`} allow="autoplay; fullscreen" allowFullScreen onClick={(e) => e.stopPropagation()} />
          ) : (
            <a href={lightbox.video} target="_blank" rel="noreferrer" className="sw-lightbox-link" onClick={(e) => e.stopPropagation()}>
              Open the demo
            </a>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}

function Poster({ url }: { url: string }) {
  const id = ytId(url);
  if (id)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
      <img className="sw-poster" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
    );
  if (isUpload(url)) return <video className="sw-poster" src={`${url}#t=0.5`} preload="metadata" muted playsInline draggable={false} />;
  return <span className="sw-poster" aria-hidden="true" />;
}

const GROUP_LABELS: Record<string, string> = { back: "Back", chest: "Chest", legs: "Legs", arms: "Arms", abs: "Abs", shoulders: "Shoulders", core: "Core", glutes: "Glutes", cardio: "Cardio", other: "Other" };
const groupLabel = (slug: string) => GROUP_LABELS[slug] ?? (slug ? slug.slice(0, 1).toUpperCase() + slug.slice(1) : "Other");
