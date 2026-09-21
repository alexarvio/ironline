"use client";

import type { LinkView } from "../lib/messageLinks";
import { useOpenLink } from "./CheckInContext";

// Under a coach message that points at something: where it goes, in words,
// and a tap takes the client straight there (AppShell's openLink). One that
// can no longer be opened — a session since removed, a past programme — says
// so and does nothing.
export default function MessageLinkChip({ view }: { view: LinkView }) {
  const openLink = useOpenLink();
  if (view.gone) {
    return (
      <span className="cm-link gone">
        <LinkGlyph />
        <span className="cm-link-label">{view.label}</span>
        <em>no longer available</em>
      </span>
    );
  }
  return (
    <button
      type="button"
      className="cm-link"
      onClick={(e) => {
        // Inside Home's card, which opens the messages feed on a tap.
        e.stopPropagation();
        openLink?.(view);
      }}
    >
      <LinkGlyph />
      <span className="cm-link-label">
        <small>{view.area}</small>
        {view.label}
      </span>
    </button>
  );
}

function LinkGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  );
}
