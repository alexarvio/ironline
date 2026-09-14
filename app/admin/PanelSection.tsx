"use client";

import { ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ChevronDownIcon } from "../components/icons";

// One collapsible card in the client panel. The header is the whole width
// and says what is inside even when closed ("1 of 6 filled"), so a closed
// section still earns its place. The body's height is measured rather than
// guessed, so max-height animates to the content's real height and follows
// it when the content changes (a row goes into edit mode).
//
// Open or closed is remembered per section in this browser, the same way the
// panel's own collapse is: folding the panel away unmounts it, and a section
// the coach closed must still be closed when the panel comes back.
const CHANGE_EVENT = "ironline:panel-section";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, open: boolean) {
  try {
    window.localStorage.setItem(key, open ? "1" : "0");
  } catch {
    /* blocked storage: the toggle still works for this render */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export default function PanelSection({
  title,
  hint,
  defaultOpen = false,
  forceOpen = false,
  children,
}: {
  title: string;
  hint?: string;
  /** Before the coach has ever opened or closed this section. */
  defaultOpen?: boolean;
  /** Open now whatever was remembered (a new client, an access message),
      without changing what is remembered. The coach's next click wins. */
  forceOpen?: boolean;
  children: ReactNode;
}) {
  const storageKey = `ironline.admin.section.${title}`;
  const stored = useSyncExternalStore(subscribe, () => readStored(storageKey), () => null);
  const [forced, setForced] = useState(forceOpen);
  const open = forced || (stored == null ? defaultOpen : stored === "1");

  const [height, setHeight] = useState<number | null>(null);
  const inner = useRef<HTMLDivElement>(null);
  const bodyId = useId();

  useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.scrollHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    setForced(false);
    writeStored(storageKey, !open);
  };

  return (
    <section className={`ad-sect${open ? " open" : ""}`}>
      <button type="button" className="ad-sect-head" aria-expanded={open} aria-controls={bodyId} onClick={toggle}>
        <span className="ad-sect-title">{title}</span>
        {hint && <span className="ad-sect-hint">{hint}</span>}
        <span className="ad-sect-chev" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div
        id={bodyId}
        className="ad-sect-body"
        style={{ maxHeight: open ? height ?? undefined : 0, opacity: open ? 1 : 0 }}
        inert={!open}
      >
        <div ref={inner} className="ad-sect-inner">
          {children}
        </div>
      </div>
    </section>
  );
}
