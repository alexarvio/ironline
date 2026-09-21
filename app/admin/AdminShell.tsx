"use client";

import { ReactNode, useSyncExternalStore } from "react";
import { ChevronDownIcon } from "../components/icons";

// Three columns: the client list, the working area, and everything else true
// about the client.
//
// The shell itself never scrolls — `overflow:hidden` on the outer box and
// each column owning its own scroll. A coach deep in week 6 of a programme
// should not lose the client list or the snapshot by scrolling the page.
//
// The right column collapses to a thin strip so the programme builder can
// take the full width when the coach is heads-down in it. The choice is
// remembered per browser via localStorage; nothing about it is client data.
// Read through useSyncExternalStore so the server render and the first
// client render agree (open), then the stored choice applies without an
// effect-driven second render.
const PANEL_KEY = "ironline.admin.panelOpen";
const CHANGE_EVENT = "ironline:panel";

function readPanelOpen(): boolean {
  try {
    return window.localStorage.getItem(PANEL_KEY) !== "0";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function writePanelOpen(open: boolean) {
  try {
    window.localStorage.setItem(PANEL_KEY, open ? "1" : "0");
  } catch {
    /* private mode or blocked storage: the toggle still works for this render */
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The chevron in the client panel's header that folds the panel away. */
export function PanelCollapseButton() {
  return (
    <button
      type="button"
      className="ad-panel-collapse"
      onClick={() => writePanelOpen(false)}
      aria-expanded={true}
      aria-label="Hide the client panel"
      title="Hide the client panel"
    >
      <ChevronDownIcon />
    </button>
  );
}

export default function AdminShell({
  sidebar,
  panel,
  children,
}: {
  sidebar: ReactNode;
  panel?: ReactNode;
  children: ReactNode;
}) {
  const panelOpen = useSyncExternalStore(subscribe, readPanelOpen, () => true);
  const collapsed = !!panel && !panelOpen;

  return (
    // With no panel at all the third column goes entirely, rather than
    // leaving its width empty beside the work.
    <div className={`ad-shell${panel ? "" : " no-panel"}${collapsed ? " panel-collapsed" : ""}`}>
      <aside className="ad-sidebar">{sidebar}</aside>
      <main className="ad-main">{children}</main>
      {panel && (
        <aside className="ad-panel-col" aria-label="Client overview">
          {/* Open, the panel's own header carries the collapse chevron
              (PanelCollapseButton); collapsed, this strip brings it back. */}
          {!panelOpen && (
            <button
              type="button"
              className="ad-panel-toggle"
              onClick={() => writePanelOpen(true)}
              aria-expanded={false}
              title="Show the client panel"
            >
              <span aria-hidden="true">‹</span>
              <span className="sr-only">Show client panel</span>
            </button>
          )}
          {panelOpen && <div className="ad-panel-body">{panel}</div>}
        </aside>
      )}
    </div>
  );
}
