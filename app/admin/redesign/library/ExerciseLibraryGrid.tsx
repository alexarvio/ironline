"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { ChevronDownIcon, PencilIcon, PlayIcon, SearchIcon } from "../../../components/icons";
import { assignVideoToExerciseAction, uploadLibraryVideoAction } from "./actions";
import type { LibraryItem } from "./load";
import { useLibraryView, type LibraryFilter } from "./useLibraryView";

// Library → Exercises as a card grid (14 Oct): one block a muscle group,
// folded to a row with its colour, count and demo coverage; open, a grid
// of large cards, each its demo big enough to recognise (a hover plays it
// muted), the name, the cue, and chips for its variations and substitutes.
// "New in {Group}" sits last. The same for Cardio, as one block.

const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
const isUpload = (url: string) => url.startsWith("/uploads/") || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(url);
const providerOf = (url: string) => (/youtu\.?be/i.test(url) ? "YouTube" : /vimeo/i.test(url) ? "Vimeo" : "Link");
const fmtDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const FALLBACKS = ["linear-gradient(150deg,#55648a,#1a2030)", "linear-gradient(150deg,#4a6b7a,#162028)", "linear-gradient(150deg,#665a7d,#1c1828)", "linear-gradient(150deg,#5a6f5f,#18221c)"];
const NAVY = { color: "#1d3466", rgb: "29,52,102" };
const FILTERS: { id: LibraryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "nodemo", label: "No demo" },
  { id: "variations", label: "Has variations" },
  { id: "substitutes", label: "Has substitutes" },
];

