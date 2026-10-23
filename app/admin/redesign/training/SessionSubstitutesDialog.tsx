"use client";

import "./substitutes.css";
import { useMemo, useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { createLibraryExerciseAction } from "../library/actions";
import type { Library } from "./TrainingDraft";
import { Sep } from "../Sep";
import { FEATURES } from "../../../lib/features";

// A session's substitutes for one exercise (15 Oct), in the admin hairline
// style since 20 Oct (Alex: no explanations, facts only). The library's
// substitutes are the defaults, read-only here; up to three picked for this
// session replace them for this client. Each session pick has a rank, the
// demo's poster, a note for the client and a way out; more come from a search
// of the library, the same muscle group first. Saved as one list; an empty
// list means "use the library". Prefix sbh- (substitutes.css).

const MAX = 3;
const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;

export type SessionSub = { exerciseId: number; name: string; note: string };
type LibEx = { id: number; name: string; group: string; video: string | null; variations: { id: number }[] };

/** The demo's poster: YouTube's thumbnail, the clip's first frame, or "No demo". */
function Thumb({ video }: { video: string | null }) {
  const id = video ? ytId(video) : null;
  if (id)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
      <img className="sbh-thumb" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
    );
  if (video && video.startsWith("/uploads/")) return <video className="sbh-thumb" src={`${video}#t=0.5`} preload="metadata" muted playsInline draggable={false} />;
  return <span className="sbh-thumb none">No demo</span>;
}

