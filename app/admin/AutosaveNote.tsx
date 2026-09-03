"use client";

import { useEffect, useRef, useState } from "react";

// "Am I losing this?" — answered out loud.
//
// The builder has no Save button because it has never needed one: every field
// submits itself on blur and every control is its own form. But an editor that
// saves invisibly is indistinguishable from an editor that isn't saving at
// all, which is why a coach asks for a Save button. So rather than adding a
// button that would do nothing the blur doesn't already do, this says what is
// happening.
//
// It is not optimistic. "Saving…" is set when a form inside the builder
// submits, and only flips to "Saved" when the server sends a fresh render —
// `renderedAt` is stamped on the server, so it changes when, and only when,
// the action has run and revalidated. If a save fails, this stays on
// "Saving…" rather than claiming a save that didn't happen.
export default function AutosaveNote({
  renderedAt,
  idleText,
  savedSuffix,
  savedText,
  idleAsSaved,
  asButton,
}: {
  renderedAt: number;
  /** Shown at rest. The builder passes nothing (see below); the Measurements
      tab passes a sentence, because there the coach's question is not "is it
      saved" but "has the client got it", and that deserves an answer even
      when nothing is in flight. */
  idleText?: string;
  /** Appended after "Saved <time>", e.g. "· live in the client app". */
  savedSuffix?: string;
  /** Replaces the whole "Saved <time> …" line, e.g. "Up to date". */
  savedText?: string;
  /** Show the idle text in the saved (green) tone rather than grey. For a
      tab where "nothing in flight" genuinely means "the client has it". */
  idleAsSaved?: boolean;
  /** Render as a button-shaped status pill rather than plain text. */
  asButton?: boolean;
}) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [at, setAt] = useState<string | null>(null);
  const pending = useRef(false);
  const seen = useRef(renderedAt);

  useEffect(() => {
    const onSubmit = () => {
      pending.current = true;
      setState("saving");
    };
    // Capture phase: a form inside the builder that stops propagation would
    // otherwise never be seen here.
    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  useEffect(() => {
    if (renderedAt === seen.current) return;
    seen.current = renderedAt;
    if (!pending.current) return;
    pending.current = false;
    setState("saved");
    setAt(new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }));
  }, [renderedAt]);

  // Nothing at rest. A permanent "Saves as you go" was a label on the normal
  // state, which is exactly the state nobody needs telling about; it only has
  // something to say while a save is in flight or has just landed. The element
  // stays mounted with its height reserved so the bar doesn't jump when it
  // does speak.
  const tone = state === "idle" && idleAsSaved ? "saved" : state;
  const text =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? savedText ?? `Saved ${at}${savedSuffix ? ` ${savedSuffix}` : ""}`
        : idleText ?? "";

  if (asButton) {
    // A button that only ever reports. Disabled so it can't be "pressed"
    // into doing something the autosave hasn't already done.
    return (
      <button type="button" className={`pb-autosave-btn ${tone}`} aria-live="polite" disabled>
        {state === "saving" ? text : `${text} ✓`}
      </button>
    );
  }

  return (
    <span className={`pb-autosave ${tone}`} aria-live="polite">
      {text}
    </span>
  );
}
