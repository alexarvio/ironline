"use client";

import { ReactNode, useState } from "react";

export type TabSection = { id: string; label: string; content: ReactNode };

export default function SectionTabs({
  sections,
  initialId,
}: {
  sections: TabSection[];
  initialId?: string;
}) {
  const [activeId, setActiveId] = useState(
    initialId && sections.some((s) => s.id === initialId) ? initialId : sections[0]?.id
  );
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div className="section-tabs">
      <div className="tab-bar" role="tablist">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === activeId}
            className={`tab-item${s.id === activeId ? " active" : ""}`}
            onClick={() => setActiveId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="tab-panel">{active?.content}</div>
    </div>
  );
}
