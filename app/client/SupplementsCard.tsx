"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { slideBelow } from "../lib/slideBelow";
import { CheckIcon, ChevronDownIcon } from "../components/icons";
import RingEdge from "../components/RingEdge";

// The coach's supplements, folded into the foot of the calories card: one
// row with a chevron and how many are ticked, opening to the list. Each item
// has a tick the client can use as a reminder for today. The ticks are the
// client's own: kept on this phone for the day, never sent, never seen by
// the coach, whose list stays a reference list. A new day starts clear: the
// day is the phone's own, checked again whenever the app comes back to the
// front (so one left open over midnight clears too), and older days' ticks
// are thrown away.
//
// Deliberately does NOT import from ../lib/queries (see HomeHub.tsx).
export type SupplementRow = { name: string; quantity: string; timing: string; notes: string };

const PREFIX = "ironline.nutrition.taken.";
const localDay = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function SupplementsCard({ date, rows }: { date: string; rows: SupplementRow[] }) {
  const [day, setDay] = useState(date);
  const storageKey = `${PREFIX}${day}`;
  const [open, setOpen] = useState(false);
  // The open look (the pill as the header, the list flat under it) stays on while the list folds away, and goes once
  // it has (24 Oct, Alex: the list eases open and shut).
  const [dressed, setDressed] = useState(false);
  // As Home's To focus on (29 Oct, Alex: "still slow to open… laggy"): the list takes its room at once and the coach's
  // note and the days under it slide by a transform (slideBelow), so no frame lays out the page.
  const ref = useRef<HTMLDivElement>(null);
  const flip = () => turn(!open);
  const turn = (next: boolean) => {
    const el = ref.current;
    const before = el?.getBoundingClientRect().height ?? 0;
    flushSync(() => {
      setOpen(next);
      setDressed(next);
    });
    if (el) slideBelow(el, before, el.closest<HTMLElement>(".nd"));
  };
  const [taken, setTaken] = useState<string[]>([]);
  // The phone's day, now and whenever the app is back in front.
  useEffect(() => {
    const check = () => setDay(localDay());
    const t = setTimeout(check, 0);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      clearTimeout(t);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  // That day's ticks (after mount: the server render has no storage), and
  // every other day's cleared out.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
        setTaken(Array.isArray(saved) ? saved.filter((x): x is string => typeof x === "string") : []);
        for (let i = window.localStorage.length - 1; i >= 0; i--) {
          const k = window.localStorage.key(i);
          if (k && k.startsWith(PREFIX) && k !== storageKey) window.localStorage.removeItem(k);
        }
      } catch {
        setTaken([]);
      }
    }, 0);
    return () => clearTimeout(t);
  }, [storageKey]);

  const allOf = (list: string[]) => rows.length > 0 && rows.every((r) => list.includes(r.name));
  const done = allOf(taken);
  // The last one ticked (29 Oct, Alex): a moment to see its tick, then the list folds away and the pill shows the check.
  const folding = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (folding.current && clearTimeout(folding.current)), []);
  // The latest ticks, so two quick taps never work from the same old list.
  const latest = useRef(taken);
  latest.current = taken;
  const toggle = (name: string) => {
    const was = latest.current;
    const next = was.includes(name) ? was.filter((x) => x !== name) : [...was, name];
    latest.current = next;
    setTaken(next);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {}
    if (folding.current) clearTimeout(folding.current);
    folding.current = allOf(next) ? setTimeout(() => turn(false), 700) : null;
  };

  return (
    <div ref={ref} className={`nd-supps${dressed ? " dressed" : ""}`}>
      <button type="button" className="nd-supps-toggle" aria-expanded={open} onClick={flip}>
        <span className="nd-supps-title">Supplements</span>
        {/* How many the coach has set; the ticks inside are optional. All ticked today, a check instead. */}
        {done ? (
          <span className="nd-supps-done" aria-label="All taken today">
            <CheckIcon />
            <RingEdge size={22} stroke={1.5} />
          </span>
        ) : (
          <span className="nd-supps-count" aria-label={`${rows.length} supplement${rows.length === 1 ? "" : "s"}`}>
            {rows.length}
          </span>
        )}
        <span className="nd-supps-chev" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>
      <div
        className={`nd-supps-fold${open ? " open" : ""}`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="nd-supps-list">
          {rows.map((r, i) => {
            const on = taken.includes(r.name);
            return (
              <button
                key={`${r.name}-${i}`}
                type="button"
                className={`nd-supp${on ? " taken" : ""}`}
                aria-pressed={on}
                onClick={() => toggle(r.name)}
              >
                <span className="nd-supp-main">
                  <span className="nd-supp-name">{r.name}</span>
                  {r.notes && <span className="nd-supp-note">{r.notes}</span>}
                </span>
                <span className="nd-supp-dose">
                  {r.quantity && <span className="nd-supp-qty">{r.quantity}</span>}
                  {r.timing && <span className="nd-supp-timing">{r.timing}</span>}
                </span>
                {/* The tick circle on the right, after the dose. */}
                <span className="nd-check" aria-hidden="true">
                  {on && <CheckIcon />}
                  <RingEdge size={22} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
