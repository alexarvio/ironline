"use client";

import { useEffect, useRef } from "react";
import { notify } from "../components/ui/toast";

// Where changes save as they are made (no Apply bar), the coach still wants
// to be told it happened. This watches a signature of what is saved and, when
// it changes, says so in a toast. It reports what the server sent back, so
// "Saved" is never said about something that did not land.
export default function SavedStamp({ signature, note }: { signature: string; note: string }) {
  const last = useRef(signature);
  useEffect(() => {
    if (last.current === signature) return;
    last.current = signature;
    notify.saved(note);
  }, [signature, note]);
  return null;
}
