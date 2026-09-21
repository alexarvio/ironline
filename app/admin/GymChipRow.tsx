"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addGymAction, removeGymAction, setHomeGymAction } from "../lib/actions";
import { ChevronDownIcon, HomeIcon } from "../components/icons";
import { placePopover, type Placement } from "../components/popover";

const MENU_WIDTH = 320;

// The client's gyms: one pill at the far right of the programme row that
// opens a small list to add or delete them. Only the coach keeps this list;
// the client picks from it at the top of a session once there are two. With
// two or more, the Weight column gets a box per gym.
export default function GymChipRow({ clientId, gyms }: { clientId: number; gyms: { id: number; name: string; home?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLButtonElement>(null);
  // Fixed and measured rather than absolute: .ad-main scrolls, and CSS will
  // not let one axis scroll while the other stays visible, so that column
  // clips horizontally too. This menu hangs off the right edge of a pill
  // near the left of it, and half of it was being cut away.
  const [pos, setPos] = useState<Placement | null>(null);
  const place = () => setPos(placePopover(pill.current, { width: MENU_WIDTH, align: "right", gap: 6 }));

  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  // A click outside or Escape closes the list.
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

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newName.trim();
    if (!clean) return;
    start(async () => {
      await addGymAction(clientId, clean);
      setNewName("");
    });
  };

  return (
    <div className="pb-gyms" ref={wrap}>
      <button
        ref={pill}
        type="button"
        className={`pb-gyms-pill${open ? " open" : ""}`}
        aria-expanded={open}
        onClick={() => {
          if (!open) place();
          setOpen((o) => !o);
        }}
      >
        Client gyms
        <span className="pb-gyms-count">{gyms.length}</span>
        <span className="pb-gyms-caret" aria-hidden="true"><ChevronDownIcon /></span>
      </button>

      {open && (
        <div
          className="pb-gyms-menu"
          role="dialog"
          aria-label="Client gyms"
          style={pos ?? undefined}
        >
          <div className="pb-gyms-title">Gyms this client trains at</div>
          <p className="pb-gyms-hint">The house marks the one they train at most.</p>

          {gyms.length === 0 ? (
            <p className="pb-gyms-empty">None yet. Add the gyms the client trains at; each keeps its own weights.</p>
          ) : (
            <ul className="pb-gyms-list">
              {gyms.map((g) => (
                <li key={g.id} className={`pb-gyms-row${g.home ? " home" : ""}`}>
                  <span className="pb-gyms-name">{g.name}</span>
                  {/* The one the client trains at most. Its weights are the
                      plain targets; the others keep their own.

                      A bare house beside Delete, lit when it is the main gym.
                      It used to be a circled icon with a tick on it and the
                      word "Main" beside the name — three things saying one
                      thing, at the start of a row whose subject is the gym. */}
                  <button
                    type="button"
                    className={`pb-gyms-home${g.home ? " on" : ""}`}
                    disabled={pending}
                    aria-pressed={!!g.home}
                    title={g.home ? `${g.name} is the main gym` : `Make ${g.name} the main gym`}
                    onClick={() => !g.home && start(() => setHomeGymAction(g.id))}
                  >
                    <HomeIcon />
                  </button>
                  <button
                    type="button"
                    className="pb-gyms-btn danger"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Delete ${g.name}? Sets logged there stay.`)) start(() => removeGymAction(g.id));
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form className="pb-gyms-form add" onSubmit={add}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Add a gym, e.g. PureGym" maxLength={40} aria-label="New gym" />
            <button type="submit" className="pb-gyms-btn primary" disabled={pending || !newName.trim()}>
              Add
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
