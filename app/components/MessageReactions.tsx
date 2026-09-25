"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { reactToMessageAction } from "../lib/actions";

// The reactions under a chat bubble, on both sides of the chat. What is
// there already reads as small chips: the other side's, and your own (which
// a tap takes off). The smiley opens a short row of emoji to pick from; a
// pick swaps your own. Reads the same list the server accepts.
export const REACTIONS = ["👍", "❤️", "💪", "🔥", "👏", "😂"] as const;

export default function MessageReactions({
  clientId,
  messageId,
  mine,
  theirs,
  align = "left",
}: {
  clientId: number;
  messageId: number;
  /** Your own reaction on this message. */
  mine: string | null;
  /** The other side's. */
  theirs: string | null;
  /** Which way the picker opens, matching the bubble's side. */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // The picker goes on a tap anywhere else, or Escape.
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const set = (emoji: string | null) => {
    setOpen(false);
    start(() => reactToMessageAction(clientId, messageId, emoji));
  };
  return (
    <span className={`mr mr-${align}${pending ? " busy" : ""}`}>
      {theirs && (
        <span className="mr-chip theirs" title="Their reaction">
          {theirs}
        </span>
      )}
      {mine && (
        <button type="button" className="mr-chip mine" onClick={() => set(null)} title="Take yours off" aria-label={`Your reaction ${mine}, tap to remove`}>
          {mine}
        </button>
      )}
      <span className="mr-add" ref={box}>
        <button type="button" className="mr-btn" onClick={() => setOpen((o) => !o)} aria-label={mine ? "Change your reaction" : "React"} aria-expanded={open}>
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6.2" />
            <path d="M5.5 9.5c.6.9 1.5 1.4 2.5 1.4s1.9-.5 2.5-1.4" />
            <circle cx="6" cy="6.5" r=".6" fill="currentColor" />
            <circle cx="10" cy="6.5" r=".6" fill="currentColor" />
            <path d="M12.5 2.5v3M11 4h3" />
          </svg>
        </button>
        {open && (
          <span className="mr-row" role="listbox" aria-label="Pick a reaction">
            {REACTIONS.map((e) => (
              <button key={e} type="button" role="option" aria-selected={mine === e} className={`mr-pick${mine === e ? " on" : ""}`} onClick={() => set(mine === e ? null : e)}>
                {e}
              </button>
            ))}
          </span>
        )}
      </span>
    </span>
  );
}
