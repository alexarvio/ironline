"use client";

import { useEffect, useRef, useState } from "react";

// Where changes save as they are made (no Apply bar), the coach still wants
// to be told it happened. This watches a signature of what is saved and, when
// it changes, says so for a few seconds. It reports what the server sent
// back, so "Saved" is never said about something that did not land.
export default function SavedStamp({ signature, note }: { signature: string; note: string }) {
  const last = useRef(signature);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (last.current === signature) return;
    last.current = signature;
    setShown(true);
    const t = setTimeout(() => setShown(false), 4000);
    return () => clearTimeout(t);
  }, [signature]);
  return (
    <span className={`saved-stamp${shown ? " on" : ""}`} role="status" aria-live="polite">
      {shown && (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Saved · {note}
        </>
      )}
    </span>
  );
}
