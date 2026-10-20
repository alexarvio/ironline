"use client";

import { useEffect, useRef, useState } from "react";
import type React from "react";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "../../../components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from "../../../components/ui/dropdown-menu";
import { CameraIcon, ChevronDownIcon } from "../../../components/icons";
import type { Sheet } from "./PicturesDraft";

// Compare (21 Oct, Alex, from the Claude Design brief, in the admin's rules): two sheets, one angle, two photos.
//
// - Head: Compare, Side by side | Slider (the shared capsule, ink when chosen), the round ✕.
// - Two week pickers across the width ("Week 1 ▾ vs Week 8 ▾"), the admin's floating menu (never the browser's
//   <select>); picking the week the other side has swaps them.
// - The angle switch across the width, every angle an equal share, in the coach's order.
// - Side by side: two 3:4 photos, each with its week and weigh-in under it (the change from the left beside the
//   right one's). Slider: one stage, the left week over the right, a divider dragged or stepped with ← →.
// The weeks, the angle and the view are remembered for the client while the tab stays open.

type View = "side" | "slider";
type Saved = { a: string; b: string; slot: number | null; view: View };
const KEY = (clientId: number) => `rp-compare-${clientId}`;
const kgChange = (d: number) => `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(1)} kg`;

function readSaved(clientId: number): Partial<Saved> {
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY(clientId)) ?? "{}") as Partial<Saved>;
  } catch {
    return {};
  }
}

export default function CompareDialog({ clientId, sheets, initial, onOpenPhoto }: { clientId: number; sheets: Sheet[]; /** [earlier, later] to start on, when nothing is remembered. */ initial: string[]; /** A photo opened big (the lightbox), from these two. */ onOpenPhoto: (period: string, slotId: number) => void }) {
  const chrono = [...sheets].reverse();
  const has = (p: string | undefined | null): p is string => !!p && sheets.some((s) => s.period === p);
  // The angles any sheet has, in the coach's order (the newest sheet's first).
  const angles: { slotId: number; label: string }[] = [];
  for (const s of sheets) for (const c of s.cells) if (!angles.some((x) => x.slotId === c.slotId)) angles.push({ slotId: c.slotId, label: c.label });
  const [state, setState] = useState<Saved>(() => {
    const saved = typeof window === "undefined" ? {} : readSaved(clientId);
    const a = has(saved.a) ? saved.a : (initial[0] ?? chrono[0]?.period ?? "");
    const b = has(saved.b) && saved.b !== a ? saved.b : (initial[1] ?? sheets[0]?.period ?? "");
    const slot = saved.slot != null && angles.some((x) => x.slotId === saved.slot) ? saved.slot : (angles[0]?.slotId ?? null);
    return { a, b, slot, view: saved.view === "slider" ? "slider" : "side" };
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem(KEY(clientId), JSON.stringify(state));
    } catch {
      /* private window: not remembered */
    }
  }, [clientId, state]);
  const left = sheets.find((s) => s.period === state.a) ?? null;
  const right = sheets.find((s) => s.period === state.b) ?? null;
  const angle = angles.find((x) => x.slotId === state.slot) ?? null;
  // Picking the week the other side shows swaps the two.
  const pick = (side: "a" | "b", period: string) =>
    setState((s) => {
      const other = side === "a" ? s.b : s.a;
      if (period === other) return { ...s, a: s.b, b: s.a };
      return { ...s, [side]: period };
    });
  const cellOf = (sh: Sheet | null) => (sh && state.slot != null ? (sh.cells.find((c) => c.slotId === state.slot) ?? null) : null);
  const change = left?.weight != null && right?.weight != null ? Math.round((right.weight - left.weight) * 10) / 10 : null;

  return (
    <DialogContent className="dlh cmp" aria-label="Compare progress pictures">
      <div className="cmp-head">
        <DialogTitle className="dlh-title">Compare</DialogTitle>
        <div className="rd-btn-group cmp-view" role="radiogroup" aria-label="View">
          {(
            [
              ["side", "Side by side"],
              ["slider", "Slider"],
            ] as const
          ).map(([v, label]) => (
            <button key={v} type="button" role="radio" aria-checked={state.view === v} className={state.view === v ? "on" : ""} onClick={() => setState((s) => ({ ...s, view: v }))}>
              {label}
            </button>
          ))}
        </div>
        <DialogClose className="dlh-x" aria-label="Close">
          ✕
        </DialogClose>
      </div>
      <DialogDescription className="sr-only">Two sheets side by side, one angle at a time</DialogDescription>

      <div className="cmp-weeks">
        <WeekPicker label="First week" value={state.a} sheets={chrono} onPick={(p) => pick("a", p)} />
        <span className="cmp-vs">vs</span>
        <WeekPicker label="Second week" value={state.b} sheets={chrono} onPick={(p) => pick("b", p)} />
      </div>

      {angles.length > 1 && (
        <div className="rd-btn-group cmp-angles" role="radiogroup" aria-label="Angle" style={{ "--cmp-n": angles.length } as React.CSSProperties}>
          {angles.map((x) => (
            <button key={x.slotId} type="button" role="radio" aria-checked={state.slot === x.slotId} className={state.slot === x.slotId ? "on" : ""} onClick={() => setState((s) => ({ ...s, slot: x.slotId }))}>
              {x.label}
            </button>
          ))}
        </div>
      )}

      {state.view === "side" ? (
        <div className="cmp-side">
          {[left, right].map((sh, i) => {
            const c = cellOf(sh);
            return (
              <figure key={i} className="cmp-col">
                <Photo src={c?.src ?? null} alt={sh && angle ? `${angle.label}, ${sh.title}` : ""} onOpen={sh && c?.src ? () => onOpenPhoto(sh.period, c.slotId) : undefined} />
                <figcaption className="cmp-cap">
                  <span>{sh?.title ?? "—"}</span>
                  <span className="cmp-kg">
                    {i === 1 && change != null && Math.abs(change) >= 0.05 && <em>{kgChange(change)}</em>}
                    {sh?.weight == null ? "—" : `${sh.weight} kg`}
                  </span>
                </figcaption>
              </figure>
            );
          })}
        </div>
      ) : (
        <Reveal left={left} right={right} leftSrc={cellOf(left)?.src ?? null} rightSrc={cellOf(right)?.src ?? null} angle={angle?.label ?? ""} />
      )}
    </DialogContent>
  );
}

