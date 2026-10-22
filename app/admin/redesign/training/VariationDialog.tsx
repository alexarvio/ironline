"use client";

import { useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { variationIdeas } from "../../../lib/variationIdeas";
import { dayMonth } from "../../../lib/dayMonth";
import { Sep, SepJoin } from "../Sep";

// Which variation of an exercise the client does on this session (15 Oct),
// in the shared pop-up language: Standard and the library's variations as
// cards with the demo's poster, a NOW tag on the current one and the
// client's last top set on each; a new one made inline; and, once the
// choice changes, from which weeks it applies. Each variation keeps its own
// weight history. A variation can be deleted from its card, with a confirm.

const BRANCH = "M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 4-6 4-12 6";
const ytId = (url: string) => /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/)([\w-]{11})/.exec(url)?.[1] ?? null;
const shortDate = (d: string) => dayMonth(d.slice(0, 10));

export type VariationChoice = { variationId: number | null; name: string; video: string | null; last: { weight: number; reps: number; date: string } | null };
export type VariationScope = "from" | "just" | "all";

function Thumb({ video }: { video: string | null }) {
  const id = video ? ytId(video) : null;
  if (id)
    return (
      <span className="vrp-thumb has">
        {/* eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail */}
        <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" draggable={false} />
        <i />
      </span>
    );
  if (video && video.startsWith("/uploads/"))
    return (
      <span className="vrp-thumb has">
        <video src={`${video}#t=0.5`} preload="metadata" muted playsInline draggable={false} />
        <i />
      </span>
    );
  return <span className="vrp-thumb none">No demo</span>;
}

