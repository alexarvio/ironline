"use client";

import { ReactNode, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { markSeenAction } from "../lib/actions";

export type TabSection = {
  id: string;
  label: string;
  content: ReactNode;
  /** Something new from the client on this tab that the coach has not seen. */
  dot?: boolean;
  /** Home's count of what is new. */
  count?: number;
};

// The section tabs under the client header. The bar scrolls horizontally
// with its scrollbar hidden (there are eleven of these and a visible track
// under a row of tabs reads as a broken layout), and only the active
// section's content is mounted.
export default function SectionTabs({
  clientId,
  sections,
  initialId,
}: {
  clientId: number;
  sections: TabSection[];
  initialId?: string;
}) {
  const [activeId, setActiveId] = useState(
    initialId && sections.some((s) => s.id === initialId) ? initialId : sections[0]?.id
  );
  // A link to another of this client's tabs (the feed's "See the week", a
  // notification) changes ?tab= in the address, and the tab follows it. A
  // save does not change the address, so nothing moves: this used to be
  // remounted whenever the server's idea of the tab changed, which the first
  // save after clicking a tab did — the builder jumped back to the live week
  // with every session folded, the open nutrition day closed.
  const tabParam = useSearchParams().get("tab");
  const [seenParam, setSeenParam] = useState(tabParam);
  if (tabParam !== seenParam) {
    setSeenParam(tabParam);
    if (tabParam && tabParam !== activeId && sections.some((s) => s.id === tabParam)) setActiveId(tabParam);
  }
  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  // Being on a tab is having seen it: its dot clears. News about one training
  // session stays new until that session is opened (its card has the dot).
  const activeDot = !!active?.dot;
  useEffect(() => {
    if (activeDot && activeId) void markSeenAction(clientId, { tab: activeId });
  }, [activeDot, activeId, clientId]);

  // One white card: the tabs across its top, the active section below.
  return (
    <div className="ad-tabs">
      <div className="ad-tabbar" role="tablist">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === activeId}
            className={`ad-tab${s.id === activeId ? " active" : ""}`}
            onClick={() => {
              setActiveId(s.id);
              // The tab lives in the address too, so a reload (a deploy landing
              // mid-edit, a refresh, a shared link) comes back to the same
              // section rather than the first one.
              const url = new URL(window.location.href);
              url.searchParams.set("tab", s.id);
              // The phase in the address was the old tab's; the new one opens on
              // its live phase and writes its own.
              if (s.id !== activeId) url.searchParams.delete("phase");
              // null, not window.history.state, so Next's router keeps the
              // new address: handed its own state back it ignored the write,
              // and the next save put the old tab back in the address.
              window.history.replaceState(null, "", url);
            }}
          >
            {s.label}
            {s.count ? <span className="ad-tab-count">{s.count}</span> : s.dot ? <span className="ad-tab-dot" aria-label="New" /> : null}
          </button>
        ))}
      </div>
      <div className="ad-tab-panel">{active?.content}</div>
    </div>
  );
}
