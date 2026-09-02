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
export default function AutosaveNote({ renderedAt }: { renderedAt: number }) {
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

  return (
    <span className={`pb-autosave ${state}`} aria-live="polite">
      {state === "saving" ? "Saving…" : state === "saved" ? `Saved ${at}` : "Saves as you go"}
    </span>
  );
}
