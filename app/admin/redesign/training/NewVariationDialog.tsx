"use client";

import { useEffect, useRef, useState } from "react";
import { DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { variationIdeas } from "../../../lib/variationIdeas";

// A new variation of the row's exercise (15 Oct), in the shared pop-up
// language: the branch icon alone and big, "of" the exercise pill, the
// client and the week. The exercise's variations already in the library are
// chips to reuse; under them, a name for a new one with a few ideas for the
// muscle group. Either way the client gets it on this row from this week,
// with its own weight history.

const BRANCH = "M6 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9c0 4-6 4-12 6";
const MAX = 40;

export type VariationOption = { id: number; name: string; hasDemo: boolean };

export default function NewVariationDialog({
  firstName,
  exerciseName,
  group,
  week,
  variations,
  currentVariationId,
  onUse,
  onCreate,
  onClose,
}: {
  firstName: string;
  /** The exercise itself, without any variation's name. */
  exerciseName: string;
  group: string | null;
  week: number;
  /** The exercise's variations in the library, in library order. */
  variations: VariationOption[];
  /** The one the row is on now, hidden from the chips. */
  currentVariationId: number | null;
  onUse: (variation: VariationOption) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<VariationOption | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const chips = variations.filter((v) => v.id !== currentVariationId);
  const clean = name.trim();
  const duplicate = clean ? variations.find((v) => v.name.trim().toLowerCase() === clean.toLowerCase()) ?? null : null;
  const ideas = variationIdeas(group, variations.map((v) => v.name));
  const ok = !!picked || (clean.length > 0 && !duplicate);

  useEffect(() => {
    if (chips.length === 0) requestAnimationFrame(() => input.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on open
  }, []);

  const submit = async () => {
    if (!ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (picked) await onUse(picked);
      else await onCreate(clean);
    } catch {
      setError("That didn’t save. Try again.");
      setBusy(false);
    }
  };

  return (
    <DialogContent
      className="nvr"
      aria-describedby="nvr-info"
      onOpenAutoFocus={(ev) => ev.preventDefault()}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" && !(ev.target as HTMLElement).closest("button")) {
          ev.preventDefault();
          void submit();
        }
      }}
    >
      <span className="nvr-glow" aria-hidden="true" />
      <span className="nvr-wash" aria-hidden="true" />
      <div className="nvr-body">
        <header className="nvr-head">
          <span className="nvr-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d={BRANCH} />
            </svg>
          </span>
          <div className="nvr-head-text">
            <DialogTitle className="nvr-title">New variation</DialogTitle>
            <div className="nvr-context">
              of <span className="nvr-pill">{exerciseName}</span> · {firstName} · from Week {week}
            </div>
          </div>
          <button type="button" className="nvr-x" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" width={12} height={12} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </header>

        {chips.length > 0 && (
          <>
            <div className="nvr-field">
              <span className="nvr-label">Already in your library</span>
              <div className="nvr-chips" role="radiogroup" aria-label="Existing variations">
                {chips.map((v) => {
                  const on = picked?.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`nvr-chip${on ? " on" : ""}`}
                      onClick={() => {
                        setPicked(on ? null : v);
                        if (!on) setName("");
                      }}
                    >
                      {v.name}
                      {v.hasDemo && (
                        <svg viewBox="0 0 24 24" width={10} height={10} fill="currentColor" opacity={0.7} aria-hidden="true">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="nvr-or" aria-hidden="true">
              <i />
              <span>Or make a new one</span>
              <i />
            </div>
          </>
        )}

        <label className="nvr-field">
          <span className="nvr-label">Name</span>
          <span className={`nvr-name${clean ? (duplicate ? " dup" : " filled") : ""}`}>
            <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d={BRANCH} />
            </svg>
            <input
              ref={input}
              value={name}
              onChange={(e) => {
                setName(e.target.value.slice(0, MAX));
                setPicked(null);
              }}
              placeholder="e.g. Behind the back"
              maxLength={MAX}
              aria-label="Name"
              aria-describedby={duplicate ? "nvr-dup" : undefined}
            />
          </span>
          {duplicate && (
            <span id="nvr-dup" className="nvr-dup">
              “{duplicate.name}” already exists. Pick it above instead.
            </span>
          )}
          {ideas.length > 0 && (
            <span className="nvr-ideas">
              {ideas.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  className="nvr-idea"
                  onClick={() => {
                    setName(idea);
                    setPicked(null);
                    input.current?.focus();
                  }}
                >
                  {idea}
                </button>
              ))}
            </span>
          )}
        </label>

        <DialogDescription id="nvr-info" className="nvr-info" aria-live="polite">
          <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
          <span>
            {picked
              ? `${firstName} gets ${picked.name} on this row from Week ${week}. Weights are tracked separately from ${exerciseName}.`
              : `It’s saved in your library under ${exerciseName}, where you can add its demo and cue. ${firstName} gets it on this row from Week ${week}, with its own weight history.`}
          </span>
        </DialogDescription>

        {error && <p className="nvr-error">{error}</p>}
      </div>

      <footer className="nvr-foot">
        <button type="button" className="nvr-cancel" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="nvr-primary" disabled={!ok || busy} onClick={() => void submit()}>
          {busy ? <span className="nvr-spin" aria-hidden="true" /> : null}
          {picked ? `Use ${picked.name}` : "Add and use"}
        </button>
      </footer>
    </DialogContent>
  );
}
