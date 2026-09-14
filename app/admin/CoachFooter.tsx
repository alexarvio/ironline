"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { GearIcon } from "../components/icons";

// The coach, at the foot of the rail, with the gear that opens their account
// menu. `children` is the menu's content (Sign out), rendered on the server
// because it posts to a server action.
export default function CoachFooter({ name, children }: { name: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="ad-rail-coach" ref={wrap}>
      <span className="ad-rail-coach-avatar" aria-hidden="true">
        {name.charAt(0).toUpperCase()}
      </span>
      <div className="ad-rail-coach-text">
        <div className="ad-rail-coach-name">{name}</div>
        <div className="ad-rail-coach-role">Coach</div>
      </div>
      <button
        type="button"
        className="ad-rail-gear"
        aria-label="Account"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <GearIcon />
      </button>
      {open && (
        <div className="ad-rail-menu" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
