"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addGymAction, removeGymAction } from "../lib/actions";

// The client's gyms: one pill at the far right of the programme row that
// opens a small list to add or delete them. Only the coach keeps this list;
// the client picks from it at the top of a session once there are two. With
// two or more, the Weight column gets a box per gym.
export default function GymChipRow({ clientId, gyms }: { clientId: number; gyms: { id: number; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [pending, start] = useTransition();
  const wrap = useRef<HTMLDivElement>(null);

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
      <button type="button" className={`pb-gyms-pill${open ? " open" : ""}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        Client gyms
        <span className="pb-gyms-count">{gyms.length}</span>
        <span className="pb-gyms-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="pb-gyms-menu" role="dialog" aria-label="Client gyms">
          <div className="pb-gyms-title">Gyms this client trains at</div>

          {gyms.length === 0 ? (
            <p className="pb-gyms-empty">None yet. Add the gyms the client trains at; each keeps its own weights.</p>
          ) : (
            <ul className="pb-gyms-list">
              {gyms.map((g) => (
                <li key={g.id} className="pb-gyms-row">
                  <span className="pb-gyms-name">{g.name}</span>
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
