"use client";

import { useEffect, useRef, useState } from "react";
import { placePopover, type Placement } from "../components/popover";

const PANEL_WIDTH = 268;
import {
  addTrainingColumnAction,
  removeCustomTrainingColumnAction,
  setBuiltinColumnVisibleAction,
  setCardioColumnVisibleAction,
  setTrainingColumnVisibleAction,
} from "../lib/actions";
import { ChevronDownIcon, DumbbellIcon, HeartbeatIcon } from "../components/icons";

// What the coach prescribes by, chosen once for the client rather than per
// session: it changes every week of every programme, so it belongs beside the
// programme's name, not in a week's toolbar.
//
// Two menus, one for lifts and one for cardio. Each lists every option the
// same width, lit when it is on, with the coach's own columns carrying a
// delete. Notes is deliberately absent from the lift list: it is on every row
// always, so there is nothing to choose.
export type ColumnChoice = {
  id: number | null;
  key: string;
  label: string;
  kind: "builtin" | "custom";
  visible: boolean;
};

export default function ColumnMenus({
  clientId,
  choices,
  cardio,
  max,
}: {
  clientId: number;
  choices: ColumnChoice[];
  cardio: { key: string; label: string; visible: boolean }[];
  max: number;
}) {
  const [open, setOpen] = useState<"exercise" | "cardio" | null>(null);
  const [adding, setAdding] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  // Same reason as the gyms menu and the exercise picker: these sit in a
  // toolbar inside .ad-main, which scrolls, so an absolute panel is clipped
  // by that column. See components/popover.ts.
  const exerciseBtn = useRef<HTMLButtonElement>(null);
  const cardioBtn = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<Placement | null>(null);
  const place = (which: "exercise" | "cardio") =>
    setPos(placePopover((which === "exercise" ? exerciseBtn : cardioBtn).current, { width: PANEL_WIDTH, maxHeight: 460, gap: 6 }));

  // A click outside or Escape closes whichever menu is open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeCount = choices.filter((c) => c.visible).length;
  const atCap = activeCount >= max;
  const cardioCount = cardio.filter((c) => c.visible).length;

  return (
    <div className="pb-colmenus" ref={wrap}>
      <div className="pb-colmenu">
        <button
          ref={exerciseBtn}
          type="button"
          className={`pb-colmenu-btn${open === "exercise" ? " open" : ""}`}
          aria-expanded={open === "exercise"}
          onClick={() => {
            if (open !== "exercise") place("exercise");
            setOpen((o) => (o === "exercise" ? null : "exercise"));
          }}
        >
          <DumbbellIcon />
          Exercise columns
          <span className="pb-colmenu-count">
            {activeCount}/{max}
          </span>
          <span className="pb-colmenu-caret" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>

        {open === "exercise" && (
          <div
            className="pb-colmenu-panel"
            role="dialog"
            aria-label="Exercise columns"
            style={pos ?? undefined}
          >
            <p className="pb-colmenu-hint">
              What every exercise is prescribed by. {max} at a time; Notes is always on.
            </p>
            <div className="pb-colmenu-grid">
              {choices.map((c) => (
                <span key={c.key} className="pb-colmenu-item">
                  <form action={c.kind === "custom" ? setTrainingColumnVisibleAction : setBuiltinColumnVisibleAction}>
                    <input type="hidden" name="clientId" value={clientId} />
                    {c.kind === "custom" ? <input type="hidden" name="id" value={c.id ?? ""} /> : <input type="hidden" name="key" value={c.key} />}
                    <input type="hidden" name="visible" value={c.visible ? "false" : "true"} />
                    <button
                      type="submit"
                      className={`pb-colmenu-opt${c.visible ? " on" : ""}`}
                      disabled={!c.visible && atCap}
                      title={!c.visible && atCap ? `Switch one off first. ${max} columns is the maximum` : c.visible ? `Hide ${c.label}` : `Show ${c.label}`}
                    >
                      {c.label}
                    </button>
                  </form>
                  {/* A column the coach made themselves can also go, and what
                      was typed in it on every exercise goes with it. */}
                  {c.kind === "custom" && c.id != null && (
                    <form action={removeCustomTrainingColumnAction}>
                      <input type="hidden" name="id" value={c.id} />
                      <button
                        type="submit"
                        className="pb-colmenu-del"
                        aria-label={`Delete the ${c.label} column`}
                        title={`Delete the ${c.label} column`}
                        onClick={(e) => {
                          if (!window.confirm(`Delete the ${c.label} column? What was typed in it on every exercise goes with it.`)) e.preventDefault();
                        }}
                      >
                        ×
                      </button>
                    </form>
                  )}
                </span>
              ))}
            </div>

            {adding ? (
              <form action={addTrainingColumnAction} className="pb-colmenu-add" onSubmit={() => setAdding(false)}>
                <input type="hidden" name="clientId" value={clientId} />
                <input name="label" type="text" placeholder="Name, e.g. Band" aria-label="New column" autoFocus maxLength={20} onKeyDown={(e) => e.key === "Escape" && setAdding(false)} />
                <button type="submit">Add</button>
              </form>
            ) : (
              <button type="button" className="pb-colmenu-new" onClick={() => setAdding(true)} disabled={atCap} title={atCap ? `Switch one off first. ${max} columns is the maximum` : undefined}>
                + Column of your own
              </button>
            )}
          </div>
        )}
      </div>

      <div className="pb-colmenu">
        <button
          ref={cardioBtn}
          type="button"
          className={`pb-colmenu-btn${open === "cardio" ? " open" : ""}`}
          aria-expanded={open === "cardio"}
          onClick={() => {
            if (open !== "cardio") place("cardio");
            setOpen((o) => (o === "cardio" ? null : "cardio"));
          }}
        >
          <HeartbeatIcon />
          Cardio columns
          <span className="pb-colmenu-count">{cardioCount}</span>
          <span className="pb-colmenu-caret" aria-hidden="true">
            <ChevronDownIcon />
          </span>
        </button>

        {open === "cardio" && (
          <div
            className="pb-colmenu-panel"
            role="dialog"
            aria-label="Cardio columns"
            style={pos ?? undefined}
          >
            <p className="pb-colmenu-hint">What a run, a row or a walk is prescribed by. Notes is always on.</p>
            <div className="pb-colmenu-grid">
              {cardio.map((c) => (
                <span key={c.key} className="pb-colmenu-item">
                  <form action={setCardioColumnVisibleAction}>
                    <input type="hidden" name="clientId" value={clientId} />
                    <input type="hidden" name="key" value={c.key} />
                    <input type="hidden" name="visible" value={c.visible ? "false" : "true"} />
                    <button type="submit" className={`pb-colmenu-opt${c.visible ? " on" : ""}`} title={c.visible ? `Hide ${c.label}` : `Show ${c.label}`}>
                      {c.label}
                    </button>
                  </form>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