export default function SessionSubstitutesDialog({
  row,
  firstName,
  session,
  library,
  onSave,
  onClose,
}: {
  row: { id: number; exerciseId: number; name: string; alternatives: SessionSub[]; librarySubstitutes: SessionSub[]; /** Library substitutes switched off on this session. */ libraryHidden: number[] };
  firstName: string;
  session: string;
  library: Library;
  onSave: (list: SessionSub[], hidden: number[]) => Promise<void>;
  onClose: () => void;
}) {
  const all = useMemo<LibEx[]>(() => library.flatMap((g) => g.exercises.map((e) => ({ id: e.id, name: e.name, group: e.group ?? g.slug, video: e.video ?? null, variations: e.variations ?? [] }))), [library]);
  const byId = useMemo(() => new Map(all.map((e) => [e.id, e] as const)), [all]);
  const me = byId.get(row.exerciseId) ?? null;
  const group = me?.group ?? null;
  const groupLabel = library.find((g) => g.slug === group)?.label ?? "the library";

  const [list, setList] = useState<SessionSub[]>(row.alternatives.map((a) => ({ ...a })));
  // Library substitutes switched off just for this session: offered unless the coach says otherwise.
  const [hidden, setHidden] = useState<number[]>(row.libraryHidden);
  const snapshot = (l: SessionSub[], h: number[]) => JSON.stringify([l.map((a) => [a.exerciseId, a.note.trim()]), [...h].sort((a, b) => a - b)]);
  const [initial] = useState(() => snapshot(row.alternatives, row.libraryHidden));
  const dirty = snapshot(list, hidden) !== initial;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The search.
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [creating, setCreating] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const candidates = useMemo(() => {
    const taken = new Set([row.exerciseId, ...list.map((s) => s.exerciseId)]);
    const pool = all.filter((x) => !taken.has(x.id));
    const needle = q.trim().toLowerCase();
    const demoFirst = (a: LibEx, b: LibEx) => Number(!!b.video) - Number(!!a.video) || a.name.localeCompare(b.name);
    if (!needle) return pool.filter((x) => x.group === group).sort(demoFirst).slice(0, 5);
    const hits = pool.filter((x) => x.name.toLowerCase().includes(needle));
    return [...hits.filter((x) => x.group === group).sort(demoFirst), ...hits.filter((x) => x.group !== group).sort(demoFirst)].slice(0, 8);
  }, [all, list, q, group, row.exerciseId]);
  const add = (x: { id: number; name: string }) => {
    if (list.length >= MAX || list.some((s) => s.exerciseId === x.id)) return;
    const next = [...list, { exerciseId: x.id, name: x.name, note: "" }];
    setList(next);
    setQ("");
    setCursor(0);
    if (next.length >= MAX) setOpen(false);
    else input.current?.focus();
  };
  const create = async () => {
    const name = q.trim();
    if (!name || creating) return;
    setCreating(true);
    const id = await createLibraryExerciseAction(name, group ?? "other", "");
    setCreating(false);
    if (id == null) {
      setError("Couldn’t add it to the library.");
      return;
    }
    add({ id, name });
  };
  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    const next = [...list];
    const [s] = next.splice(from, 1);
    next.splice(to, 0, s);
    setList(next);
  };

  const replaced = list.length > 0;
  const save = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(list.map((s) => ({ ...s, note: s.note.trim() })), hidden);
    } catch {
      setError("That didn’t save. Try again.");
      setSaving(false);
    }
  };

  return (
    <DialogContent className="sbh" aria-label={`Substitutes, ${row.name}`} onOpenAutoFocus={(ev) => ev.preventDefault()}>
      <div className="sbh-head">
        <DialogTitle className="sbh-title">Substitutes</DialogTitle>
        <button type="button" className="sbh-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>
      <DialogDescription className="sbh-what">
        {row.name}
        <Sep />
        {session}
      </DialogDescription>

      {/* From the library: read-only. Off for now (23 Oct, Alex: none are preset on the Library yet). */}
      {FEATURES.librarySubstitutes && (
      <section className="sbh-sec">
        <h2 className="sbh-label-row">
          <span className="sbh-label">From the library</span>
        </h2>
        {row.librarySubstitutes.length === 0 ? (
          <p className="sbh-empty">None yet</p>
        ) : (
          <ul className={`sbh-rows${replaced ? " replaced" : ""}`}>
            {row.librarySubstitutes.map((s) => {
              const off = hidden.includes(s.exerciseId);
              return (
                <li key={s.exerciseId} className={`sbh-librow${off && !replaced ? " off" : ""}`} aria-label={`${s.name}, ${replaced ? "replaced" : off ? "not offered on this session" : "offered"}`}>
                  <Thumb video={byId.get(s.exerciseId)?.video ?? null} />
                  <span className="sbh-text">
                    <b>{s.name}</b>
                    <small>{s.note ? `“${s.note}”` : "No note"}</small>
                  </span>
                  {replaced ? (
                    <span className="sbh-tag">Replaced</span>
                  ) : (
                    /* Offered by default; the coach can switch one off just for this session (15 Oct). */
                    <button type="button" role="switch" aria-checked={!off} className="sbh-switch" onClick={() => setHidden((h) => (off ? h.filter((id) => id !== s.exerciseId) : [...h, s.exerciseId]))} aria-label={`${s.name} offered on this session`}>
                      <i aria-hidden="true" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
      )}

      {/* Just for this session. */}
      <section className="sbh-sec">
        <h2 className="sbh-label-row">
          <span className="sbh-label">Just for this session</span>
          <span className="sbh-count">
            {list.length} of {MAX}
          </span>
        </h2>
        {list.length > 0 && (
          <ul className="sbh-rows">
            {list.map((s, i) => {
              const x = byId.get(s.exerciseId) ?? null;
              return (
                <li
                  key={s.exerciseId}
                  className="sbh-row"
                  aria-label={`Substitute ${i + 1} of ${MAX}, ${s.name}`}
                  onKeyDown={(e) => {
                    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                      e.preventDefault();
                      move(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                    }
                  }}
                >
                  <span className="sbh-rank" aria-hidden="true">
                    {i + 1}
                  </span>
                  <Thumb video={x?.video ?? null} />
                  <span className="sbh-text">
                    <b>{s.name}</b>
                    <input className="sbh-note" value={s.note} onChange={(e) => setList((l) => l.map((y) => (y.exerciseId === s.exerciseId ? { ...y, note: e.target.value.slice(0, 120) } : y)))} placeholder={`Note for ${firstName}`} maxLength={120} aria-label={`Note for ${s.name}`} />
                  </span>
                  <button type="button" className="sbh-remove" onClick={() => setList((l) => l.filter((y) => y.exerciseId !== s.exerciseId))} aria-label={`Remove ${s.name}`}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {list.length < MAX && (
          <div className="sbh-search-wrap">
            <label className={`sbh-search${open ? " open" : ""}`}>
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="M20 20l-3.5-3.5" />
              </svg>
              <input
                ref={input}
                role="combobox"
                aria-expanded={open}
                aria-controls="sbh-listbox"
                aria-autocomplete="list"
                aria-label="Search the library"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setCursor(0);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => setOpen(false)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setOpen(true);
                    setCursor((c) => Math.min(c + 1, Math.max(0, candidates.length - 1)));
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => Math.max(0, c - 1));
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setOpen(false);
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (candidates[cursor]) add(candidates[cursor]);
                    else if (q.trim()) void create();
                  }
                }}
                placeholder="Search the library"
              />
            </label>
            {open && (
              <div id="sbh-listbox" className="sbh-drop" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                <span className="sbh-drop-label">
                  {q.trim() ? (
                    "Results"
                  ) : (
                    <>
                      Suggested<Sep />
                      {groupLabel}
                    </>
                  )}
                </span>
                {candidates.map((x, i) => (
                  <button key={x.id} type="button" role="option" aria-selected={i === cursor} className={`sbh-opt${i === cursor ? " on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => add(x)}>
                    <span>{x.name}</span>
                    <small>{x.video ? "Has demo" : "No demo"}</small>
                  </button>
                ))}
                {candidates.length === 0 && (
                  <div className="sbh-nomatch">
                    {q.trim() ? "No match" : "None yet"}
                    {q.trim() && (
                      <button type="button" className="sbh-create" onClick={() => void create()} disabled={creating}>
                        Create “{q.trim()}”
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {FEATURES.librarySubstitutes && row.librarySubstitutes.length > 0 && list.length === 0 && (
              <button type="button" className="sbh-copy" onClick={() => setList(row.librarySubstitutes.slice(0, MAX).map((s) => ({ ...s })))}>
                Copy from library
              </button>
            )}
          </div>
        )}
      </section>

      {error && <p className="sbh-error">{error}</p>}

      <div className="sbh-foot">
        <button type="button" className="sbh-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="sbh-save" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <span className="sbh-spin" aria-hidden="true" /> : null}
          Save
        </button>
      </div>
    </DialogContent>
  );
}
