"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { createLibraryExerciseAction } from "../library/actions";
import type { Library } from "./TrainingDraft";

// A session's substitutes for one exercise (15 Oct), in the shared pop-up
// language. The library's substitutes are the defaults, read-only here;
// up to three picked for this session replace them for this client. Each
// session pick has a rank, the demo's poster, a note for the client and a
// way out; more come from a search of the library, the same muscle group
// first. Saved as one list; an empty list means "use the library".

const SWAP = "M7 4 3 8l4 4M3 8h13M17 20l4-4-4-4M21 16H8";
const MAX = 3;
const INFO_KEY = "norcoach:subs-info-dismissed";
const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;

export type SessionSub = { exerciseId: number; name: string; note: string };
type LibEx = { id: number; name: string; group: string; video: string | null; variations: { id: number }[] };

/** The demo's poster: YouTube's thumbnail, the clip's first frame, or "No demo". */
function Thumb({ video }: { video: string | null }) {
  const id = video ? ytId(video) : null;
  if (id)
    return (
      // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail
      <img className="ssb-thumb" src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
    );
  if (video && video.startsWith("/uploads/")) return <video className="ssb-thumb" src={`${video}#t=0.5`} preload="metadata" muted playsInline draggable={false} />;
  return <span className="ssb-thumb none">No demo</span>;
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
  // The pop-up only ever renders in the browser, so the dismissed flag can be read up front.
  const [info, setInfo] = useState(() => {
    try {
      return !window.localStorage.getItem(INFO_KEY);
    } catch {
      return true;
    }
  });
  const dismissInfo = () => {
    setInfo(false);
    try {
      window.localStorage.setItem(INFO_KEY, "1");
    } catch {}
  };

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
    <DialogContent className="ssb" aria-describedby={undefined} aria-label={`Substitutes, ${row.name}`} onOpenAutoFocus={(ev) => ev.preventDefault()}>
      <span className="ssb-decor" aria-hidden="true">
        <i className="ssb-glow" />
        <i className="ssb-wash" />
      </span>
      <div className="ssb-body">
        <header className="ssb-head">
          <span className="ssb-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d={SWAP} />
            </svg>
          </span>
          <div className="ssb-head-text">
            <DialogTitle className="ssb-title">Substitutes</DialogTitle>
            <DialogDescription className="ssb-context">
              <span className="ssb-pill">{row.name}</span>
              <span className="ssb-meta">
                {session} · {firstName}
              </span>
            </DialogDescription>
          </div>
          <button type="button" className="ssb-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {info && (
          <div className="ssb-info">
            <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 11v5M12 8h.01" />
            </svg>
            <span>
              When the machine’s taken, {firstName} picks one under <b>Substitute today</b>. Targets carry over; those sets don’t count toward this exercise’s weight history.
            </span>
            <button type="button" className="ssb-info-x" onClick={dismissInfo} aria-label="Got it, hide this">
              ✕
            </button>
          </div>
        )}

        {/* From the library: read-only. */}
        <section className="ssb-section">
          <h2 className="ssb-label-row">
            <span className="ssb-label">From the library</span>
            <span className="ssb-spacer" />
            <Link href="/admin/redesign/library" className="ssb-link">
              Edit in library ↗
            </Link>
          </h2>
          {row.librarySubstitutes.length === 0 ? (
            <p className="ssb-empty">None set for this exercise yet. Set them in the library and every programme gets them.</p>
          ) : (
            <>
              <ul className={`ssb-lib${replaced ? " replaced" : ""}`}>
                {row.librarySubstitutes.map((s) => {
                  const off = hidden.includes(s.exerciseId);
                  return (
                    <li key={s.exerciseId} className={`ssb-librow${off && !replaced ? " off" : ""}`} aria-label={`${s.name}, ${replaced ? "replaced" : off ? "not offered on this session" : "offered"}`}>
                      <Thumb video={byId.get(s.exerciseId)?.video ?? null} />
                      <span className="ssb-text">
                        <b>{s.name}</b>
                        <small>{s.note ? `“${s.note}”` : "No note"}</small>
                      </span>
                      {replaced ? (
                        <span className="ssb-tag">Replaced</span>
                      ) : (
                        /* Offered by default; the coach can switch one off just for this session (15 Oct). */
                        <button type="button" role="switch" aria-checked={!off} className="ssb-offer" onClick={() => setHidden((h) => (off ? h.filter((id) => id !== s.exerciseId) : [...h, s.exerciseId]))} aria-label={`${s.name} offered on this session`}>
                          {off ? "Off" : "Offered"}
                          <i aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              {replaced && <p className="ssb-replaced">This session’s picks replace these for {firstName}.</p>}
            </>
          )}
        </section>

        {/* Just for this session. */}
        <section className="ssb-section">
          <h2 className="ssb-label-row">
            <span className="ssb-label">Just for this session</span>
            <span className={`ssb-count${list.length >= MAX ? " full" : ""}`}>
              {list.length} of {MAX}
            </span>
          </h2>
          {list.length > 0 && (
            <ul className="ssb-list">
              {list.map((s, i) => {
                const x = byId.get(s.exerciseId) ?? null;
                return (
                  <li
                    key={s.exerciseId}
                    className="ssb-row"
                    aria-label={`Substitute ${i + 1} of ${MAX}, ${s.name}`}
                    onKeyDown={(e) => {
                      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
                        e.preventDefault();
                        move(i, e.key === "ArrowUp" ? i - 1 : i + 1);
                      }
                    }}
                  >
                    <span className="ssb-rank" aria-hidden="true">
                      {i + 1}
                    </span>
                    <Thumb video={x?.video ?? null} />
                    <span className="ssb-text">
                      <b>{s.name}</b>
                      <small>{x?.video ? "Demo attached" : "No demo yet"}</small>
                    </span>
                    <input className="ssb-note" value={s.note} onChange={(e) => setList((l) => l.map((y) => (y.exerciseId === s.exerciseId ? { ...y, note: e.target.value.slice(0, 120) } : y)))} placeholder={`Note for ${firstName} · optional`} maxLength={120} aria-label={`Note for ${s.name}`} />
                    <button type="button" className="ssb-remove" onClick={() => setList((l) => l.filter((y) => y.exerciseId !== s.exerciseId))} aria-label={`Remove ${s.name}`}>
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {list.length < MAX ? (
            <div className="ssb-search-wrap">
              <label className={`ssb-search${open ? " open" : ""}`}>
                <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
                <input
                  ref={input}
                  role="combobox"
                  aria-expanded={open}
                  aria-controls="ssb-listbox"
                  aria-autocomplete="list"
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
                  placeholder="Add one: search the library"
                />
              </label>
              {open && (
                <div id="ssb-listbox" className="ssb-drop" role="listbox" onMouseDown={(e) => e.preventDefault()}>
                  <span className="ssb-drop-label">{q.trim() ? "Results" : `Suggested · ${groupLabel}`}</span>
                  {candidates.map((x, i) => (
                    <button key={x.id} type="button" role="option" aria-selected={i === cursor} className={`ssb-opt${i === cursor ? " on" : ""}`} onMouseEnter={() => setCursor(i)} onClick={() => add(x)}>
                      <span>{x.name}</span>
                      <small>{x.video ? "Has demo" : "No demo"}</small>
                    </button>
                  ))}
                  {candidates.length === 0 && (
                    <div className="ssb-nomatch">
                      {q.trim() ? "No match in the library." : "Nothing else in this group yet."}
                      {q.trim() && (
                        <button type="button" className="ssb-create" onClick={() => void create()} disabled={creating}>
                          Create “{q.trim()}”
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {row.librarySubstitutes.length > 0 && list.length === 0 && (
                <button type="button" className="ssb-copy" onClick={() => setList(row.librarySubstitutes.slice(0, MAX).map((s) => ({ ...s })))}>
                  Copy library picks here to tweak them
                </button>
              )}
            </div>
          ) : (
            <p className="ssb-full">That’s three. Remove one to add another.</p>
          )}
        </section>

        {error && <p className="ssb-error">{error}</p>}
      </div>

      <footer className="ssb-foot">
        <button type="button" className="ssb-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="ssb-save" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <span className="ssb-spin" aria-hidden="true" /> : null}
          Save
        </button>
      </footer>
    </DialogContent>
  );
}
