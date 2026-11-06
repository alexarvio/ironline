"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { newOnceKey } from "../lib/onceKey";

// A submit button for a server-rendered form whose action adds a row (6 Nov, one-time key): the tap puts a fresh key
// in the form's `onceKey` field (a click comes before the submit it makes), so the save sent again once the signal is
// back adds one. A second tap while the save is out is nothing, so a fast double tap is one key and one row.
export default function OnceKeySubmit({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  const field = useRef<HTMLInputElement>(null);
  const out = useRef(false);
  const seenPending = useRef(false);
  useEffect(() => {
    if (pending) seenPending.current = true;
    else if (seenPending.current) {
      seenPending.current = false;
      out.current = false;
    }
  }, [pending]);
  return (
    <>
      <input ref={field} type="hidden" name="onceKey" defaultValue="" />
      <button
        type="submit"
        className={className}
        disabled={pending}
        onClick={(e) => {
          if (out.current) {
            e.preventDefault();
            return;
          }
          out.current = true;
          if (field.current) field.current.value = newOnceKey();
        }}
      >
        {children}
      </button>
    </>
  );
}
