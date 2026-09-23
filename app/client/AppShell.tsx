"use client";

import { ReactNode, useState, useSyncExternalStore, useTransition } from "react";
import { markCoachNotesReadAction } from "../lib/actions";
import { logoutAction } from "../lib/auth-actions";
import { BellIcon, ChevronLeftIcon, MenuIcon } from "../components/icons";
import CheckInScreen, { CheckInProps } from "./CheckInScreen";
import ProgressPicturesScreen, { type ProgressPicturesProps } from "./ProgressPicturesScreen";
import CoachProfileScreen from "./CoachProfileScreen";
import CoachMessagesScreen, { type CoachMessagesProps } from "./CoachMessagesScreen";
import FoodDiaryScreen, { type FoodDiaryProps } from "./FoodDiaryScreen";
import type { CoachProfileView } from "../lib/coachProfileView";
import {
  CheckInProvider,
  CoachIdentityProvider,
  CoachProvider,
  FocusRefProvider,
  FoodProvider,
  LinkProvider,
  MessagesProvider,
  NavigateProvider,
  NotificationsProvider,
  PhotosProvider,
  TrainingFocusProvider,
  type TrainingFocus,
} from "./CheckInContext";
import type { LinkView } from "../lib/messageLinks";

export type AppTab = {
  id: string;
  label: string;
  icon: ReactNode;
  content: ReactNode;
  footer?: ReactNode;
  /** The tab draws its own banner (Training, Nutrition): the top bar floats
      over it, see-through until the page scrolls, then off-white. */
  bare?: boolean;
  /** The banner is dark, so the see-through top bar is white. */
  darkBanner?: boolean;
};

type PushView = "notifications" | "checkin" | "photos" | "coach" | "messages" | "food" | null;

