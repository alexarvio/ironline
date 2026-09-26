"use client";

import { ReactNode, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { markCoachNotesReadAction } from "../lib/actions";
import { logoutAction } from "../lib/auth-actions";
import { BellIcon, ChevronLeftIcon, MenuIcon } from "../components/icons";
import CheckInScreen, { CheckInProps } from "./CheckInScreen";
import ProgressPicturesScreen, { type ProgressPicturesProps } from "./ProgressPicturesScreen";
import CoachProfileScreen from "./CoachProfileScreen";
import CoachMessagesScreen, { type CoachMessagesProps } from "./CoachMessagesScreen";
import FoodDiaryScreen, { type FoodDiaryProps } from "./FoodDiaryScreen";
import MeetingsScreen, { type MeetingsProps } from "./MeetingsScreen";
import InvoicesScreen, { type InvoicesProps } from "./InvoicesScreen";
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
  MeetingsProvider,
  TrainingFocusProvider,
  type TrainingFocus,
} from "./CheckInContext";
import type { LinkView, MessageAbout } from "../lib/messageLinks";

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

type PushView = "notifications" | "checkin" | "photos" | "coach" | "messages" | "food" | "meetings" | "invoices" | null;

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
/** The tab, for the server (page.tsx reads it). */
export const TAB_COOKIE = "ironline_tab";

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
  // And in a cookie for this visit, so a reload is drawn on this tab by the
  // server instead of Home first and then this one.
  try {
    document.cookie = `${TAB_COOKIE}=${encodeURIComponent(id)}; path=/; samesite=lax`;
  } catch {}
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
  meetings = null,
  invoices = null,
  initialPush = null,
  initialTab = null,
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
  /** Every call with the coach: to come and past, for the Meetings screen. */
  meetings?: MeetingsProps | null;
  /** The coach's invoices that reached the client; null, none yet (the menu leaves the row out). */
  invoices?: InvoicesProps | null;
  /** A screen to open on arrival: a lock-screen notification's link (/client?open=invoices). */
  initialPush?: "invoices" | null;
  /** The tab the client was on (its cookie), so the server draws that one. */
  initialTab?: string | null;
}) {
  const storedTab = useSyncExternalStore(subscribeTab, readTab, () => initialTab);
  const activeId = storedTab && tabs.some((t) => t.id === storedTab) ? storedTab : tabs[0]?.id;
  const setActiveId = (id: string) => writeTab(id);
  // The food diary stays open across a reload (a deploy landing mid-session
  // reloads the page), the way the tab does: read from storage until the
  // client chooses otherwise. The other pushed views start closed, since
  // they hang off something on the tab underneath.
  const storedPush = useSyncExternalStore(subscribePush, readPush, () => null);
  const [chosenPush, setChosenPush] = useState<PushView | undefined>(initialPush && invoices ? initialPush : undefined);
  // The link has done its job: a reload opens the app as usual.
  useEffect(() => {
    if (initialPush) window.history.replaceState(null, "", "/client");
  }, [initialPush]);
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
  // Opened from an exercise in the workout: the next message is about it.
  const [messageAbout, setMessageAbout] = useState<MessageAbout | null>(null);
  const openMessages = (about?: MessageAbout) => {
    setMessageAbout(about && "link" in about ? about : null);
    setPushView("messages");
    startTransition(() => {
      markCoachNotesReadAction(clientId);
    });
  };
  // Every tab opened stays mounted, hidden while another shows, each with its
  // own scroll: switching back finds it as it was left, with no entrance
  // animations replaying and no carousel, week or open session reset. It is
  // rebuilt only when a link sends the client to something inside it.
  const [visited, setVisited] = useState<string[]>(() => (activeId ? [activeId] : []));
  if (activeId && !visited.includes(activeId)) setVisited([...visited, activeId]);
  const [rebuilt, setRebuilt] = useState<Record<string, number>>({});
  const scrollers = useRef<Record<string, HTMLElement | null>>({});
  // The phone's timezone, for the server: Home's greeting and a call's time
  // are drawn in it from the first paint instead of changing a moment later.
  useEffect(() => {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) document.cookie = `ironline_tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, []);
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
    // Not a tab: the invoice notification opens the Invoices screen.
    if (tab === "invoices") {
      if (invoices) setPushView("invoices");
      return;
    }
    if (!tabs.some((t) => t.id === tab)) return;
    setScrolled(false);
    setPushView(null);
    setActiveId(tab);
    setFocusRef(ref ?? null);
    setTrainingFocus(focus ?? null);
    // Sent to something inside it: that tab comes up fresh, at its top.
    setRebuilt((r) => ({ ...r, [tab]: (r[tab] ?? 0) + 1 }));
  };

  // A coach message's link: straight to the thing it is about, from Home's
  // card or the messages feed. One that can no longer open does nothing.
  // Opened from the chat, Back comes back to the chat instead of the tab
  // underneath: this names the screen that should (a session in Training
  // carries it in its focus instead).
  const [chatReturn, setChatReturn] = useState<"food" | "checkin" | "photos" | "nutrition" | null>(null);
  const openLink = (view: LinkView) => {
    if (view.gone) return;
    const l = view.link;
    const fromChat = pushView === "messages";
    const returnTo = (v: NonNullable<typeof chatReturn>) => setChatReturn(fromChat ? v : null);
    switch (l.kind) {
      case "session":
      case "exercise":
        setChatReturn(null);
        goToTab("training", l.dayId, { week: view.week, exercise: l.kind === "exercise" ? l.assignmentId : null, fromChat });
        return;
      case "nutrition":
        goToTab("nutrition");
        returnTo("nutrition");
        return;
      case "food":
        // No diary on this client (switched off since): their Nutrition tab instead.
        if (!foodDiary) {
          goToTab("nutrition");
          returnTo("nutrition");
          return;
        }
        setFoodDate(l.date);
        setFoodMeal(l.meal ?? null);
        setPushView("food");
        returnTo("food");
        return;
      case "checkin":
        openCheckIn(l.section);
        returnTo("checkin");
        return;
      case "photos":
        setPhotosPeriod(l.period ?? null);
        setPushView("photos");
        returnTo("photos");
        return;
    }
  };
  const backToChat = () => {
    setChatReturn(null);
    setMessageAbout(null);
    setPushView("messages");
  };
  // Back on a pushed screen: to the chat when that is where it came from.
  const backFrom = (v: NonNullable<typeof chatReturn>) => () => (chatReturn === v ? backToChat() : setPushView(null));

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
          weeklyOpen={checkIn.weeklyOpen}
          objectives={checkIn.objectives}
          history={checkIn.history}
          onBack={backFrom("checkin")}
        />
      </div>
    ) : pushView === "coach" && coachProfile ? (
      <div className="app-layer app-layer-push cpf-layer">
        {/* "Book a call" lands on Home, where the next meeting card is. */}
        <CoachProfileScreen profile={coachProfile} onBack={() => setPushView(null)} onBook={() => goToTab("home")} />
      </div>
    ) : pushView === "photos" ? (
      <div className="app-layer app-layer-push pp-app-screen">
        <ProgressPicturesScreen data={photos} initialPeriod={photosPeriod} onBack={backFrom("photos")} />
      </div>
    ) : pushView === "food" && foodDiary ? (
      <div className="app-layer app-layer-push cn-screen">
        <FoodDiaryScreen clientId={clientId} diary={foodDiary} initialDate={foodDate} initialMeal={foodMeal} onBack={backFrom("food")} />
      </div>
    ) : pushView === "meetings" && meetings ? (
      <div className="app-layer app-layer-push cn-screen">
        <MeetingsScreen {...meetings} coachName={coachMessages.coachName} onBack={() => setPushView(null)} />
      </div>
    ) : pushView === "invoices" && invoices ? (
      <div className="app-layer app-layer-push cn-screen">
        <InvoicesScreen {...invoices} onBack={() => setPushView(null)} />
      </div>
    ) : pushView === "messages" ? (
      <div className="app-layer app-layer-push cn-screen">
        <CoachMessagesScreen {...coachMessages} clientId={clientId} onBack={() => setPushView(null)} about={messageAbout} onClearAbout={() => setMessageAbout(null)} />
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
                <MeetingsProvider value={meetings ? () => setPushView("meetings") : null}>
                <CoachProvider value={coachProfile ? () => setPushView("coach") : null}>
                    <NotificationsProvider value={() => setPushView("notifications")}>
                      <NavigateProvider value={goToTab}>
                        {tabs
                          .filter((t) => visited.includes(t.id))
                          .map((t) => (
                            <main
                              key={`${t.id}-${rebuilt[t.id] ?? 0}`}
                              ref={(el) => {
                                scrollers.current[t.id] = el;
                              }}
                              className="app-content dark"
                              style={t.id === activeId ? undefined : { display: "none" }}
                              aria-hidden={t.id === activeId ? undefined : true}
                              onScroll={t.bare ? (e) => t.id === activeId && setScrolled(e.currentTarget.scrollTop > 4) : undefined}
                            >
                              {/* A deep link's target is for the tab it was sent to only. */}
                              <FocusRefProvider value={t.id === activeId ? focusRef : null}>
                                <TrainingFocusProvider value={t.id === activeId ? trainingFocus : null}>{t.content}</TrainingFocusProvider>
                              </FocusRefProvider>
                            </main>
                          ))}
                      </NavigateProvider>
                    </NotificationsProvider>
                  </CoachProvider>
                </MeetingsProvider>
                </FoodProvider>
                </MessagesProvider>
              </PhotosProvider>
            </CheckInProvider>

          {active?.footer && <div className="app-sticky-footer">{active.footer}</div>}
          <nav className="app-bottom-nav dark">
            {/* A tab has no Back of its own: sent here from the chat, this takes the client back to it. */}
            {chatReturn === "nutrition" && activeId === "nutrition" && (
              <button type="button" className="app-chat-return" onClick={backToChat}>
                <ChevronLeftIcon />
                Back to chat
              </button>
            )}
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`app-tab-btn${t.id === activeId ? " active" : ""}`}
                onClick={() => {
                  // A tap on the tab already showing does nothing. It used to
                  // rebuild the tab, which read as the screen jumping to the top.
                  if (t.id === activeId) return;
                  // The tab as it was left, scroll and all.
                  setChatReturn(null);
                  setScrolled((scrollers.current[t.id]?.scrollTop ?? 0) > 4);
                  setActiveId(t.id);
                  setFocusRef(null);
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
                  {meetings && (
                    <button type="button" className="app-menu-item" onClick={() => go(() => setPushView("meetings"))}>
                      Meetings
                    </button>
                  )}
                  {invoices && (
                    <button type="button" className="app-menu-item" onClick={() => go(() => setPushView("invoices"))}>
                      Invoices
                    </button>
                  )}
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
