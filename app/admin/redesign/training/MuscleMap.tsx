"use client";

import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { MUSCLES, type MuscleGroup, type MuscleMapData } from "../../../lib/muscles";
import { anatomy, type AnatomyBody, type AnatomyView } from "./muscleAnatomy";
import { Fold } from "../Fold";
import { SepJoin } from "../Sep";

// The muscle map on Training (2 Nov, Alex: docs/boards/muscle-map-v2.html): one hairline card row under the weeks,
// `Muscle map` and its Fold, closed at first. Open, the group chips and Phase | Split, the front and back plates (no names
// on the muscles, "just the muscles, the fibres"), the ranked list and the 0-to-most legend. Zero sets grey; more sets a
// deeper training purple on the fill and the fibres, scaled to the window's most-trained muscle. A muscle clicked, on the
// body or in the list, opens a pop-over by it: its anatomical name, its sets, the exercises behind them. Styles `mm-` in
// draft.css; the anatomy is muscleAnatomy.ts.

type Win = "phase" | "split";
const GROUPS: { g: MuscleGroup; label: string }[] = [
  { g: "chest", label: "Chest" },
  { g: "back", label: "Back" },
  { g: "shoulders", label: "Shoulders" },
  { g: "arms", label: "Arms" },
  { g: "core", label: "Core" },
  { g: "legs", label: "Legs" },
];
const NAME = new Map<string, string>(MUSCLES.map((m) => [m.key, m.name]));
/** A tracked muscle's anatomical name, for a pop-over opened from the list (the body says its own patch's). */
const ANATOMICAL: Record<string, string> = {
  chest_upper: "Pectoralis major, clavicular head",
  chest_mid: "Pectoralis major, sternal head",
  chest_lower: "Pectoralis major, abdominal head",
  delt_front: "Deltoid, anterior",
  delt_side: "Deltoid, lateral",
  delt_rear: "Deltoid, posterior",
  traps_upper: "Trapezius, upper",
  mid_back: "Rhomboids and trapezius",
  lats: "Latissimus dorsi",
  lower_back: "Erector spinae",
  biceps: "Biceps brachii",
  triceps: "Triceps brachii",
  forearms: "Forearm flexors and extensors",
  abs_upper: "Rectus abdominis, upper",
  abs_lower: "Rectus abdominis, lower",
  obliques: "External oblique",
  glutes: "Gluteus maximus",
  glute_med: "Gluteus medius",
  quads: "Quadriceps femoris",
  hamstrings: "Hamstrings",
  adductors: "Adductors",
  calves: "Gastrocnemius and soleus",
};

/* ---- colour, as the board: zero grey, then deeper purple with the sets */
type RGB = [number, number, number];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
type Stops = [number, RGB][];
const RAMP: Stops = [[0, hex("#E3E0F5")], [0.35, hex("#BCB7E4")], [0.68, hex("#7A73CC")], [1, hex("#3a3390")]];
const FILL: Stops = [[0, hex("#E9E7F6")], [0.5, hex("#C9C5EC")], [1, hex("#9F99DC")]];
const FIBRE: Stops = [[0, hex("#A7A1DE")], [0.5, hex("#5a53b8")], [1, hex("#2a2475")]];
const SHADE: Stops = [[0, hex("#C2BDE8")], [1, hex("#5a53b8")]];
function mix(stops: Stops, t: number): string {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], u = (t - a[0]) / (b[0] - a[0]);
      const c = a[1].map((v, j) => Math.round(v + (b[1][j] - v) * u));
      return `rgb(${c[0]},${c[1]},${c[2]})`;
    }
  }
  const c = stops[stops.length - 1][1];
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

const fmt = (v: number) => (Math.round(v * 10) / 10).toString();
const setsWord = (v: number) => `${fmt(v)} ${v === 1 ? "set" : "sets"}`;

/** What is picked: a patch on the body (its name, both sides) or a muscle from the list (every patch of its key). */
type Pick = { id: string; key: string; name: string; byKey: boolean; from: "body" | "list"; anchor: { x: number; y: number; w: number; h: number }; prefer: "left" | "right" };
type Look = { mf: string; fb: string; sh: string };

export default function MuscleMap({ data }: { data: MuscleMapData }) {
  const [open, setOpen] = useState(false);
  return (
    <section className={`mm${open ? " open" : ""}`}>
      <button type="button" className="mm-head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="mm-title">Muscle map</span>
        <Fold open={open} />
      </button>
      {open && <MuscleMapBody data={data} />}
    </section>
  );
}

