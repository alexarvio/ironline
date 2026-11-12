"use client";

import { ReactNode, useEffect, useRef, useState, useSyncExternalStore, useTransition, type SyntheticEvent } from "react";
import { pic } from "../lib/pic";
import { useRouter } from "next/navigation";
import { markCoachNotesReadAction, markNotificationReadAction } from "../lib/actions";
import { useWorkoutOutboxRunner } from "../components/workoutOutbox";
import type { NotificationCategory } from "../lib/notificationTypes";
import { goalItemId } from "../lib/weightGoal";
import { logoutAction } from "../lib/auth-actions";
import { NorCoachLogo } from "../components/NorCoachLogo";
import { BellIcon, CalendarIcon, CameraIcon, ChevronLeftIcon, GearIcon, HeartIcon, MenuIcon, ChatIcon, ReceiptIcon } from "../components/icons";
import CheckInScreen, { CheckInProps } from "./CheckInScreen";
import PreviewBar from "./PreviewBar";
import ProgressPicturesScreen, { type ProgressPicturesProps, warmShapeUpdateBanner } from "./ProgressPicturesScreen";
import CoachProfileScreen from "./CoachProfileScreen";
import { HealthAutoSync } from "./HealthSync";
import { NativePush } from "./NativePush";
import { NativeStatusBar } from "./NativeStatusBar";
import CoachMessagesScreen, { type CoachMessagesProps } from "./CoachMessagesScreen";
import EventsScreen from "./events/EventsScreen";
import type { HomeEvents } from "./EventsCard";
import type { FoodDiaryProps } from "./FoodDiaryScreen";
import MeetingsScreen, { type MeetingsProps } from "./meetings/MeetingsScreen";
import InvoicesScreen, { type InvoicesProps } from "./InvoicesScreen";
import type { CoachProfileView } from "../lib/coachProfileView";
import {
  CheckInProvider,
  CoachIdentityProvider,
  CoachProvider,
  FocusRefProvider,
  TabActiveProvider,
  LinkProvider,
  MessagesProvider,
  NavigateProvider,
  NotificationsProvider,
  PhotosProvider,
  BackProvider,
  MeetingsProvider,
  EventsProvider,
  TrainingFocusProvider,
  FoodFocusProvider,
  TabShownProvider,
  type FoodFocus,
  type TrainingFocus,
} from "./CheckInContext";
import type { LinkView, MessageAbout } from "../lib/messageLinks";
import { Bars } from "./Bars";

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

