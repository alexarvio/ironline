"use client";

import { ReactNode, useState } from "react";

export type TabSection = { id: string; label: string; content: ReactNode };

// The section tabs under the client header. The bar scrolls horizontally
// with its scrollbar hidden (there are eleven of these and a visible track
// under a row of tabs reads as a broken layout), and only the active
// section's content is mounted.
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
    <>
      <div className="ad-tabbar" role="tablist">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === activeId}
            className={`ad-tab${s.id === activeId ? " active" : ""}`}
            onClick={() => setActiveId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="ad-tab-panel">{active?.content}</div>
    </>
  );
}