/** A week to compare, picked from the admin's floating menu: the sheets oldest first, words only. */
function WeekPicker({ label, value, sheets, onPick }: { label: string; value: string; sheets: Sheet[]; onPick: (period: string) => void }) {
  const current = sheets.find((s) => s.period === value);
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className="cmp-week" aria-label={`${label}: ${current?.title ?? "none"}`}>
        <span>{current?.title ?? "—"}</span>
        <ChevronDownIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="pb-menu cmp-menu">
        {sheets.map((s) => (
          <DropdownMenuCheckboxItem key={s.period} checked={s.period === value} onCheckedChange={() => onPick(s.period)}>
            {s.title}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One photo, 3:4, the field behind it until it has loaded; a camera on the field when there is none. */
function Photo({ src, alt, onOpen }: { src: string | null; alt: string; onOpen?: () => void }) {
  if (!src)
    return (
      <span className="cmp-photo none" aria-label={alt ? `${alt}, no photo` : "No photo"}>
        <CameraIcon />
      </span>
    );
  return (
    <button type="button" className="cmp-photo" onClick={onOpen} aria-label={`Open ${alt} big`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- client-uploaded file */}
      <img src={src} alt={alt} />
    </button>
  );
}

/** The slider: one stage, the right week underneath, the left on top cut at the divider; drag anywhere, or ← → by 5. */
function Reveal({ left, right, leftSrc, rightSrc, angle }: { left: Sheet | null; right: Sheet | null; leftSrc: string | null; rightSrc: string | null; angle: string }) {
  const [pos, setPos] = useState(50);
  const stage = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const at = (clientX: number) => {
    const r = stage.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const a = left?.title ?? "—";
  const b = right?.title ?? "—";
  return (
    <div className="cmp-reveal">
      <div
        ref={stage}
        className="cmp-stage"
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          at(e.clientX);
        }}
        onPointerMove={(e) => dragging.current && at(e.clientX)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {rightSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
          <img className="cmp-under" src={rightSrc} alt={`${angle}, ${b}`} draggable={false} />
        ) : (
          <span className="cmp-under cmp-empty">
            <CameraIcon />
          </span>
        )}
        <div className="cmp-over" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
          {leftSrc ? (
            // eslint-disable-next-line @next/next/no-img-element -- client-uploaded file
            <img src={leftSrc} alt={`${angle}, ${a}`} draggable={false} />
          ) : (
            <span className="cmp-empty">
              <CameraIcon />
            </span>
          )}
        </div>
        <span className="cmp-line" style={{ left: `${pos}%` }} aria-hidden="true" />
        <span
          className="cmp-handle"
          style={{ left: `${pos}%` }}
          role="slider"
          tabIndex={0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pos)}
          aria-label={`Reveal ${a} / ${b}`}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") {
              e.preventDefault();
              setPos((p) => Math.max(0, p - 5));
            }
            if (e.key === "ArrowRight") {
              e.preventDefault();
              setPos((p) => Math.min(100, p + 5));
            }
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </span>
      </div>
      <div className="cmp-cap cmp-stagecap">
        <span>{a}</span>
        <span>{b}</span>
      </div>
    </div>
  );
}