function MuscleMapBody({ data }: { data: MuscleMapData }) {
  const [win, setWin] = useState<Win>("phase");
  const [on, setOn] = useState<Record<MuscleGroup, boolean>>({ chest: true, back: true, shoulders: true, arms: true, core: true, legs: true });
  const [pick, setPick] = useState<Pick | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const body: AnatomyBody = data.body === "female" ? "female" : "male";
  const load = data[win];
  const when = win === "phase" ? "this phase" : "this week";

  const keys = useMemo(() => MUSCLES.filter((m) => on[m.group]).map((m) => m.key as string), [on]);
  const max = useMemo(() => Math.max(1e-6, ...keys.map((k) => load[k]?.sets ?? 0)), [keys, load]);
  const looks = useMemo(() => {
    const out: Record<string, Look | null> = {};
    for (const m of MUSCLES) {
      const s = on[m.group] ? (load[m.key]?.sets ?? 0) : 0;
      out[m.key] = s > 0 ? { mf: mix(FILL, s / max), fb: mix(FIBRE, s / max), sh: mix(SHADE, s / max) } : null;
    }
    return out;
  }, [on, load, max]);
  const off = useMemo(() => new Set(MUSCLES.filter((m) => !on[m.group]).map((m) => m.key as string)), [on]);
  const ranked = useMemo(() => keys.map((k) => ({ k, v: load[k]?.sets ?? 0 })).sort((a, b) => b.v - a.v), [keys, load]);
  const lowN = Math.min(3, Math.max(0, ranked.length - 3));

  /** Where a thing is, in the box the pop-over lives in. */
  const placeOf = (r: DOMRect, y?: number) => {
    const box = boxRef.current!, c = box.getBoundingClientRect();
    // In the box's own pixels: `k` undoes a CSS zoom or transform above it.
    const k = c.width / box.offsetWidth || 1;
    return y == null
      ? { x: (r.left - c.left) / k, y: (r.top - c.top) / k, w: r.width / k, h: r.height / k }
      : { x: (r.left - c.left) / k, y: (y - c.top) / k, w: r.width / k, h: 0 };
  };
  const choose = (next: Pick, from: HTMLElement | null) => {
    if (pick?.id === next.id) {
      setPick(null);
      return;
    }
    returnTo.current = from;
    setPick(next);
  };

  const onPlateClick = (e: React.MouseEvent) => {
    const g = (e.target as Element).closest<SVGGElement>("[data-name]");
    if (!g) return;
    const key = g.dataset.muscle ?? "", name = g.dataset.name ?? "";
    // Out from the body's middle, so the muscle and its twin on the other side stay in sight.
    const r = g.getBoundingClientRect(), s = g.ownerSVGElement!.getBoundingClientRect();
    const prefer = r.left + r.width / 2 < s.left + s.width / 2 ? "left" : "right";
    choose({ id: `b|${name}|${key}`, key, name, byKey: false, from: "body", anchor: placeOf(r, e.clientY), prefer }, null);
  };
  const onRowClick = (k: string, el: HTMLElement) => {
    choose({ id: `k|${k}`, key: k, name: ANATOMICAL[k] ?? NAME.get(k) ?? k, byKey: true, from: "list", anchor: placeOf(el.getBoundingClientRect()), prefer: "left" }, el);
  };

  // The pop-over beside what was clicked: on the side it prefers, else the other, else under it; always inside the box.
  useLayoutEffect(() => {
    const el = popRef.current, box = boxRef.current;
    if (!pick || !el || !box) return;
    const W = el.offsetWidth, Hh = el.offsetHeight, CW = box.clientWidth, CH = box.clientHeight, a = pick.anchor, gap = 10;
    const right = a.x + a.w + gap, left = a.x - gap - W;
    let x = pick.prefer === "left" ? (left >= 0 ? left : right) : right + W <= CW ? right : left;
    let y = a.y + a.h / 2 - Hh / 2;
    if (x < 0 || x + W > CW) {
      x = Math.min(Math.max(0, a.x + a.w / 2 - W / 2), Math.max(0, CW - W));
      y = a.y + a.h + gap;
    }
    y = Math.min(Math.max(0, y), Math.max(0, CH - Hh));
    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.style.visibility = "visible";
  }, [pick, win]);

  // Esc, or a click anywhere else, closes it (a muscle or a row clicked handles itself).
  useEffect(() => {
    if (!pick) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      setPick(null);
      returnTo.current?.focus();
    };
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || popRef.current?.contains(t)) return;
      if (boxRef.current?.contains(t) && t.closest("[data-name], .mm-row")) return;
      setPick(null);
    };
    document.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", down, true);
    return () => {
      document.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", down, true);
    };
  }, [pick]);

  const lit = pick ? { key: pick.key, name: pick.byKey ? null : pick.name } : null;
  const picked = pick ? load[pick.key] : undefined;
  const tracked = !!pick?.key;
  const shown = picked?.exercises.slice(0, 8) ?? [];
  const more = (picked?.exercises.length ?? 0) - shown.length;
  const short = pick ? NAME.get(pick.key) : undefined;

  return (
    <div className="mm-open">
      <div className="mm-ctrls">
        <div className="mm-chips" role="group" aria-label="Muscle groups">
          {GROUPS.map(({ g, label }) => (
            <button key={g} type="button" className="mm-chip" aria-pressed={on[g]} onClick={() => setOn((o) => ({ ...o, [g]: !o[g] }))}>
              {label}
            </button>
          ))}
        </div>
        <div className="rd-btn-group" role="radiogroup" aria-label="Window">
          {(["phase", "split"] as const).map((w) => (
            <button key={w} type="button" role="radio" aria-checked={win === w} className={win === w ? "on" : ""} onClick={() => setWin(w)}>
              {w === "phase" ? "Phase" : "Split"}
            </button>
          ))}
        </div>
      </div>

      <div className="mm-box" ref={boxRef}>
        <div className="mm-plate" onClick={onPlateClick}>
          {(["front", "back"] as const).map((v) => (
            <div key={v} className="mm-view">
              <Plate view={v} body={body} looks={looks} off={off} lit={lit} hover={hover} />
              <div className="mm-cap">{v === "front" ? "Front" : "Back"}</div>
            </div>
          ))}
        </div>

        <div className="mm-side">
          <div className="mm-side-head">{win === "phase" ? "Sets this phase" : "Sets this week"}</div>
          <div className="mm-list">
            {ranked.length ? (
              ranked.map(({ k, v }, i) => {
                const lo = i >= ranked.length - lowN;
                return (
                  <button
                    key={k}
                    type="button"
                    className={`mm-row${lo ? " lo" : ""}${pick?.id === `k|${k}` ? " on" : ""}`}
                    aria-haspopup="dialog"
                    aria-expanded={pick?.id === `k|${k}`}
                    onClick={(e) => onRowClick(k, e.currentTarget)}
                    onMouseEnter={() => setHover(k)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(k)}
                    onBlur={() => setHover(null)}
                  >
                    {lo ? <span className="mm-flag" title="Least trained" /> : <span className="mm-rk">{i + 1}</span>}
                    <span className="mm-nm">{NAME.get(k)}</span>
                    <span className="mm-bar">
                      <i style={{ width: `${((v / max) * 100).toFixed(1)}%`, backgroundColor: v > 0 ? mix(RAMP, v / max) : "transparent" }} />
                    </span>
                    <span className="mm-val">{fmt(v)}</span>
                  </button>
                );
              })
            ) : (
              <div className="mm-empty">None</div>
            )}
          </div>
          <div className="mm-legend" aria-hidden="true">
            <div className="mm-sw">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <i key={i} style={i ? { background: `repeating-linear-gradient(100deg, ${mix(FIBRE, i / 5)} 0 1px, transparent 1px 3px), ${mix(FILL, i / 5)}` } : undefined} />
              ))}
            </div>
            <div className="mm-lgl">
              <span>0</span>
              <span>{setsWord(ranked.length ? (max > 1e-6 ? max : 0) : 0)}</span>
            </div>
          </div>
        </div>

        {pick && (
          <div className="mm-pop" ref={popRef} role="dialog" aria-label={pick.name} style={{ visibility: "hidden" }}>
            <div className="mm-pop-name">{pick.name}</div>
            <div className="mm-pop-fact">
              {!tracked ? (
                "Not counted"
              ) : (
                <SepJoin parts={[short !== pick.name && short, picked && picked.sets > 0 ? `${setsWord(picked.sets)} ${when}` : `None ${when}`]} />
              )}
            </div>
            {tracked && shown.length > 0 && (
              <div className="mm-pop-list">
                {shown.map((x) => (
                  <div key={x.name} className="mm-pop-row">
                    <span className="mm-pop-ex">{x.name}</span>
                    <span className="mm-pop-sets">{fmt(x.sets)}</span>
                  </div>
                ))}
                {more > 0 && <div className="mm-pop-more">+{more} more</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** One plate. The drawing is made once per view and body; only the colours, the off groups and the outline change. */
const Plate = memo(function Plate({
  view,
  body,
  looks,
  off,
  lit,
  hover,
}: {
  view: AnatomyView;
  body: AnatomyBody;
  looks: Record<string, Look | null>;
  off: Set<string>;
  lit: { key: string; name: string | null } | null;
  hover: string | null;
}) {
  const a = useMemo(() => anatomy(view, body), [view, body]);
  return (
    <svg className="mm-svg" viewBox={a.viewBox} aria-label={view === "front" ? "Front" : "Back"} role="img">
      <g dangerouslySetInnerHTML={{ __html: a.under }} />
      {a.parts.map((p, i) => {
        if (p.kind === "skin") return <g key={i} dangerouslySetInnerHTML={{ __html: p.inner }} />;
        const look = p.key ? looks[p.key] : null;
        const cls = ["mm-m", p.kind !== "muscle" && `mm-${p.kind}`, p.key && off.has(p.key) && "mm-off", hover && p.key === hover && "mm-hl"].filter(Boolean).join(" ");
        const style = look ? ({ "--mf": look.mf, "--fb": look.fb, "--sh": look.sh } as React.CSSProperties) : undefined;
        return <g key={i} className={cls} data-muscle={p.key} data-name={p.name} style={style} dangerouslySetInnerHTML={{ __html: p.inner }} />;
      })}
      <g dangerouslySetInnerHTML={{ __html: a.over }} />
      {/* The muscle picked: its outline in ink over everything, so a neighbour drawn after it never covers half of it. */}
      {lit &&
        a.parts.map((p, i) =>
          p.kind !== "skin" && p.key === lit.key && (lit.name == null || p.name === lit.name) ? <path key={i} className="mm-lit" d={p.d} /> : null,
        )}
    </svg>
  );
});
