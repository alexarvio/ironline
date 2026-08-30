"use client";

import { ReactNode, useState } from "react";
import { BellIcon, ChatIcon, ChevronLeftIcon } from "../components/icons";
import CheckInScreen, { CheckInProps } from "./CheckInScreen";
import { ChatProvider, CheckInProvider } from "./CheckInContext";

export type AppTab = { id: string; label: string; icon: ReactNode; content: ReactNode; footer?: ReactNode };

type PushView = "chat" | "notifications" | "checkin" | null;

// Top bar is brand + chat/bell icons (not a per-tab greeting). Both icons
// open the same pushed full-screen view — a single dark Chat and
// Notifications screen with its own header toggle between the two — so
// switching tabs underneath never loses your place in either.
export default function AppShell({
  clientName,
  tabs,
  chatContent,
  notificationsContent,
  hasCoachUpdate,
  hasUnreadNotifications,
  logoUrl,
  clientId,
  checkIn,
}: {
  clientName: string;
  tabs: AppTab[];
  chatContent: ReactNode;
  notificationsContent: ReactNode;
  hasCoachUpdate?: boolean;
  hasUnreadNotifications?: boolean;
  logoUrl?: string | null;
  clientId: number;
  checkIn: CheckInProps;
}) {
  const [activeId, setActiveId] = useState(tabs[0]?.id);
  const [pushView, setPushView] = useState<PushView>(null);
  // Which check-in section to land on, set by whichever due item opened it.
  const [checkInSection, setCheckInSection] = useState("daily");
  const openCheckIn = (section: string) => {
    setCheckInSection(section);
    setPushView("checkin");
  };
  // Bumped on every bottom-nav tap (including tapping the already-active
  // tab) and used as a key on the content below, so tapping Home while
  // already on Home resets HomeHub's internal sub-view instead of doing
  // nothing — there's no in-page back link otherwise, so this is how "go
  // home" works from a sub-view like Photos or Tracker.
  const [navResetKey, setNavResetKey] = useState(0);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  if (pushView === "checkin") {
    return (
      <div className="phone-frame">
        <div className="app-screen cn-screen">
          <CheckInScreen
            clientId={clientId}
            dateLabel={checkIn.dateLabel}
            today={checkIn.today}
            sections={checkIn.sections}
            initialSection={checkInSection}
            lastCheckInDate={checkIn.lastCheckInDate}
            deltas={checkIn.deltas}
            photoSlots={checkIn.photoSlots}
            photoPeriodLabel={checkIn.photoPeriodLabel}
            dueSections={checkIn.dueSections}
            photosDue={checkIn.photosDue}
            photosNextLabel={checkIn.photosNextLabel}
            coachNote={checkIn.coachNote}
            photoHistory={checkIn.photoHistory}
            onBack={() => setPushView(null)}
          />
        </div>
      </div>
    );
  }

  if (pushView) {
    const isChat = pushView === "chat";
    return (
      <div className="phone-frame">
        <div className="app-screen cn-screen">
          <header className="cn-header">
            <button type="button" className="cn-icon-btn" onClick={() => setPushView(null)} aria-label="Back">
              <ChevronLeftIcon />
            </button>
            <div className="cn-header-titles">
              <div className="cn-kicker">{isChat ? "Your coach" : "Activity"}</div>
              <div className="cn-title">{isChat ? "Coach" : "Notifications"}</div>
            </div>
            <button
              type="button"
              className="cn-icon-btn"
              onClick={() => setPushView(isChat ? "notifications" : "chat")}
              aria-label={isChat ? "Open notifications" : "Open chat"}
            >
              {isChat ? <ChatIcon /> : <BellIcon />}
              {isChat && hasUnreadNotifications && <span className="cn-badge" aria-hidden="true" />}
            </button>
          </header>
          <main className="cn-body">{isChat ? chatContent : notificationsContent}</main>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      <div className="app-screen">
        <header className="app-header dark">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="app-header-brand-img" />
          ) : (
            <span className="app-header-brand">Ironline</span>
          )}
          <div className="app-header-actions">
            <button type="button" className="app-header-icon-btn" onClick={() => setPushView("chat")} aria-label={`Chat with ${clientName || "your coach"}`}>
              <ChatIcon />
              {hasCoachUpdate && <span className="app-header-icon-badge" aria-hidden="true" />}
            </button>
            <button type="button" className="app-header-icon-btn" onClick={() => setPushView("notifications")} aria-label="Notifications">
              <BellIcon />
              {hasUnreadNotifications && <span className="app-header-icon-badge" aria-hidden="true" />}
            </button>
          </div>
        </header>

        <main className="app-content dark" key={`${activeId}-${navResetKey}`}>
          <CheckInProvider value={openCheckIn}>
            <ChatProvider value={() => setPushView("chat")}>{active?.content}</ChatProvider>
          </CheckInProvider>
        </main>

        {active?.footer && <div className="app-sticky-footer">{active.footer}</div>}

        <nav className="app-bottom-nav dark">
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
