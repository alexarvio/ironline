"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { LibraryPick } from "../workoutShared";
import { createPortal } from "react-dom";
import { groupColour } from "../../lib/muscleGroups";
import { pic } from "../../lib/pic";
import { Bars } from "../Bars";
import RingEdge from "../../components/RingEdge";

// "Swap exercise" (14 Oct, after the New event and gym pop-ups): a centred
// pop-up, not a sheet. The machine is taken: the client picks one of the
// coach's suggestions (the session's own, else the library's substitutes,
// ranked), or writes what they did, for today only. The glow and pill take
// the exercise's muscle-group colour. A thumb plays the demo without picking
// the row. The workout keeps running behind it.

export type SwapSuggestion = { id: number; name: string; note: string | null; video: string | null };
/** A library pick carries its name in customName too, so a cardio's swap (named by its alternatives' place) reads it. */
export type SwapChoice = { libraryExerciseId: number | null; customName: string | null };

/** The coach's library, given by the workout screen (13 Nov, Alex: the field searches it as the client types). */
export const SwapLibrary = createContext<LibraryPick[]>([]);

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
  const library = useContext(SwapLibrary);
  const inList = currentPick != null;
  const [own, setOwn] = useState(current && !inList ? current.name : "");
  // The library exercise the field holds, when it was picked from the list (13 Nov, Alex).
  const [ownLib, setOwnLib] = useState<number | null>(current && !inList ? current.libraryExerciseId : null);
  const [listOpen, setListOpen] = useState(false);
  const [ownOn, setOwnOn] = useState(picked == null);
  const needle = own.trim().toLowerCase();
  const cardio = exercise.group === "cardio";
  const matches = useMemo(() => {
    if (!needle) return [];
    const self = exercise.name.toLowerCase();
    return library
      .filter((e) => (e.group === "cardio") === cardio && e.name.toLowerCase() !== self && e.name.toLowerCase().includes(needle))
      .sort((a, b) => Number(!a.name.toLowerCase().startsWith(needle)) - Number(!b.name.toLowerCase().startsWith(needle)) || a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [library, needle, cardio, exercise.name]);
  const [lightbox, setLightbox] = useState<SwapSuggestion | null>(null);
  const [closing, setClosing] = useState(false);
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
  const chosen: { name: string; id: number | null; lib: boolean } | null = ownOn
    ? own.trim()
      ? { name: own.trim(), id: ownLib, lib: ownLib != null }
      : null
    : list.find((s) => s.id === picked)
      ? { name: list.find((s) => s.id === picked)!.name, id: picked, lib: false }
      : null;
  const keeping = !!current && !!chosen && (chosen.id != null ? chosen.id === current.libraryExerciseId : current.libraryExerciseId == null && chosen.name === current.name);
  const label = !chosen ? "Pick or write one" : keeping ? `Keep ${chosen.name}` : `Swap for ${chosen.name}`;
  const go = () => {
    if (!chosen) return;
    if (keeping) {
      close();
      return;
    }
    setClosing(true);
    setTimeout(
      () =>
        onSwap(
          chosen.lib ? { libraryExerciseId: chosen.id, customName: chosen.name } : chosen.id != null ? { libraryExerciseId: chosen.id, customName: null } : { libraryExerciseId: null, customName: chosen.name }
        ),
      180
    );
  };
  const targetLine = useMemo(() => {
    const parts = [`${targets.sets} × ${targets.time ? targets.time : targets.reps || "—"}`];
    if (targets.rpe != null && !targets.time) parts.push(`RPE ${targets.rpe}`);
    return parts;
  }, [targets]);

  return createPortal(
    <div className={`sw-overlay${closing ? " closing" : ""}`} role="presentation" onClick={close}>
      <div className={`sw-card${closing ? " closing" : ""}`} style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties} role="dialog" aria-modal="true" aria-label={`Swap ${exercise.name}`} onClick={(e) => e.stopPropagation()}>
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
              <RingEdge size={32} />
            </button>
          </header>

          <div className="sw-targets">
            <span className="sw-targets-label">Targets carry over</span>
            <span className="sw-targets-val"><Bars parts={targetLine} /></span>
          </div>

          {list.length > 0 && (
            <div className="sw-block">
              <span className="sw-label">
                <span className="sw-avatar" aria-hidden="true">
                  {coach.photo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the coach's upload
                    <img src={pic(coach.photo, 96)} alt="" />
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
                            <RingEdge size={24} />
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
                        {on ? (
                          <svg viewBox="0 0 24 24">
                            <path d="m5 12.5 4.5 4.5L19 7.5" />
                          </svg>
                        ) : (
                          <RingEdge size={24} />
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
              {/* No sample in it (13 Nov, Alex: no "e.g."): the library comes up under it as the name is typed. */}
              <input
                value={own}
                maxLength={60}
                enterKeyHint="done"
                autoComplete="off"
                role="combobox"
                aria-expanded={listOpen && matches.length > 0}
                aria-controls="sw-lib"
                aria-label="What you did instead"
                onFocus={() => {
                  setOwnOn(true);
                  setListOpen(true);
                }}
                onChange={(e) => {
                  setOwn(e.target.value);
                  setOwnLib(null);
                  setOwnOn(true);
                  setListOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // The name typed in full is that library exercise.
                    const exact = matches.find((m) => m.name.toLowerCase() === needle);
                    if (exact && ownLib == null) {
                      setOwn(exact.name);
                      setOwnLib(exact.id);
                      setListOpen(false);
                      return;
                    }
                    e.currentTarget.blur();
                    go();
                  }
                }}
              />
            </label>
            {listOpen && ownLib == null && matches.length > 0 && (
              // The library as it is typed, its group grey on the right, as the admin's search (13 Nov, Alex).
              <div className="sw-lib" id="sw-lib" role="listbox" aria-label="From the library">
                {matches.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="option"
                    aria-selected={false}
                    className="sw-lib-row"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setOwn(m.name);
                      setOwnLib(m.id);
                      setOwnOn(true);
                      setListOpen(false);
                    }}
                  >
                    <span className="sw-lib-name">{m.name}</span>
                    <span className="sw-lib-group">{groupLabel(m.group)}</span>
                  </button>
                ))}
              </div>
            )}
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