// The active bottom tab lives in sessionStorage, not just React state. A full
// page load — a form that posts before hydration finishes on a slow phone, a
// pull-to-refresh, the home-screen app being reopened — would otherwise drop
// the client back on Home mid-workout. Read through useSyncExternalStore so
// the server render and the first client render agree (first tab), then the
// remembered tab applies.
const TAB_KEY = "ironline.client.tab";
const PUSH_KEY = "ironline.client.push";
// Which pushed view was open when the page last reloaded (only the food diary is kept).
function readPush(): string | null {
  try {
    return window.sessionStorage.getItem(PUSH_KEY);
  } catch {
    return null;
  }
}
// Nothing to subscribe to: once the client picks a view, that choice wins.
function subscribePush() {
  return () => {};
}
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
  photos,
  coachMessages,
  helpEmail = "",
  coachProfile = null,
  coachAvatarPath = null,
  foodDiary = null,
}: {
  clientName: string;
  tabs: AppTab[];
  notificationsContent: ReactNode;
  hasCoachUpdate?: boolean;
  hasUnreadNotifications?: boolean;
  clientId: number;
  checkIn: CheckInProps;
  photos: ProgressPicturesProps;
  /** The coach's one-way messages, read from Home's card or a notification. */
  coachMessages: CoachMessagesProps;
  /** Where the menu's Help row writes to: the coach's email. */
  helpEmail?: string;
  /** The client's coach, opened from the Account tab's Coach row. */
  coachProfile?: CoachProfileView | null;
  /** The coach's profile picture, in front of anything they wrote. */
  coachAvatarPath?: string | null;
  /** Today's food diary, opened from the ring on Nutrition. */
  foodDiary?: FoodDiaryProps | null;
}) {
  const storedTab = useSyncExternalStore(subscribeTab, readTab, () => null);
  const activeId = storedTab && tabs.some((t) => t.id === storedTab) ? storedTab : tabs[0]?.id;
  const setActiveId = (id: string) => writeTab(id);
  // The food diary stays open across a reload (a deploy landing mid-session
  // reloads the page), the way the tab does: read from storage until the
  // client chooses otherwise. The other pushed views start closed, since
  // they hang off something on the tab underneath.
  const storedPush = useSyncExternalStore(subscribePush, readPush, () => null);
  const [chosenPush, setChosenPush] = useState<PushView | undefined>(undefined);
  const pushView: PushView = chosenPush !== undefined ? chosenPush : storedPush === "food" && foodDiary ? "food" : null;
  const setPushView = (v: PushView) => {
    setChosenPush(v);
    try {
      if (v === "food") window.sessionStorage.setItem(PUSH_KEY, "food");
      else window.sessionStorage.removeItem(PUSH_KEY);
    } catch {
      /* blocked storage: the view still opens for this page */
    }
  };
  // Which check-in section to land on, set by whichever due item opened it.
  const [checkInSection, setCheckInSection] = useState("daily");
  const openCheckIn = (section: string) => {
    setCheckInSection(section);
    setPushView("checkin");
  };
  // The burger's drawer. A row closes it and then does its thing.
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (then: () => void) => {
    setMenuOpen(false);
    then();
  };
  // Opening the coach's feed reads every message, so the bell clears.
  const [, startTransition] = useTransition();
  const openMessages = () => {
    setPushView("messages");
    startTransition(() => {
      markCoachNotesReadAction(clientId);
    });
  };
  // Bumped when the tab changes and used as a key on the content below, so
  // a tab comes up fresh when switched to. A tap on the tab already showing
  // is ignored: rebuilding it read as the screen jumping to the top.
  const [navResetKey, setNavResetKey] = useState(0);
  // Which row the tab we're switching to should open on arrival, set only by
  // a notification's deep link and cleared by any ordinary nav tap.
  const [focusRef, setFocusRef] = useState<number | null>(null);
  // With a link into Training: the week to land on and the exercise to open.
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus | null>(null);
  // With a link into the food diary: the day to open it on (today otherwise).
  const [foodDate, setFoodDate] = useState<string | null>(null);
  // … and, when the coach commented on one meal, the meal to open on it.
  const [foodMeal, setFoodMeal] = useState<string | null>(null);
  // With a link to a sheet of pictures: the sheet to open.
  const [photosPeriod, setPhotosPeriod] = useState<string | null>(null);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];
  // Whether the tab has scrolled off its top, which turns a banner tab's
  // see-through top bar solid. A new tab starts at the top.
  const [scrolled, setScrolled] = useState(false);
  const clearBar = !!active?.bare && !scrolled;

  const goToTab = (tab: string, ref?: number, focus?: TrainingFocus) => {
    if (!tabs.some((t) => t.id === tab)) return;
    setScrolled(false);
    setPushView(null);
    setActiveId(tab);
    setFocusRef(ref ?? null);
    setTrainingFocus(focus ?? null);
    setNavResetKey((k) => k + 1);
  };

  // A coach message's link: straight to the thing it is about, from Home's
  // card or the messages feed. One that can no longer open does nothing.
  const openLink = (view: LinkView) => {
    if (view.gone) return;
    const l = view.link;
    switch (l.kind) {
      case "session":
      case "exercise":
        goToTab("training", l.dayId, { week: view.week, exercise: l.kind === "exercise" ? l.assignmentId : null });
        return;
      case "nutrition":
        goToTab("nutrition");
        return;
      case "food":
        if (!foodDiary) return;
        setFoodDate(l.date);
        setFoodMeal(l.meal ?? null);
        setPushView("food");
        return;
      case "checkin":
        openCheckIn(l.section);
        return;
      case "photos":
        setPhotosPeriod(l.period ?? null);
        setPushView("photos");
        return;
    }
  };

  const pushedLayer =
    pushView === "checkin" ? (
      <div className="app-layer app-layer-push cn-screen">
        <CheckInScreen
          clientId={clientId}
          dateLabel={checkIn.dateLabel}
          today={checkIn.today}
          sections={checkIn.sections}
          initialSection={checkInSection}
          dueSections={checkIn.dueSections}
          onBack={() => setPushView(null)}
        />
      </div>
    ) : pushView === "coach" && coachProfile ? (
      <div className="app-layer app-layer-push cpf-layer">
        {/* "Book a call" lands on Home, where the next meeting card is. */}
        <CoachProfileScreen profile={coachProfile} onBack={() => setPushView(null)} onBook={() => goToTab("home")} />
      </div>
    ) : pushView === "photos" ? (
      <div className="app-layer app-layer-push pp-app-screen">
        <ProgressPicturesScreen data={photos} initialPeriod={photosPeriod} onBack={() => setPushView(null)} />
      </div>
    ) : pushView === "food" && foodDiary ? (
      <div className="app-layer app-layer-push cn-screen">
        <FoodDiaryScreen clientId={clientId} diary={foodDiary} initialDate={foodDate} initialMeal={foodMeal} onBack={() => setPushView(null)} />
      </div>
    ) : pushView === "messages" ? (
      <div className="app-layer app-layer-push cn-screen">
        <CoachMessagesScreen {...coachMessages} clientId={clientId} onBack={() => setPushView(null)} />
      </div>
    ) : pushView ? (
      <div className="app-layer app-layer-push cn-screen">
        <header className="cn-header">
          <button type="button" className="cn-icon-btn" onClick={() => setPushView(null)} aria-label="Back">
            <ChevronLeftIcon />
          </button>
          <div className="cn-header-titles">
            <h1 className="cn-title">Notifications</h1>
          </div>
          <span className="cn-icon-spacer" aria-hidden="true" />
        </header>
        <main className="cn-body">
          {/* A "Coach note" row opens the messages feed over Notifications. */}
          <MessagesProvider value={openMessages}>
            <NavigateProvider value={goToTab}>{notificationsContent}</NavigateProvider>
          </MessagesProvider>
        </main>
      </div>
    ) : null;

  return (
    <CoachIdentityProvider value={{ name: coachMessages.coachName, photoPath: coachAvatarPath }}>
      <LinkProvider value={openLink}>
      <div className="phone-frame">
        <div className="app-screen app-stack">
          {/* The tab stays mounted under a pushed view, so closing the view
              comes back to the same scroll and the same open day. inert keeps
              it out of reach of taps and the keyboard while covered. */}
          <div className="app-layer app-layer-main" inert={pushView ? true : undefined} aria-hidden={pushView ? true : undefined}>
          <header
            className={`app-header dark${active?.bare ? " overlay" : ""}${clearBar ? " clear" : ""}${clearBar && active?.darkBanner ? " on-dark" : ""}`}
          >
            <button type="button" className="app-header-icon-btn" onClick={() => setMenuOpen(true)} aria-label="Menu" aria-expanded={menuOpen}>
              <MenuIcon />
            </button>
            <span className="app-header-brand">Ironline</span>
            <div className="app-header-actions">
              <button type="button" className="app-header-icon-btn" onClick={() => setPushView("notifications")} aria-label="Notifications">
                <BellIcon />
                {hasUnreadNotifications && <span className="app-header-icon-badge" aria-hidden="true" />}
              </button>
            </div>
          </header>

          <main
            className="app-content dark"
            key={`${activeId}-${navResetKey}`}
            onScroll={active?.bare ? (e) => setScrolled(e.currentTarget.scrollTop > 4) : undefined}
          >
            <CheckInProvider value={openCheckIn}>
              <PhotosProvider
                value={() => {
                  setPhotosPeriod(null);
                  setPushView("photos");
                }}
              >
                <MessagesProvider value={openMessages}>
                  <FoodProvider
                    value={
                      foodDiary
                        ? () => {
                            setFoodDate(null);
                            setFoodMeal(null);
                            setPushView("food");
                          }
                        : null
                    }
                  >
                <CoachProvider value={coachProfile ? () => setPushView("coach") : null}>
                    <NotificationsProvider value={() => setPushView("notifications")}>
                      <NavigateProvider value={goToTab}>
                        <FocusRefProvider value={focusRef}>
                          <TrainingFocusProvider value={trainingFocus}>{active?.content}</TrainingFocusProvider>
                        </FocusRefProvider>
                      </NavigateProvider>
                    </NotificationsProvider>
                  </CoachProvider>
                </FoodProvider>
                </MessagesProvider>
              </PhotosProvider>
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
                  // A tap on the tab already showing does nothing. It used to
                  // rebuild the tab, which read as the screen jumping to the top.
                  if (t.id === activeId) return;
                  setScrolled(false);
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
          {pushedLayer}

          {/* The burger's drawer: the screens that are not on the bottom nav.
              Tapping the scrim or a row closes it. */}
          {menuOpen && (
            <>
              <button type="button" className="app-menu-scrim" onClick={() => setMenuOpen(false)} aria-label="Close menu" />
              <nav className="app-menu" aria-label="Menu">
                <div className="app-menu-head">
                  <span className="app-header-brand app-menu-brand">Ironline</span>
                  {/* The coach's business, hardcoded like the rail and the Settings
                      footnote until the coach profile carries it. */}
                  <span className="app-menu-name">Full Potential Coaching</span>
                </div>
                <div className="app-menu-list">
                  <button type="button" className="app-menu-item" onClick={() => go(() => openMessages())}>
                    Messages with {coachMessages.coachName}
                  </button>
                  {/* Help writes to the coach: the person who can actually do something. */}
                  {helpEmail && (
                    <a
                      className="app-menu-item app-menu-item-link"
                      href={`mailto:${helpEmail}?subject=${encodeURIComponent("Ironline app")}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      Help
                    </a>
                  )}
                </div>
                <div className="app-menu-foot">
                  <form action={logoutAction}>
                    <button type="submit" className="app-menu-logout">
                      Log out
                    </button>
                  </form>
                  <span className="app-menu-footnote">Ironline · Full Potential Coaching</span>
                </div>
              </nav>
            </>
          )}
        </div>
      </div>
      </LinkProvider>
    </CoachIdentityProvider>
  );
}
