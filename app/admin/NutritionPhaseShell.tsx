"use client";

import { ReactNode, useState } from "react";
import AutosaveNote from "./AutosaveNote";

type PhaseChip = { id: number; name: string; status: "past" | "now" | "next"; range: string };

// The Nutrition tab's phase switcher. Each phase's targets-and-note editor
// is rendered on the server and handed in; this only decides which one
// shows and says whether the client is looking at it right now.
export default function NutritionPhaseShell({
  clientName,
  renderedAt,
  phases,
  editors,
}: {
  clientName: string;
  renderedAt: number;
  phases: PhaseChip[];
  editors: Record<number, ReactNode>;
}) {
  const initial = phases.find((p) => p.status === "now") ?? phases.find((p) => p.status === "next") ?? phases[0] ?? null;
  const [selectedId, setSelectedId] = useState<number>(initial?.id ?? 0);
  const selected = phases.find((p) => p.id === selectedId) ?? initial;
  const live = !selected || selected.status === "now";

  return (
    <>
      <div className="ms-topbar">
        <span className={`ms-topbar-live${live ? "" : " muted"}`}>
          <span className="ms-live-dot" aria-hidden="true" />
          {live
            ? `Live in ${clientName}\u2019s app`
            : selected?.status === "next"
            ? `${selected.name} starts ${selected.range.split(" – ")[0]} · not live yet`
            : `${selected?.name} has ended`}
        </span>
        <AutosaveNote renderedAt={renderedAt} savedText="Up to date" idleText="Up to date" idleAsSaved />
      </div>

      {phases.length > 0 && (
        <div className="pb-programs nt-phases">
          {phases.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pb-program-chip${p.id === selected?.id ? " active" : ""}`}
              onClick={() => setSelectedId(p.id)}
              title={p.range}
            >
              <span className="pb-program-name">{p.name}</span>
              <span className={`status-pill ${p.status === "now" ? "live" : p.status === "next" ? "draft" : "past"}`}>
                {p.status === "now" ? "Live" : p.status === "next" ? "Upcoming" : "Done"}
              </span>
              <span className="pb-program-weeks">{p.range}</span>
            </button>
          ))}
        </div>
      )}

      {editors[selected?.id ?? 0]}
    </>
  );
}
