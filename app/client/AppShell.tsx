"use client";

import Image from "next/image";
import { ReactNode, useState, useSyncExternalStore } from "react";
import { BellIcon, ChevronLeftIcon } from "../components/icons";
import CheckInScreen, { CheckInProps } from "./CheckInScreen";
import { CheckInProvider, FocusRefProvider, NavigateProvider, NotificationsProvider } from "./CheckInContext";

export type AppTab = { id: string; label: string; icon: ReactNode; content: ReactNode; footer?: ReactNode };

type PushView = "notifications" | "checkin" | "photos" | null;

// The active bottom tab lives in sessionStorage, not just React state. A full
// page load — a form that posts before hydration finishes on a slow phone, a
// pull-to-refresh, the home-screen app being reopened — would otherwise drop
// the client back on Home mid-workout. Read through useSyncExternalStore so
// the server render and the first client render agree (first tab), then the
// remembered tab applies.
const TAB_KEY = "ironline.client.tab";
const TAB_EVENT = "ironline:tab";

function readTab(): string | null {
  try {
    return window.sessionStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

function subscribeTab(onChange: () => void) {
  window.addEventListener(TAB_EVENT, onChange);
  return () => window.removeEventListener(TAB_EVENT, onChange);
}

function writeTab(id: string) {
  try {
    window.sessionStorage.setItem(TAB_KEY, id);
  } catch {
    /* blocked storage: the tab still switches for this page */
  }
  window.dispatchEvent(new Event(TAB_EVENT));
}

// Top bar is the brand plus a single notifications bell (not a per-tab
// greeting). Chat is deliberately absent: it's cut from the first beta, so
// the bell is the only header action and Notifications is the only pushed
// view besides the check-in flow.
export default function AppShell({
  clientName,
  tabs,
  notificationsContent,
  hasCoachUpdate,
  hasUnreadNotifications,
  clientId,
  checkIn,
  logoSrc,
  brandName,
}: {
  clientName: string;
  tabs: AppTab[];
  notificationsContent: ReactNode;
  hasCoachUpdate?: boolean;
  hasUnreadNotifications?: boolean;
  clientId: number;
  checkIn: CheckInProps;
  /** Coach-uploaded logo; the Ironline mark when unset. */
  logoSrc?: string | null;
  /** Coach's business name for the header; "Ironline" when unset. */
  brandName?: string | null;
}) {
  const storedTab = useSyncExternalStore(subscribeTab, readTab, () => null);
  const activeId = storedTab && tabs.some((t) => t.id === storedTab) ? storedTab : tabs[0]?.id;
  const setActiveId = (id: string) => writeTab(id);
  const [pushView, setPushView] = useState<PushView>(null);
  // Which check-in section to land on, set by whichever due item opened it.
  const [checkInSection, setCheckInSection] = useState("daily");
  const openCheckIn = (section: string) => {
    // Progress pictures get their own screen; everything else is a section
    // of the check-in.
    if (section === "photos") {
      setPushView("photos");
      return;
    }
    setCheckInSection(section);
    setPushView("checkin");
  };
  // Bumped on every bottom-nav tap (including tapping the already-active
  // tab) and used as a key on the content below, so tapping Home while
  // already on Home resets HomeHub's internal sub-view instead of doing
  // nothing — there's no in-page back link otherwise, so this is how "go
  // home" works from a sub-view like Photos or Tracker.
  const [navResetKey, setNavResetKey] = useState(0);
  // Which row the tab we're switching to should open on arrival, set only by
  // a notification's deep link and cleared by any ordinary nav tap.
  const [focusRef, setFocusRef] = useState<number | null>(null);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const goToTab = (tab: string, ref?: number) => {
    if (!tabs.some((t) => t.id === tab)) return;
    setPushView(null);
    setActiveId(tab);
    setFocusRef(ref ?? null);
    setNavResetKey((k) => k + 1);
  };

  if (pushView === "checkin" || pushView === "photos") {
    return (
      <div className="phone-frame">
        <div className="app-screen cn-screen">
          <CheckInScreen
            photosOnly={pushView === "photos"}
            clientId={clientId}
            dateLabel={checkIn.dateLabel}
            today={checkIn.today}
            sections={checkIn.sections}
            initialSection={checkInSection}
            phaseLabel={checkIn.phaseLabel}
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
    return (
      <div className="phone-frame">
        <div className="app-screen cn-screen">
          <header className="cn-header">
            <button type="button" className="cn-icon-btn" onClick={() => setPushView(null)} aria-label="Back">
              <ChevronLeftIcon />
            </button>
            <div className="cn-header-titles">
              <div className="cn-kicker">Activity</div>
              <div className="cn-title">Notifications</div>
            </div>
            {/* No right-hand action: that slot was the chat toggle. */}
            <span className="cn-icon-spacer" aria-hidden="true" />
          </header>
          <main className="cn-body">
            <NavigateProvider value={goToTab}>{notificationsContent}</NavigateProvider>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-frame">
      <div className="app-screen">
        <header className="app-header dark">
          <span className="app-header-brand">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- coach-uploaded file
              <img src={logoSrc} alt="" className="app-header-logo" />
            ) : (
              <Image src="/brand/logo.png" alt="" width={15} height={26} className="app-header-logo" priority />
            )}
            {brandName || "Ironline"}
          </span>
          <div className="app-header-actions">
            <button type="button" className="app-header-icon-btn" onClick={() => setPushView("notifications")} aria-label="Notifications">
              <BellIcon />
              {hasUnreadNotifications && <span className="app-header-icon-badge" aria-hidden="true" />}
            </button>
          </div>
        </header>

        <main className="app-content dark" key={`${activeId}-${navResetKey}`}>
          <CheckInProvider value={openCheckIn}>
            <NotificationsProvider value={() => setPushView("notifications")}>
              <FocusRefProvider value={focusRef}>{active?.content}</FocusRefProvider>
            </NotificationsProvider>
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
                setFocusRef(null);
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
