"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { sendChatMessageAction } from "../lib/actions";
import type { LinkArea, MessageLink } from "../lib/messageLinks";
import { ChatIcon } from "../components/icons";
import { LinkIcon } from "./MessageLinkPicker";
import { TRACK_PALETTE } from "./phaseChrome";

// Messaging the client from where the coach is looking: a day of their food
// diary, a session or an exercise in the builder, a check-in, a sheet of
// pictures. The message goes to the same place as one from the Messages tab
// (their Home and messages list) and is linked to the thing it was written
// from, so the client taps straight through to it. No trip to the Messages
// tab and its picker to say "about Tuesday's macros".
//
// Who the client is comes from one provider around the client's tabs, so the
// panels only have to say what the message is about.
type Who = { clientId: number; firstName: string };

const WhoContext = createContext<Who | null>(null);

export function MessageAboutProvider({ value, children }: { value: Who; children: ReactNode }) {
  return <WhoContext.Provider value={value}>{children}</WhoContext.Provider>;
}

/** The client whose tabs these are; null outside them. */
export const useMessageWho = () => useContext(WhoContext);

/** What a message is about: the link, and the same in words for the dialog. */
export type AboutTarget = { link: MessageLink; area: LinkArea; label: string };

// The area's colours, as on the Plan tab: measurements are the lifestyle track.
const AREA_TRACK = { Training: "training", Nutrition: "nutrition", Measurements: "lifestyle" } as const;

export function MessageAboutDialog({ target, onClose }: { target: AboutTarget; onClose: () => void }) {
  const who = useContext(WhoContext);
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, run] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    box.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!who) return null;
  const ready = text.trim().length > 0 && !busy && !sent;
  const send = () => {
    if (!ready) return;
    const fd = new FormData();
    fd.set("clientId", String(who.clientId));
    fd.set("text", text.trim());
    fd.set("link", JSON.stringify(target.link));
    run(async () => {
      await sendChatMessageAction(fd);
      setSent(true);
      setTimeout(onClose, 900);
    });
  };
  const palette = TRACK_PALETTE[AREA_TRACK[target.area]];

  return createPortal(
    // Clicks and keys stay in here: a portal still bubbles through the React
    // tree, and the rows this opens from toggle and drag on theirs.
    <div
      className="pl-dlg-scrim"
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="pl-dlg ma-dlg" role="dialog" aria-modal="true" aria-label={`Message ${who.firstName}`}>
        <header className="pl-dlg-head">
          <h2>Message {who.firstName}</h2>
          <span className="pl-track-tag" style={{ background: palette.tint, color: palette.ink }}>
            {target.area}
          </span>
        </header>

        <div className="pl-dlg-body">
          <div className="pl-dlg-field">
            <span className="pl-dlg-label">About</span>
            <span className="msg-link-chip ma-chip">
              <LinkIcon />
              <span>{target.label}</span>
            </span>
          </div>
          <label className="pl-dlg-field">
            <span className="pl-dlg-label">Message</span>
            <textarea
              ref={box}
              className="pl-dlg-input ma-text"
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
              }}
              disabled={busy || sent}
              placeholder="What you noticed, and what to do about it."
            />
          </label>
        </div>

        <footer className="pl-dlg-foot">
          <span className="ma-foot-note">{sent ? `Sent. It's on ${who.firstName}'s Home.` : `Lands on ${who.firstName}'s Home, linked to this.`}</span>
          <div className="pl-dlg-actions">
            <button type="button" className="pl-dlg-cancel" onClick={onClose} disabled={busy}>
              {sent ? "Close" : "Cancel"}
            </button>
            <button type="button" className="pl-dlg-save" onClick={send} disabled={!ready}>
              {sent ? "Sent" : busy ? "Sending…" : "Send"}
            </button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  );
}

/**
 * The way in: "Message Alex" as a text button, or just the speech bubble on
 * a dense row. Renders nothing outside a client's tabs.
 */
export default function MessageAboutButton({
  target,
  icon = false,
  text,
  className = "",
}: {
  target: AboutTarget;
  /** The bubble alone, for rows with no room for words. */
  icon?: boolean;
  /** The button's words; "Message <first name>" otherwise. */
  text?: string;
  className?: string;
}) {
  const who = useContext(WhoContext);
  const [open, setOpen] = useState(false);
  if (!who) return null;
  const words = text ?? `Message ${who.firstName}`;
  return (
    <>
      <button
        type="button"
        className={`${icon ? "ma-icon" : "ma-btn"}${className ? ` ${className}` : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={icon ? `${words} about ${target.label}` : undefined}
        title={icon ? `${words} about this` : undefined}
      >
        <ChatIcon />
        {!icon && <span>{words}</span>}
      </button>
      {open && <MessageAboutDialog target={target} onClose={() => setOpen(false)} />}
    </>
  );
}
