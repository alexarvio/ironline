"use client";

import { useEffect, useRef } from "react";
import { newOnceKey } from "../lib/onceKey";

// A one-time key for a form a server page draws (6 Nov, lib/once.ts): the old admin's forms that add a row (Add a
// coach, an angle) post straight to their action, with no handler of their own to make a key in. Put inside such a
// form, this gives every send its key as the form's data is read, so a send that goes again after a dropped signal
// adds nothing twice. The same words sent again within two seconds (a double click) keep the key, so they add once.
const DOUBLE_MS = 2000;

export default function OnceKeyField({ name = "onceKey" }: { name?: string }) {
  const anchor = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const form = anchor.current?.form;
    if (!form) return;
    let last: { what: string; key: string; at: number } | null = null;
    const onData = (e: FormDataEvent) => {
      const what = JSON.stringify([...e.formData.entries()].filter(([k, v]) => k !== name && typeof v === "string"));
      const now = Date.now();
      const key = last && last.what === what && now - last.at < DOUBLE_MS ? last.key : newOnceKey();
      last = { what, key, at: now };
      e.formData.set(name, key);
    };
    form.addEventListener("formdata", onData);
    return () => form.removeEventListener("formdata", onData);
  }, [name]);
  // No name of its own: it only finds its form; the key goes in as the form's data is read.
  return <input ref={anchor} type="hidden" />;
}