export default function VariationDialog({
  firstName,
  exerciseName,
  group,
  session,
  week,
  lbs,
  current,
  options,
  onSave,
  onCreate,
  onDelete,
  onClose,
}: {
  firstName: string;
  /** The parent exercise. */
  exerciseName: string;
  group: string | null;
  session: string;
  week: number;
  lbs: boolean;
  current: number | null;
  /** Standard first (variationId null), then the library's variations in library order. */
  options: VariationChoice[];
  onSave: (variationId: number | null, scope: VariationScope) => Promise<void>;
  /** Makes it in the library; the choice comes back to be shown and picked. */
  onCreate: (name: string) => Promise<VariationChoice | null>;
  onDelete: (variationId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [list, setList] = useState(options);
  const [picked, setPicked] = useState<number | null>(current);
  const [scope, setScope] = useState<VariationScope>("from");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const clean = name.trim();
  const duplicate = !!clean && list.some((o) => o.name.trim().toLowerCase() === clean.toLowerCase());
  const changed = picked !== current;
  const chosen = list.find((o) => o.variationId === picked) ?? list[0];
  const currentName = list.find((o) => o.variationId === current)?.name ?? "Standard";
  const ideas = variationIdeas(group, list.map((o) => o.name));
  const kg = (x: number) => (lbs ? `${Math.round(x * 2.20462 * 2) / 2} lb` : `${Math.round(x * 2) / 2} kg`);

  const create = async () => {
    if (!clean || duplicate || busy) return;
    setBusy(true);
    setError(null);
    try {
      const made = await onCreate(clean);
      if (!made) throw new Error("no variation");
      setList((l) => [...l, made]);
      setPicked(made.variationId);
      setName("");
      setAdding(false);
    } catch {
      setError("That didn’t save. Try again.");
    }
    setBusy(false);
  };
  const remove = async (id: number) => {
    setConfirm(null);
    setError(null);
    const before = list;
    setList((l) => l.filter((o) => o.variationId !== id));
    if (picked === id) setPicked(null);
    try {
      await onDelete(id);
    } catch {
      setList(before);
      setError("That didn’t delete. Try again.");
    }
  };
  const save = async () => {
    if (!changed || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(picked, scope);
    } catch {
      setError("That didn’t save. Try again.");
      setBusy(false);
    }
  };

  const info =
    scope === "from"
      ? `${firstName} does ${chosen.name} on ${session} from Week ${week}.${week === 2 ? " Week 1 stays as logged." : week > 2 ? ` Weeks 1–${week - 1} stay as logged.` : ""}`
      : scope === "just"
        ? `Only Week ${week} uses ${chosen.name}. Week ${week + 1} goes back to ${currentName}.`
        : `Every ${session} week shows ${chosen.name}, including weeks already logged. Logged sets keep the variation they were done on.`;

  return (
    <DialogContent
      className="vrp"
      aria-describedby={undefined}
      aria-label={`Variation, ${exerciseName}`}
      onOpenAutoFocus={(ev) => {
        ev.preventDefault();
        setTimeout(() => (document.querySelector(".vrp-card.on") as HTMLButtonElement | null)?.focus(), 60);
      }}
    >
      <span className="vrp-glow" aria-hidden="true" />
      <span className="vrp-wash" aria-hidden="true" />
      <div className="vrp-body">
        <header className="vrp-head">
          <span className="vrp-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d={BRANCH} />
            </svg>
          </span>
          <div className="vrp-head-text">
            <DialogTitle className="vrp-title">Variation</DialogTitle>
            <DialogDescription className="vrp-context">
              <span className="vrp-pill">{exerciseName}</span>
              <span className="vrp-meta">
                {session}
                <Sep />
                {firstName}
                <Sep />
                Week {week}
              </span>
            </DialogDescription>
          </div>
          <button type="button" className="vrp-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        <div className="vrp-section">
          <span className="vrp-label">{firstName} does</span>
          <div className="vrp-list" role="radiogroup" aria-label={`${firstName} does`}>
            {list.map((o) => {
              const on = o.variationId === picked;
              const now = o.variationId === current;
              return (
                <div key={o.variationId ?? "std"} className="vrp-item">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={`vrp-card${on ? " on" : ""}`}
                    aria-label={`${o.name}${now ? ", current" : ""}`}
                    onClick={() => setPicked(o.variationId)}
                    onKeyDown={(e) => {
                      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                      e.preventDefault();
                      const i = list.findIndex((x) => x.variationId === picked);
                      const next = list[(i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length];
                      setPicked(next.variationId);
                      requestAnimationFrame(() => (document.querySelector(".vrp-card.on") as HTMLButtonElement | null)?.focus());
                    }}
                  >
                    <Thumb video={o.video} />
                    <span className="vrp-text">
                      <span className="vrp-name-row">
                        <b>{o.name}</b>
                        {now && <span className="vrp-now">Now</span>}
                      </span>
                      <small>
                        <SepJoin parts={o.last ? [`Last ${kg(o.last.weight)} × ${o.last.reps}`, shortDate(o.last.date), "own weight history"] : ["Not done yet", "starts fresh"]} />
                      </small>
                    </span>
                    <span className={`vrp-radio${on ? " on" : ""}`} aria-hidden="true">
                      {on && (
                        <svg viewBox="0 0 24 24" width={11} height={11} fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5 9-10" />
                        </svg>
                      )}
                    </span>
                  </button>
                  {o.variationId != null && (
                    <button type="button" className="vrp-delete" onClick={() => setConfirm(confirm === o.variationId ? null : o.variationId)} aria-label={`Delete ${o.name}`}>
                      <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  )}
                  {confirm === o.variationId && o.variationId != null && (
                    <div className="vrp-confirm" aria-live="assertive">
                      <span>
                        Delete {o.name} from {exerciseName} in your library? Rows on it go back to Standard; logged sets stay.
                      </span>
                      <button type="button" className="vrp-keep" onClick={() => setConfirm(null)}>
                        Keep
                      </button>
                      <button type="button" className="vrp-danger" onClick={() => void remove(o.variationId!)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {adding ? (
            <div className="vrp-new">
              <div className="vrp-new-row">
                <label className={`vrp-field${duplicate ? " dup" : ""}`}>
                  <input
                    ref={input}
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 40))}
                    placeholder="New variation, e.g. Decline"
                    maxLength={40}
                    autoFocus
                    aria-label="New variation"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void create();
                      }
                      if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setAdding(false);
                        setName("");
                      }
                    }}
                  />
                </label>
                <button type="button" className="vrp-add" disabled={!clean || duplicate || busy} onClick={() => void create()}>
                  Add
                </button>
              </div>
              {duplicate && <span className="vrp-dup">Already exists. Pick it above.</span>}
              {ideas.length > 0 && (
                <span className="vrp-ideas">
                  {ideas.map((idea) => (
                    <button key={idea} type="button" className="vrp-idea" onClick={() => (setName(idea), input.current?.focus())}>
                      {idea}
                    </button>
                  ))}
                </span>
              )}
            </div>
          ) : (
            <button type="button" className="vrp-newbtn" onClick={() => setAdding(true)}>
              + New variation
            </button>
          )}
        </div>

        {changed && (
          <div className="vrp-section">
            <span className="vrp-label">Apply to</span>
            <div className="vrp-seg" role="radiogroup" aria-label="Apply to">
              {(
                [
                  ["from", `From Week ${week} on`],
                  ["just", `Just Week ${week}`],
                  ["all", "Whole programme"],
                ] as [VariationScope, string][]
              ).map(([k, label]) => (
                <button key={k} type="button" role="radio" aria-checked={scope === k} className={scope === k ? "on" : ""} onClick={() => setScope(k)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="vrp-info" aria-live="polite">
              <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5M12 8h.01" />
              </svg>
              <span>{info}</span>
            </div>
          </div>
        )}

        {error && <p className="vrp-error">{error}</p>}
      </div>

      {/* No link to the Library (22 Oct): it holds demos only now, not variations. */}
      <footer className="vrp-foot">
        <button type="button" className="vrp-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="vrp-save" disabled={!changed || busy} onClick={() => void save()}>
          {busy ? <span className="vrp-spin" aria-hidden="true" /> : null}
          Save
        </button>
      </footer>
    </DialogContent>
  );
}