export default function ExerciseLibraryGrid({
  items,
  groups,
  cardio = false,
  removedShown,
  removedCount,
  onToggleRemoved,
  onOpen,
  onNew,
  onArchive,
  onChanged,
  editingId = null,
}: {
  /** The exercise open in the drawer (14 Oct): its card is ringed. */
  editingId?: number | null;
  /** The shelf's exercises, the taken-out ones included when the coach asked for them. */
  items: LibraryItem[];
  groups: { slug: string; label: string }[];
  /** The Cardio shelf: one block. */
  cardio?: boolean;
  removedShown: boolean;
  removedCount: number;
  onToggleRemoved: () => void;
  onOpen: (id: number) => void;
  onNew: (groupSlug: string) => void;
  onArchive: (item: LibraryItem) => void;
  onChanged: () => void;
}) {
  const blocks = cardio ? [{ slug: "cardio", label: "Cardio" }] : groups;
  const view = useLibraryView(blocks[0]?.slug ?? null);
  const { needle, filter, settings } = view;

  const matches = (i: LibraryItem) => !needle || i.name.toLowerCase().includes(needle) || i.cue.toLowerCase().includes(needle);
  const passes = (i: LibraryItem) => filter === "all" || (filter === "nodemo" ? !i.video : filter === "variations" ? i.variations.length > 0 : i.substitutes.length > 0);
  const searched = items.filter(matches);
  const counts = {
    all: searched.length,
    nodemo: searched.filter((i) => !i.video).length,
    variations: searched.filter((i) => i.variations.length > 0).length,
    substitutes: searched.filter((i) => i.substitutes.length > 0).length,
  };
  const filtering = !!needle || filter !== "all";
  const anyMatch = searched.filter(passes).length > 0;

  // The lightbox: a demo with sound.
  const [playing, setPlaying] = useState<LibraryItem | null>(null);
  useEffect(() => {
    if (!playing) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPlaying(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [playing]);

  return (
    <div className="lib">
      <div className="lib-toolbar">
        <label className="lib-search">
          <SearchIcon />
          <input value={view.q} onChange={(e) => view.setQ(e.target.value)} placeholder={cardio ? "Search movements or cues" : "Search exercises or cues"} aria-label="Search the library" />
        </label>
        <div className="lib-chips" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`lib-chip${filter === f.id ? " on" : ""}`} aria-pressed={filter === f.id} onClick={() => view.setFilter(f.id)}>
              {f.label}
              <span className="lib-chip-n">{counts[f.id]}</span>
            </button>
          ))}
          {removedCount > 0 && (
            <button type="button" className={`lib-chip${removedShown ? " on" : ""}`} aria-pressed={removedShown} onClick={onToggleRemoved}>
              Taken out
              <span className="lib-chip-n">{removedCount}</span>
            </button>
          )}
        </div>
        {/* View (14 Oct, Alex): the cards bigger or smaller, nothing else. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="lib-view" aria-label="View: card size">
              View <ChevronDownIcon />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => view.setSettings({ density: "comfortable" })}>{settings.density === "comfortable" ? "✓ " : ""}Bigger cards</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => view.setSettings({ density: "compact" })}>{settings.density === "compact" ? "✓ " : ""}Smaller cards</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {needle && !anyMatch && (
        <div className="lib-none">
          <p>No {cardio ? "movements" : "exercises"} match &ldquo;{view.q.trim()}&rdquo;</p>
          <button type="button" className="lib-create" onClick={() => onNew(cardio ? "cardio" : blocks[0]?.slug ?? "other")}>
            Create &ldquo;{view.q.trim()}&rdquo;
          </button>
        </div>
      )}

      {blocks.map((g) => {
        // No colour coding on the page for now (14 Oct, Alex): every group in navy.
        const c = NAVY;
        const all = items.filter((i) => i.group === g.slug);
        const alive = all.filter((i) => !i.archived);
        const shown = all.filter((i) => matches(i) && passes(i)).sort((a, b) => a.name.localeCompare(b.name));
        const isOpen = needle ? shown.length > 0 : view.open.includes(g.slug);
        const noun = cardio ? "movement" : "exercise";
        return (
          <section key={g.slug} className={`lib-group${isOpen ? " open" : ""}`} style={{ "--c": c.color, "--rgb": c.rgb } as React.CSSProperties}>
            <span className="lib-strip" aria-hidden="true" />
            <button type="button" className="lib-group-head" aria-expanded={isOpen} aria-controls={`lib-grid-${g.slug}`} onClick={() => view.toggle(g.slug)}>
              <span className="lib-chev" aria-hidden="true">
                <ChevronDownIcon />
              </span>
              <span className="lib-group-name">{g.label}</span>
              <span className="lib-group-count">
                {filtering ? `${shown.length} of ${alive.length}` : `${alive.length} ${alive.length === 1 ? noun : `${noun}s`}`}
                {needle && shown.length === 0 ? " · 0 matches" : ""}
              </span>
            </button>
            {isOpen && (
              <div id={`lib-grid-${g.slug}`} role="region" aria-label={`${g.label} ${noun}s`} className={`lib-grid${settings.density === "compact" ? " compact" : ""}`}>
                {shown.map((i, k) => (
                  <ExerciseCard key={i.id} item={i} index={k} colour={c} thumbs={settings.thumbs} showCue={settings.cues} editing={i.id === editingId} onOpen={() => onOpen(i.id)} onPlay={() => setPlaying(i)} onArchive={() => onArchive(i)} onChanged={onChanged} />
                ))}
                <button type="button" className="lib-new" onClick={() => onNew(g.slug)}>
                  <span className="lib-new-plus" aria-hidden="true">
                    +
                  </span>
                  New in {g.label}
                </button>
                {filtering && shown.length === 0 && alive.length > 0 && <p className="lib-nomatch">Nothing matches this filter in {g.label}.</p>}
              </div>
            )}
          </section>
        );
      })}

      {playing &&
        playing.video &&
        createPortal(
          <div className="exm-lightbox" role="dialog" aria-label={`${playing.name} demo`} onClick={() => setPlaying(null)}>
            <div className="exm-lightbox-card" onClick={(e) => e.stopPropagation()}>
              {isUpload(playing.video) ? (
                <video src={playing.video} controls autoPlay playsInline />
              ) : ytId(playing.video) ? (
                <iframe className="lib-embed" src={`https://www.youtube.com/embed/${ytId(playing.video)}?autoplay=1`} title={`${playing.name} demo`} allow="autoplay; fullscreen" allowFullScreen />
              ) : (
                <a href={playing.video} target="_blank" rel="noreferrer" className="exm-upload-btn">
                  Open the demo
                </a>
              )}
              <div className="exm-lightbox-row">
                <span className="exm-lightbox-text">
                  <b>{playing.name}</b>
                </span>
                <button type="button" className="exm-close" onClick={() => setPlaying(null)} aria-label="Close">
                  ✕
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function ExerciseCard({
  item,
  index,
  colour,
  thumbs,
  showCue,
  editing = false,
  onOpen,
  onPlay,
  onArchive,
  onChanged,
}: {
  editing?: boolean;
  item: LibraryItem;
  index: number;
  colour: { color: string; rgb: string };
  thumbs: "portrait" | "landscape";
  showCue: boolean;
  onOpen: () => void;
  onPlay: () => void;
  onArchive: () => void;
  onChanged: () => void;
}) {
  const v = item.video;
  const upload = !!v && isUpload(v);
  const [seconds, setSeconds] = useState<number | null>(null);
  // A hover of 400ms plays the clip muted in the thumb; a focus of 600ms too (keyboard).
  const [preview, setPreview] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const arm = (ms: number) => {
    if (!upload || reduced) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setPreview(true), ms);
  };
  const disarm = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPreview(false);
  };
  useEffect(() => () => disarm(), []);
  // A video file dropped on the thumb becomes the demo.
  const [over, setOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const drop = async (file: File | undefined) => {
    if (!file || !file.type.startsWith("video/") || uploading) return;
    setUploading(true);
    const f = new FormData();
    f.set("file", file);
    const r = await uploadLibraryVideoAction(f).catch(() => ({ ok: false as const, error: `${file.name} didn't upload.` }));
    if (r.ok) {
      await assignVideoToExerciseAction(item.id, r.id);
      toast.success(`${file.name} is now the demo on ${item.name}`);
      onChanged();
    } else toast.error(r.error);
    setUploading(false);
  };
  const demoState = !v ? "no demo" : upload ? "video demo" : `${providerOf(v)} demo`;
  const varNames = item.variations.map((x) => x.name).join(", ");
  const subNames = item.substitutes.map((x) => x.name).join(", ");
  return (
    <div
      className={`lib-card${item.archived ? " archived" : ""}${editing ? " editing" : ""}`}
      data-exercise-id={item.id}
      role="button"
      tabIndex={0}
      aria-label={`${item.name}. ${demoState}. ${item.variations.length} variations, ${item.substitutes.length} substitutes. Edit.`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      onMouseEnter={() => arm(400)}
      onMouseLeave={disarm}
      onFocus={() => arm(600)}
      onBlur={disarm}
    >
      <div
        className={`lib-thumb ${thumbs}${v ? "" : " empty"}${over ? " over" : ""}`}
        style={!v || upload ? { background: FALLBACKS[index % FALLBACKS.length] } : undefined}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          e.stopPropagation();
          setOver(false);
          void drop(e.dataTransfer.files[0]);
        }}
      >
        {v && upload && (
          <>
            {preview ? (
              <video className="lib-poster" src={v} muted loop autoPlay playsInline preload="none" />
            ) : (
              <video className="lib-poster" src={`${v}#t=0.5`} preload="metadata" muted playsInline onLoadedMetadata={(e) => Number.isFinite(e.currentTarget.duration) && setSeconds(e.currentTarget.duration)} />
            )}
            <span className="lib-shade" aria-hidden="true" />
            <button
              type="button"
              className="lib-play"
              aria-label={`Play demo of ${item.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
            >
              <PlayIcon />
            </button>
            {seconds != null && <span className="lib-chip-dur">{fmtDuration(seconds)}</span>}
          </>
        )}
        {v && !upload && (
          <>
            {ytId(v) ? (
              // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
              <img className="lib-poster" src={`https://i.ytimg.com/vi/${ytId(v)}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
            ) : (
              <span className="lib-poster tint" aria-hidden="true" />
            )}
            <button
              type="button"
              className="lib-play white"
              aria-label={`Play demo of ${item.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onPlay();
              }}
            >
              <PlayIcon />
            </button>
            <span className="lib-chip-link">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
              </svg>
              {providerOf(v)}
            </span>
          </>
        )}
        {!v && (
          <span className="lib-adddemo">
            <span className="lib-adddemo-plus" aria-hidden="true">
              +
            </span>
            {over ? "Drop to upload" : "Add demo"}
          </span>
        )}
        {uploading && <span className="lib-uploading" aria-label="Uploading" />}
        {item.archived ? (
          <button
            type="button"
            className="lib-edit"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
          >
            Put back
          </button>
        ) : (
          <span className="lib-edit" aria-hidden="true">
            <PencilIcon /> Edit
          </span>
        )}
      </div>
      <div className="lib-body">
        <span className="lib-name">{item.name}</span>
        {showCue && <span className={`lib-cue${item.cue ? "" : " none"}`}>{item.cue ? `“${item.cue}”` : "No default cue"}</span>}
        <span className="lib-cardchips">
          <span className={`lib-cardchip${item.variations.length ? " navy" : ""}`} title={varNames || undefined} aria-describedby={varNames ? `lib-vars-${item.id}` : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 4-6 4-12 6" />
            </svg>
            {item.variations.length ? `${item.variations.length} variation${item.variations.length === 1 ? "" : "s"}` : "No variations"}
          </span>
          <span className={`lib-cardchip${item.substitutes.length ? " group" : ""}`} title={subNames || undefined} aria-describedby={subNames ? `lib-subs-${item.id}` : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8" />
            </svg>
            {item.substitutes.length ? `${item.substitutes.length} sub${item.substitutes.length === 1 ? "" : "s"}` : "No subs"}
          </span>
          {varNames && (
            <span id={`lib-vars-${item.id}`} className="sr-only">
              {varNames}
            </span>
          )}
          {subNames && (
            <span id={`lib-subs-${item.id}`} className="sr-only">
              {subNames}
            </span>
          )}
        </span>
      </div>
      <span className="sr-only" style={{ color: colour.color }} />
    </div>
  );
}