type PushView = "notifications" | "checkin" | "photos" | "coach" | "messages" | "meetings" | "invoices" | "settings" | "events" | null;
/** The screens the coach's phone preview can be asked for (21 Oct): the three tabs, and the pushed screens. */
export type PhoneScreen = "home" | "training" | "nutrition" | "checkin" | "photos" | "messages" | "meetings" | "invoices" | "events";
const PHONE_TABS = new Set<string>(["home", "training", "nutrition"]);
/** What the admin's panel posts to the preview: a screen to show, or to read the page again after a save. */
export type PhoneMessage = { norcoach: "phone"; screen?: PhoneScreen; refresh?: boolean };
// Taps, keys and form posts stop at the frame in the preview; the wheel still scrolls.
const stopEvent = (e: SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

// The active bottom tab lives in sessionStorage, not just React state. A full
// page load — a form that posts before hydration finishes on a slow phone, a
// pull-to-refresh, the home-screen app being reopened — would otherwise drop
// the client back on Home mid-workout. Read through useSyncExternalStore so
// the server render and the first client render agree (first tab), then the
// remembered tab applies.
const TAB_KEY = "ironline.client.tab";
// The pushed food diary was kept across a reload under this key; the diary is the Nutrition tab now (12 Nov), whose
// tab memory brings it back, so the key is only cleared.
const OLD_PUSH_KEY = "ironline.client.push";
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
/** What a phone push asks the app to open (24 Oct): a notification, as the list would open it, or a meeting reminder's call. */
export type Arrival =
  | { notificationId: number; category: NotificationCategory; actionTab: string | null; actionRef: number | null; link: LinkView | null }
  | { meetingId: number };

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
  clientAvatarPath = null,
  foodDiary = null,
  meetings = null,
  invoices = null,
  initialPush = null,
  arrival = null,
  initialTab = null,
  preview = null,
  readOnly = false,
  settingsContent = null,
  chatUnread = false,
  events = null,
}: {
  /** The client's events, for the Events screen (8 Oct); null, no screen. */
  events?: HomeEvents | null;
  /** Settings, opened from the burger (7 Oct: the chat took its place on the bottom nav). */
  settingsContent?: ReactNode;
  /** Something from the coach in the chat not yet read: the dot on the Messages tab. */
  chatUnread?: boolean;
  /** The coach's phone preview (21 Oct), in the admin's panel: the app as the client sees it, read-only. Nothing can be
      tapped and nothing is written (no read marks, no tab memory, no push or health sync); the admin says which screen
      to show and when to read the page again (PhoneMessage). */
  readOnly?: boolean;
  /** A coach looking at this client's app: whose it is, and the others to switch to. */
  preview?: { current: { id: number; name: string }; clients: { id: number; name: string }[] } | null;
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
  /** The client's own photo from Settings (9 Oct): on the Events rows they added. */
  clientAvatarPath?: string | null;
  /** Today's food diary (the Nutrition tab draws it): its meal pictures are fetched ahead. */
  foodDiary?: FoodDiaryProps | null;
  /** Every call with the coach: to come and past, for the Meetings screen. */
  meetings?: MeetingsProps | null;
  /** The coach's invoices that reached the client; null, none yet (the menu leaves the row out). */
  invoices?: InvoicesProps | null;
  /** A screen to open on arrival: a lock-screen notification's link (/client?open=invoices), or the preview's screen. */
  initialPush?: Exclude<PhoneScreen, "home" | "training" | "nutrition"> | null;
  /** What a phone push asks to open (24 Oct): its notification, done as a tap on it in the list does, or a call. */
  arrival?: Arrival | null;
  /** The tab the client was on (its cookie), so the server draws that one. */
  initialTab?: string | null;
}) {
  const storedTab = useSyncExternalStore(subscribeTab, readTab, () => initialTab);
  // The preview keeps its tab to itself: the coach's own tab memory (storage, cookie) is the coach's.
  const [ownTab, setOwnTab] = useState(initialTab);
  const tabNow = readOnly ? ownTab : storedTab;
  const activeId = tabNow && tabs.some((t) => t.id === tabNow) ? tabNow : tabs[0]?.id;
  const setActiveId = (id: string) => {
    // A tab comes back at its top (11 Nov, Alex: "defaulted to always be at the top"): the one left goes back up while it
    // is still showing, since a hidden box can't be scrolled.
    if (id !== activeId) {
      const left = activeId ? scrollers.current[activeId] : null;
      if (left) left.scrollTop = 0;
    }
    if (readOnly) setOwnTab(id);
    else writeTab(id);
  };
  // Pushed views start closed on a reload, since they hang off something on the tab underneath.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(OLD_PUSH_KEY);
    } catch {
      /* blocked storage: nothing kept there */
    }
  }, []);
  // A pushed screen opens only when this client has it (no invoices, no Invoices).
  // Today's meal pictures and the saved meals' fetched ahead (10 Nov, Alex: as the chat's), a moment after the app is up, so
  // the food diary opens on them.
  const mealPictures = foodDiary && !readOnly ? [...new Set([...foodDiary.meals.map((m) => m.picture), ...foodDiary.saved.map((s) => s.picture)].filter((p): p is string => !!p))].slice(0, 24).join("\n") : "";
  useEffect(() => {
    if (!mealPictures) return;
    const t = setTimeout(() => {
      for (const p of mealPictures.split("\n")) new window.Image().src = pic(p, 1080);
    }, 1200);
    return () => clearTimeout(t);
  }, [mealPictures]);
  const canPush = (v: PushView) => !(v === "invoices" && !invoices) && !(v === "meetings" && !meetings) && !(v === "events" && !events);
  const [chosenPush, setChosenPush] = useState<PushView | undefined>(initialPush && canPush(initialPush) ? initialPush : undefined);
  // The link has done its job: a reload opens the app as usual. (The preview keeps its address: it is read again in place.)
  // Arriving on the chat (a message's lock-screen notification, 21 Oct) reads it, as opening it from the nav does.
  useEffect(() => {
    if (!initialPush || readOnly) return;
    window.history.replaceState(null, "", "/client");
    if (initialPush === "messages") void markCoachNotesReadAction(clientId).catch(() => {});
  }, [initialPush, readOnly, clientId]);
  const pushView: PushView = chosenPush ?? null;
  // The workout's saves kept on the phone go from here (7 Nov, workoutOutbox.ts): on opening, the signal back, the app
  // back in front. Never in the coach's phone preview: there nothing is read, shown or sent.
  useWorkoutOutboxRunner(clientId, !readOnly);
  // The event Events opens on, from a notification (10 Oct); cleared when the screen closes.
  const [eventFocus, setEventFocus] = useState<number | null>(null);
  const openEventsAt = events
    ? (eventId?: number) => {
        setEventFocus(eventId ?? null);
        setPushView("events");
      }
    : null;
  // The call Meetings opens on, from a notification (10 Oct); cleared when the screen closes.
  const [meetingFocus, setMeetingFocus] = useState<number | null>(null);
  const openMeetingsAt = meetings
    ? (meetingId?: number) => {
        setMeetingFocus(meetingId ?? null);
        setPushView("meetings");
      }
    : null;
  const setPushView = (v: PushView) => setChosenPush(v);
  // The coach's profile opened from Settings goes back to Settings.
  const [coachFromSettings, setCoachFromSettings] = useState(false);
  // Which check-in section to land on, set by whichever due item opened it.
  const [checkInSection, setCheckInSection] = useState("daily");
  // … and, from a coach's message about one day, week or month of it, that one (21 Oct).
  const [checkInPeriod, setCheckInPeriod] = useState<string | null>(null);
  const openCheckIn = (section: string, period: string | null = null) => {
    setCheckInSection(section);
    setCheckInPeriod(period);
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
    // The client reading them, not a coach looking.
    if (readOnly) return;
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
  // Shape update's banner photo, fetched once the page has loaded so it never competes with Home's own pictures, and
  // there the moment the screen opens (4 Nov, Alex).
  useEffect(() => {
    const warm = () => setTimeout(warmShapeUpdateBanner, 300);
    if (document.readyState === "complete") {
      const t = warm();
      return () => clearTimeout(t);
    }
    let t: ReturnType<typeof setTimeout> | undefined;
    const onLoad = () => (t = warm());
    window.addEventListener("load", onLoad, { once: true });
    return () => {
      window.removeEventListener("load", onLoad);
      if (t) clearTimeout(t);
    };
  }, []);
  // The phone's timezone, for the server: Home's greeting and a call's time
  // are drawn in it from the first paint instead of changing a moment later.
  useEffect(() => {
    if (readOnly) return;
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) document.cookie = `ironline_tz=${encodeURIComponent(zone)}; path=/; max-age=31536000; samesite=lax`;
    } catch {}
  }, []);
  // Which row the tab we're switching to should open on arrival, set only by
  // a notification's deep link and cleared by any ordinary nav tap.
  const [focusRef, setFocusRef] = useState<number | null>(null);
  // The invoice a notification opened Invoices on.
  const [invoiceFocus, setInvoiceFocus] = useState<number | null>(null);
  // With a link into Training: the week to land on and the exercise to open.
  const [trainingFocus, setTrainingFocus] = useState<TrainingFocus | null>(null);
  // Where a link into Nutrition lands: its day and meal (12 Nov, Alex: Nutrition is the food diary).
  const [foodFocus, setFoodFocus] = useState<FoodFocus | null>(null);
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
      if (invoices) {
        // On that invoice (24 Oct, Alex: a link lands on its thing).
        setInvoiceFocus(ref ?? null);
        setPushView("invoices");
      }
      return;
    }
    // Settings left the bottom nav for the burger (7 Oct): a report notification still gets there, on its report
    // (24 Oct, Alex: the id never reached it).
    if (tab === "settings") {
      if (settingsContent) {
        setFocusRef(ref ?? null);
        setPushView("settings");
      }
      return;
    }
    // The coach's note on the lifestyle phase (21 Oct) sits at the top of the check-in.
    if (tab === "checkin") {
      openCheckIn("daily");
      return;
    }
    if (!tabs.some((t) => t.id === tab)) return;
    setScrolled(false);
    setPushView(null);
    setActiveId(tab);
    setFocusRef(ref ?? null);
    setTrainingFocus(focus ?? null);
    setFoodFocus(null);
    // Sent to something inside it: that tab comes up fresh, at its top.
    setRebuilt((r) => ({ ...r, [tab]: (r[tab] ?? 0) + 1 }));
  };

  // A coach message's link: straight to the thing it is about, from Home's
  // card or the messages feed. One that can no longer open does nothing.
  // Opened from the chat, Back comes back to the chat instead of the tab
  // underneath: this names the screen that should (a session in Training
  // carries it in its focus instead).
  const [chatReturn, setChatReturn] = useState<"checkin" | "photos" | "nutrition" | null>(null);
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
        // Nutrition is the diary (12 Nov, Alex): it comes up fresh on the day, the meal open, lit. Set after goToTab,
        // which clears it.
        goToTab("nutrition");
        setFoodFocus({ date: l.date, meal: l.meal ?? null });
        returnTo("nutrition");
        return;
      case "checkin":
        openCheckIn(l.section, l.period ?? null);
        returnTo("checkin");
        return;
      case "photos":
        setPhotosPeriod(l.period ?? null);
        setPushView("photos");
        returnTo("photos");
        return;
    }
  };
  // A phone push's arrival (24 Oct, Alex: a push lands on its thing): once, what a tap on its notification does, then
  // the address goes back to plain /client so a reload opens the app as usual.
  const arrived = useRef(false);
  useEffect(() => {
    if (!arrival || readOnly || arrived.current) return;
    arrived.current = true;
    const t = setTimeout(() => {
      window.history.replaceState(null, "", "/client");
      if ("meetingId" in arrival) {
        openMeetingsAt?.(arrival.meetingId);
        return;
      }
      void markNotificationReadAction(arrival.notificationId).catch(() => {});
      const { category, actionTab, actionRef, link } = arrival;
      if (link && !link.gone) openLink(link);
      else if (actionTab === "chat" || actionTab === "video") openMessages();
      else if (category === "event_added" || category === "event_changed") openEventsAt?.(actionRef ?? undefined);
      // A weight goal (2 Nov, Alex): the Events screen on the goal's row, as a tap in the list does.
      else if (category === "weight_goal") openEventsAt?.(actionRef != null ? goalItemId(actionRef) : undefined);
      else if (category === "meeting_booked" || category === "meeting_changed" || category === "meeting_notes") openMeetingsAt?.(actionRef ?? undefined);
      else if (category === "checkin_comment") openCheckIn("daily");
      else if (actionTab) goToTab(actionTab, actionTab === "training" ? undefined : actionRef ?? undefined);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arriving
  }, []);
  const backToChat = () => {
    setChatReturn(null);
    setMessageAbout(null);
    setPushView("messages");
  };
  // Back on a pushed screen: to the chat when that is where it came from.
  const backFrom = (v: NonNullable<typeof chatReturn>) => () => (chatReturn === v ? backToChat() : setPushView(null));

  // The preview, told by the admin's panel which screen to show (it follows the coach's tab), and to read the page
  // again after a save: in place, so the screen keeps its scroll. Only from this site's own pages.
  const router = useRouter();
  useEffect(() => {
    if (!readOnly) return;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const m = e.data as PhoneMessage | null;
      if (m?.norcoach !== "phone") return;
      if (m.refresh) router.refresh();
      // The food diary is Nutrition now (12 Nov): an older admin asking for it gets Nutrition.
      const s = (m.screen as string) === "food" ? "nutrition" : m.screen;
      if (!s) return;
      if (PHONE_TABS.has(s)) {
        setChosenPush(null);
        setOwnTab(s);
        setScrolled((scrollers.current[s]?.scrollTop ?? 0) > 4);
        return;
      }
      if (s === "checkin") setCheckInSection("daily");
      if (s === "photos") setPhotosPeriod(null);
      if (canPush(s as PushView)) setChosenPush(s as PushView);
    };
    window.addEventListener("message", onMessage);
    // Listening now: the panel sends the screen it wants (it may have changed while this loaded).
    window.parent?.postMessage({ norcoach: "phone-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
    // canPush reads which screens this client has; re-armed when that changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, router, !!invoices, !!foodDiary, !!meetings, !!events]);

  const pushedLayer =
    pushView === "checkin" ? (
      <div className="app-layer app-layer-push cn-screen">
        <CheckInScreen
          clientId={clientId}
          dateLabel={checkIn.dateLabel}
          today={checkIn.today}
          sections={checkIn.sections}
          initialSection={checkInSection}
          focusPeriod={checkInPeriod}
          dueSections={checkIn.dueSections}
          weeklyOpen={checkIn.weeklyOpen}
          monthlyOpen={checkIn.monthlyOpen}
          objectives={checkIn.objectives}
          coachNote={checkIn.coachNote}
          history={checkIn.history}
          stats={checkIn.stats}
          calendar={checkIn.calendar}
          pictures={checkIn.pictures}
          onBack={backFrom("checkin")}
        />
      </div>
    ) : pushView === "coach" && coachProfile ? (
      <div className="app-layer app-layer-push cpf-layer">
        {/* "Book a call" lands on Home, where the next meeting card is. */}
        <CoachProfileScreen
          profile={coachProfile}
          onBack={() => {
            setCoachFromSettings(false);
            setPushView(coachFromSettings ? "settings" : null);
          }}
          onBook={() => {
            setCoachFromSettings(false);
            goToTab("home");
          }}
        />
      </div>
    ) : pushView === "photos" ? (
      <div className="app-layer app-layer-push pp-app-screen">
        <ProgressPicturesScreen data={photos} initialPeriod={photosPeriod} onBack={backFrom("photos")} />
      </div>
    ) : pushView === "meetings" && meetings ? (
      <div className="app-layer app-layer-push cn-screen">
        <MeetingsScreen {...meetings} clientId={clientId} coachName={coachMessages.coachName} focusId={meetingFocus} onBack={() => (setMeetingFocus(null), setPushView(null))} />
      </div>
    ) : pushView === "invoices" && invoices ? (
      <div className="app-layer app-layer-push cn-screen">
        <InvoicesScreen {...invoices} focusId={invoiceFocus} onBack={() => setPushView(null)} />
      </div>
    ) : pushView === "messages" ? (
      <div className="app-layer app-layer-push cn-screen">
        <CoachMessagesScreen {...coachMessages} clientId={clientId} onBack={() => setPushView(null)} about={messageAbout} onClearAbout={() => setMessageAbout(null)} />
      </div>
    ) : pushView === "events" && events ? (
      <div className="app-layer app-layer-push cn-screen">
        <EventsScreen clientId={clientId} events={events} coachName={coachMessages.coachName.trim().split(/\s+/)[0] || "Coach"} today={checkIn.today} me={{ name: clientName.trim().split(/\s+/)[0] ?? "", photoPath: clientAvatarPath }} focusId={eventFocus} onBack={() => (setEventFocus(null), setPushView(null))} />
      </div>
    ) : pushView === "settings" && settingsContent ? (
      <div className="app-layer app-layer-push cn-screen">
        <header className="cn-header">
          <button type="button" className="cn-icon-btn" onClick={() => setPushView(null)} aria-label="Back">
            <ChevronLeftIcon />
          </button>
          <div className="cn-header-titles">
            <h1 className="cn-title">Settings</h1>
          </div>
          <span className="cn-icon-spacer" aria-hidden="true" />
        </header>
        <main className="cn-body cn-body-settings">
          <MessagesProvider value={openMessages}>
            {/* Your coach, at the top of Settings (12 Nov, Alex): Back on the profile comes back here. */}
            <CoachProvider
              value={
                coachProfile
                  ? () => {
                      setCoachFromSettings(true);
                      setPushView("coach");
                    }
                  : null
              }
            >
              {/* Settings' Progress pictures row (17 Oct): it sat outside the photos bridge, so the tap did nothing. */}
              <PhotosProvider
                value={() => {
                  setPhotosPeriod(null);
                  setPushView("photos");
                }}
              >
                <NavigateProvider value={goToTab}>
                  <FocusRefProvider value={focusRef}>{settingsContent}</FocusRefProvider>
                </NavigateProvider>
              </PhotosProvider>
            </CoachProvider>
          </MessagesProvider>
        </main>
      </div>
    ) : pushView ? (
      <div className="app-layer app-layer-push cn-screen">
        {/* The screen draws its own header (Back, the title, Mark all read; 9 Oct). A row opens the chat, an event, a call, or a tab. */}
        <BackProvider value={() => setPushView(null)}>
          <MessagesProvider value={openMessages}>
            <EventsProvider value={openEventsAt}>
              <MeetingsProvider value={openMeetingsAt}>
                <CheckInProvider value={openCheckIn}>
                  <NavigateProvider value={goToTab}>{notificationsContent}</NavigateProvider>
                </CheckInProvider>
              </MeetingsProvider>
            </EventsProvider>
          </MessagesProvider>
        </BackProvider>
      </div>
    ) : null;

  return (
    <CoachIdentityProvider value={{ name: coachMessages.coachName, photoPath: coachAvatarPath }}>
      <LinkProvider value={openLink}>
      {!readOnly && <HealthAutoSync />}
      {!readOnly && <NativeStatusBar />}
      {!readOnly && <NativePush />}
      <div
        className={`phone-frame${preview ? " previewing" : ""}${readOnly ? " phone-readonly" : ""}`}
        {...(readOnly ? { onClickCapture: stopEvent, onPointerDownCapture: stopEvent, onMouseDownCapture: stopEvent, onKeyDownCapture: stopEvent, onSubmitCapture: stopEvent, onDragStartCapture: stopEvent, onContextMenuCapture: stopEvent } : {})}
      >
        {preview && <PreviewBar current={preview.current} clients={preview.clients} />}
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
            <NorCoachLogo className="app-header-brand" word />
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
                <MeetingsProvider value={openMeetingsAt}>
                <EventsProvider value={openEventsAt}>
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
                                <TabActiveProvider value={t.id === activeId && !pushView}>
                                  <TabShownProvider value={t.id === activeId}>
                                    <FoodFocusProvider value={t.id === activeId ? foodFocus : null}>
                                      <TrainingFocusProvider value={t.id === activeId ? trainingFocus : null}>{t.content}</TrainingFocusProvider>
                                    </FoodFocusProvider>
                                  </TabShownProvider>
                                </TabActiveProvider>
                              </FocusRefProvider>
                            </main>
                          ))}
                      </NavigateProvider>
                    </NotificationsProvider>
                  </CoachProvider>
                </EventsProvider>
                </MeetingsProvider>
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
                  // The tab at its top (setActiveId takes the one left back up).
                  setChatReturn(null);
                  setScrolled(false);
                  setActiveId(t.id);
                  setFocusRef(null);
                  setFoodFocus(null);
                }}
              >
                <span className="app-tab-icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="app-tab-label">{t.label}</span>
              </button>
            ))}
            {/* The chat, fourth (7 Oct): it opens over the tab underneath and
                keeps its own Back, so the tab is found as it was left. */}
            <button type="button" className={`app-tab-btn${pushView === "messages" ? " active" : ""}`} onClick={() => pushView !== "messages" && openMessages()}>
              <span className="app-tab-icon" aria-label={`Messages with ${coachMessages.coachName}`}>
                <ChatIcon />
              </span>
              <span className="app-tab-label">Chat</span>
              {chatUnread && pushView !== "messages" && <span className="app-tab-badge" aria-hidden="true" />}
            </button>
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
                  <NorCoachLogo className="app-header-brand app-menu-brand" />
                  {/* The coach's business, hardcoded like the rail and the Settings
                      footnote until the coach profile carries it. */}
                  <span className="app-menu-name">Full Potential Coaching</span>
                </div>
                <div className="app-menu-list">
                  {meetings && (
                    <button type="button" className="app-menu-item" onClick={() => go(() => setPushView("meetings"))}>
                      <span className="app-menu-ico"><CalendarIcon /></span>
                      Meetings
                    </button>
                  )}
                  {/* Events (9 Oct): the deliberate way in; the Home card is the quick one. */}
                  {events && (
                    <button type="button" className="app-menu-item" onClick={() => go(() => setPushView("events"))}>
                      {/* A ticket, not a flag: the flag is a phase's (4 Nov, Alex: option D of docs/boards/events-icon-mockup.html). */}
                      <span className="app-menu-ico">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M3.5 8a2 2 0 0 0 0 4a2 2 0 0 1 0 4V18a1.5 1.5 0 0 0 1.5 1.5h14A1.5 1.5 0 0 0 20.5 18v-2a2 2 0 0 1 0-4a2 2 0 0 1 0-4V6A1.5 1.5 0 0 0 19 4.5H5A1.5 1.5 0 0 0 3.5 6z" />
                          <path d="M14.5 4.5v15" strokeDasharray="2 2.4" />
                        </svg>
                      </span>
                      Events
                    </button>
                  )}
                  {/* Check-in (12 Nov, Alex: A of docs/boards/hidden-ways-mockup.html): the whole screen, Entries,
                      Progress and Calendar, which before only an unmarked tap on Home opened. While a check-in is asked. */}
                  {checkIn.sections.length > 0 && (
                    <button type="button" className="app-menu-item" onClick={() => go(() => openCheckIn("daily"))}>
                      <span className="app-menu-ico"><HeartIcon /></span>
                      Check-in
                    </button>
                  )}
                  {/* Shape update: here alone, always (10 Nov, Alex: out of Settings). */}
                  <button
                    type="button"
                    className="app-menu-item"
                    onClick={() =>
                      go(() => {
                        setPhotosPeriod(null);
                        setPushView("photos");
                      })
                    }
                  >
                    <span className="app-menu-ico"><CameraIcon /></span>
                    Shape update
                  </button>
                  {invoices && (
                    <button type="button" className="app-menu-item" onClick={() => go(() => {
                      setInvoiceFocus(null);
                      setPushView("invoices");
                    })}>
                      <span className="app-menu-ico"><ReceiptIcon /></span>
                      Invoices
                    </button>
                  )}
                  {settingsContent && (
                    <button type="button" className="app-menu-item" onClick={() => go(() => {
                      // From the menu: Settings at its top, not on a report a notification opened earlier.
                      setFocusRef(null);
                      setPushView("settings");
                    })}>
                      <span className="app-menu-ico"><GearIcon /></span>
                      Settings
                    </button>
                  )}
                  {/* Help writes to the coach: the person who can actually do something. */}
                  {helpEmail && (
                    <a
                      className="app-menu-item app-menu-item-link"
                      href={`mailto:${helpEmail}?subject=${encodeURIComponent("Norcoach app")}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span className="app-menu-ico">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" />
                          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01" />
                        </svg>
                      </span>
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
                  <span className="app-menu-footnote"><Bars parts={["Norcoach", "Full Potential Coaching"]} /></span>
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
