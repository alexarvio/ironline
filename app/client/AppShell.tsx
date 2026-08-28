"use client";

import { ReactNode, useState } from "react";
import { BellIcon, ChatIcon, ChevronLeftIcon } from "../components/icons";

export type AppTab = { id: string; label: string; icon: ReactNode; content: ReactNode; footer?: ReactNode };

// Top bar is now brand + chat/bell icons (not a per-tab greeting) — chat
// opens as a pushed full-screen view with its own back header, independent
// of which bottom tab is active, so switching tabs underneath doesn't lose
// your place in the chat.
export default function AppShell({
  clientName,
  tabs,
  chatContent,
  chatBanner,
  hasCoachUpdate,
}: {
  clientName: string;
  tabs: AppTab[];
  chatContent: ReactNode;
  chatBanner?: ReactNode;
  hasCoachUpdate?: boolean;
}) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const [chatOpen, setChatOpen] = useState(false);
  // Bumped on every bottom-nav tap (including tapping the already-active
  // tab) and used as a key on the content below, so tapping Home while
  // already on Home resets HomeHub's internal sub-view instead of doing
  // nothing — there's no in-page back link anymore, so this is how "go
  // home" works from a sub-view like Photos or Tracker.
  const [navResetKey, setNavResetKey] = useState(0);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (chatOpen) {
    return (
      <div className="phone-frame">
        <div className="app-screen">
          <header className="app-push-header">
            <button type="button" className="app-back-btn" onClick={() => setChatOpen(false)} aria-label="Back">
              <ChevronLeftIcon />
            </button>
            <div className="app-push-header-avatar">C</div>
            <div className="app-push-header-identity">
              <div className="app-push-header-name">Coach</div>
              <div className="app-push-header-sub">Your coach</div>
            </div>
          </header>
          {chatBanner && <div className="app-chat-banner">{chatBanner}</div>}
          <main className="app-content app-content-flush">{chatContent}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      <div className="app-screen">
        <header className="app-header">
          <span className="app-header-brand">Ironline</span>
          <div className="app-header-actions">
            <button type="button" className="app-header-icon-btn" onClick={() => setChatOpen(true)} aria-label={`Chat with ${clientName || "your coach"}`}>
              <ChatIcon />
              {hasCoachUpdate && <span className="app-header-icon-badge" aria-hidden="true" />}
            </button>
            <button type="button" className="app-header-icon-btn" aria-label="Notifications">
              <BellIcon />
            </button>
          </div>
        </header>

        <main className="app-content" key={`${activeId}-${navResetKey}`}>
          {active?.content}
        </main>

        {active?.footer && <div className="app-sticky-footer">{active.footer}</div>}

        <nav className="app-bottom-nav">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`app-tab-btn${t.id === activeId ? " active" : ""}`}
              onClick={() => {
                setActiveId(t.id);
                setNavResetKey((k) => k + 1);
              }}
            >
              <span className="app-tab-icon" aria-label={t.label}>
                {t.icon}
              </span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
