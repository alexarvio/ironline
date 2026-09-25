"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon } from "../../../components/icons";
import { tzShort } from "../../../lib/timezones";

// The timezone a meeting's time is in, as the drafts' own field (the Picker
// look), not the browser's select: the city and its offset, and a search
// box over the list, since there are a few hundred of them.
export default function TimezonePicker({ value, zones, onChange }: { value: string; zones: string[]; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrap = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const city = (tz: string) => tz.split("/").pop()!.replace(/_/g, " ");
  const region = (tz: string) => (tz.includes("/") ? tz.split("/")[0].replace(/_/g, " ") : "");
  // Each zone's offset, worked out once: a few hundred of them per keystroke is slow.
  const [offsets] = useState(() => new Map(zones.map((z) => [z, tzShort(z)] as const)));
  const off = (tz: string) => offsets.get(tz) ?? tzShort(tz);

  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    // The picked one in view when the list opens.
    list.current?.querySelector<HTMLElement>(".on")?.scrollIntoView({ block: "center" });
    const away = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  const needle = q.trim().toLowerCase();
  const shown = needle ? zones.filter((z) => z.toLowerCase().replace(/_/g, " ").includes(needle) || off(z).toLowerCase().includes(needle)) : zones;
  const pick = (tz: string) => {
    onChange(tz);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={wrap} className="rt-tzp">
      <button type="button" className="rd-input rd-picker rt-tzp-btn" data-state={open ? "open" : "closed"} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span>
          {city(value)} <small>· {off(value)}</small>
        </span>
        <ChevronDownIcon />
      </button>
      {open && (
        <div className="rt-tzp-pop">
          <input
            ref={search}
            className="rd-input rt-tzp-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                setOpen(false);
              }
              if (e.key === "Enter" && shown[0]) {
                e.preventDefault();
                pick(shown[0]);
              }
            }}
            placeholder="Search a city or GMT+7"
            aria-label="Search timezones"
          />
          <div ref={list} className="rt-tzp-list" role="listbox" aria-label="Timezones">
            {shown.map((z) => (
              <button key={z} type="button" role="option" aria-selected={z === value} className={`rt-tzp-item${z === value ? " on" : ""}`} onClick={() => pick(z)}>
                <span>
                  {city(z)}
                  {region(z) && <small>{region(z)}</small>}
                </span>
                <em>{off(z)}</em>
              </button>
            ))}
            {shown.length === 0 && <p className="rt-tzp-none">No timezone called that.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
