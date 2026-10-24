"use client";

import { memo, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChatIcon } from "../../components/icons";
import { OpenChatContext, type OpenChat } from "./ChatPanel";
import { Toaster } from "../../components/ui/toast";
import TrainingDraft, { type CardioMove, type DraftProgram, type Library } from "./training/TrainingDraft";
import NutritionDraft, { type DraftNutrition } from "./nutrition/NutritionDraft";
import MeasurementsDraft, { type DraftMeasurements } from "./measurements/MeasurementsDraft";
import PicturesDraft, { type DraftPictures } from "./pictures/PicturesDraft";
import MeetingsDraft, { type DraftMeetings } from "./meetings/MeetingsDraft";
import PlanDraft, { type DraftPlan } from "./plan/PlanDraft";
import HomeDraft, { type DraftHome } from "./home/HomeDraft";
import NoProgramme from "./training/NoProgramme";
import NoPhase from "./NoPhase";
import MessagesDraft, { type DraftLink, type DraftMessages } from "./messages/MessagesDraft";
import { chatDraftThreadAction, chatListAction } from "./messages/actions";
import ChatList, { ChatsBack, type DockChat } from "./ChatList";
import InvoicesDraft from "./invoices/InvoicesDraft";
import RedesignRail from "./RedesignRail";
import PhonePreview, { SCREEN_FOR_TAB } from "./PhonePreview";
import type { PhoneScreen } from "../../client/AppShell";
import type { DraftInvoices, RailData } from "./loaders";
import type { DotTab, DotTrail } from "./dots";
import { useCloseOnEmptyClick } from "./useCloseOnEmptyClick";

// The redesign drafts on one page: the rail on the left, and Training,
// Nutrition and Measurements all loaded on the right, one shown at a time.
// A switch is instant and keeps what was typed on the other tab; the
// address follows, so a refresh or a link lands on the tab it names.

const TABS = [
  { key: "home", label: "Home" },
  { key: "plan", label: "Plan" },
  // Lifestyle, Training, Nutrition (20 Oct, Alex), the Plan's lane order.
  { key: "measurements", label: "Lifestyle" },
  { key: "training", label: "Training" },
  { key: "nutrition", label: "Nutrition" },
  { key: "pictures", label: "Shape update" },
  { key: "meetings", label: "Meetings" },
  { key: "invoices", label: "Invoices" },
] as const;
// Messages stopped being a tab (2 Oct): the chat is the panel from the right,
// over any tab. Its address (/admin/redesign/messages) still opens it, on Home.
type PageTab = (typeof TABS)[number]["key"];
export type RedesignTab = PageTab | "messages";
type ChatState = { mounted: boolean; open: boolean; about: DraftLink | null; opened: number; focus: number | null };
/** What the chat panel shows (21 Oct, Alex): this client's thread, every chat, or another client's thread, the page staying put. */
type ChatView = "own" | "list" | "other";
/** The panel shows the chat, or the client's phone (21 Oct, Alex: the coach sees what the client sees). */
type PanelMode = "chat" | "phone";
const CHAT_LIST_POLL_MS = 15000;
const firstOf = (name: string) => name.split(" ")[0];

// Every tab stays mounted (what was typed on one survives a switch), so a
// page read used to redraw all eight, hidden ones too, after any save: a
// stutter, and scroll and focus moving under the coach's hands. A tab is now
// redrawn only when its own data changed (2 Oct); its callbacks keep one
// identity (show, openChat), so they are left out of the comparison.
const sameData = (a: object, b: object) => {
  const x = a as Record<string, unknown>;
  const y = b as Record<string, unknown>;
  return Object.keys({ ...x, ...y }).every((k) => (typeof x[k] === "function" && typeof y[k] === "function") || x[k] === y[k] || JSON.stringify(x[k]) === JSON.stringify(y[k]));
};
const HomeTab = memo(HomeDraft, sameData);
const TrainingTab = memo(TrainingDraft, sameData);
const NutritionTab = memo(NutritionDraft, sameData);
const MeasurementsTab = memo(MeasurementsDraft, sameData);
const PicturesTab = memo(PicturesDraft, sameData);
const MeetingsTab = memo(MeetingsDraft, sameData);
const PlanTab = memo(PlanDraft, sameData);
const InvoicesTab = memo(InvoicesDraft, sameData);

export type RedesignShellProps = {
  clientId: number;
  clientName: string;
  firstName: string;
  rail: RailData;
  initialTab: RedesignTab;
  home: DraftHome;
  training: { draft: DraftProgram | null; library: Library; cardioMoves?: CardioMove[]; videos?: { id: number; path: string; name: string; at: string; bytes: number | null }[] };
  nutrition: DraftNutrition;
  measurements: DraftMeasurements;
  pictures: DraftPictures;
  meetings: DraftMeetings;
  plan: DraftPlan;
  messages: DraftMessages;
  invoices: DraftInvoices;
  /** What the coach owes this client, placed (dots.ts): a rust dot on the tab, and down to the thing on it. */
  dots: DotTrail;
};

export default function RedesignShell({ clientId, clientName, firstName, rail, initialTab, home, training, nutrition, measurements, pictures, meetings, plan, messages, invoices, dots }: RedesignShellProps) {
  const pageTab = (t: RedesignTab): PageTab => (t === "messages" ? "home" : t);
  const [tab, setTab] = useState<PageTab>(pageTab(initialTab));
  // The chat sliding in from the right (ChatPanel.tsx): mounted on first
  // use, then kept, so it slides both ways; `opened` counts the openings,
  // so each one sets what the reply is about (and the message to land on).
  const [chat, setChat] = useState<ChatState>({ mounted: false, open: false, about: null, opened: 0, focus: null });
  const closeChat = () => setChat((c) => ({ ...c, open: false }));
  // A click on empty space closes it, one on anything with a function doesn't (24 Oct, Alex).
  useCloseOnEmptyClick(chat.open, closeChat);
  // All chats (21 Oct, Alex): the panel can show every chat and another
  // client's thread, so someone else writing is answered without leaving
  // this client's page. This client's thread stays mounted behind (what was
  // typed in it survives); the list asks for itself while the panel is open.
  const [view, setView] = useState<ChatView>("own");
  const [chats, setChats] = useState<DockChat[] | null>(null);
  const [other, setOther] = useState<DockChat | null>(null);
  // The last other client's thread stays mounted behind too (hidden), so a reply half-typed to them survives All chats.
  const [otherThread, setOtherThread] = useState<{ id: number; name: string; plan: DraftMessages } | null>(null);
  const [otherOpened, setOtherOpened] = useState(0);
  const picking = useRef<number | null>(null);
  // When each chat was last left on screen: a dot stays off until something newer.
  const [seenAt, setSeenAt] = useState<Record<number, number>>({});
  // The same function for the life of the page (2 Oct): it reaches every tab
  // through OpenChatContext, and a new one each render redrew them all.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = chat.mounted;
  }, [chat.mounted]);
  const [mode, setMode] = useState<PanelMode>("chat");
  const openChat = useCallback((about?: Parameters<OpenChat>[0], focus: number | null = null) => {
    // Opened from the page (its tab, a reply), it is this client's thread.
    setMode("chat");
    setView("own");
    picking.current = null;
    const next = (c: ChatState) => ({ mounted: true, open: true, about: about ? { ...about, gone: false } : null, opened: c.opened + 1, focus });
    if (mountedRef.current) setChat(next);
    else {
      // In closed first, then open a frame later, so even the first one slides.
      mountedRef.current = true;
      setChat((c) => ({ ...c, mounted: true }));
      requestAnimationFrame(() => requestAnimationFrame(() => setChat(next)));
    }
  }, []);
  // The phone (21 Oct): mounted on its first opening, then kept, so it is read again in place rather than loaded anew.
  const [phoneMounted, setPhoneMounted] = useState(false);
  const openPhone = () => {
    setMode("phone");
    setPhoneMounted(true);
    if (mountedRef.current) setChat((c) => ({ ...c, open: true }));
    else {
      // In closed first, then open a frame later, so even the first one slides.
      mountedRef.current = true;
      setChat((c) => ({ ...c, mounted: true }));
      requestAnimationFrame(() => requestAnimationFrame(() => setChat((c) => ({ ...c, open: true }))));
    }
  };
  // The chat tab's dot: the chat reads its own thread now, not the page, so
  // opening it clears the dot here, until a newer message from the client.
  const newestFromClient = messages.messages.find((m) => !m.mine)?.id ?? null;
  const [seenNewest, setSeenNewest] = useState<number | null>(null);
  // Seen only while this client's own thread is on screen (not All chats, not another client's thread).
  if (chat.open && mode === "chat" && view === "own" && seenNewest !== newestFromClient) setSeenNewest(newestFromClient);
  const chatDot = !!messages.unread && seenNewest !== newestFromClient;
  const panelRef = useRef<HTMLElement>(null);
  // Every chat, asked for on opening and every 15 s while open (as the thread polls).
  const pullChats = useCallback(() => {
    chatListAction()
      .then(setChats)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!chat.open || mode !== "chat") return;
    pullChats();
    const id = setInterval(pullChats, CHAT_LIST_POLL_MS);
    return () => clearInterval(id);
  }, [chat.open, mode, pullChats]);
  const inOther = view === "other" && other != null && otherThread?.id === other.id;
  const shownId = view === "own" ? clientId : inOther ? other.id : null;
  const isUnread = (c: DockChat) => c.unread && (c.last?.at ?? 0) > (seenAt[c.id] ?? 0);
  const othersUnread = (chats ?? []).filter((c) => c.id !== shownId && isUnread(c)).length;
  const toChatList = () => {
    if (shownId != null) setSeenAt((s) => ({ ...s, [shownId]: Date.now() }));
    picking.current = null;
    setView("list");
    pullChats();
  };
  const pickChat = async (c: DockChat) => {
    setSeenAt((s) => ({ ...s, [c.id]: Date.now() }));
    if (c.id === clientId) {
      picking.current = null;
      setView("own");
      // The list goes, so the keyboard lands in this client's box (no `opened` bump: that would reset the link set).
      requestAnimationFrame(() => panelRef.current?.querySelector<HTMLTextAreaElement>(".rd-chatview.own .rm-box")?.focus({ preventScroll: true }));
      return;
    }
    // The thread kept behind shows at once, with its reply and link, and takes the keyboard; what is new comes in under it.
    const kept = otherThread?.id === c.id;
    picking.current = c.id;
    setOther(c);
    setView("other");
    if (kept) requestAnimationFrame(() => panelRef.current?.querySelector<HTMLTextAreaElement>(".rd-chatview.other .rm-box")?.focus({ preventScroll: true }));
    const plan = await chatDraftThreadAction(c.id).catch(() => null);
    if (picking.current !== c.id) return;
    if (kept) {
      if (plan) setOtherThread({ id: c.id, name: c.name, plan });
      return;
    }
    if (!plan) {
      // Not theirs to open (or the call failed): back on the list.
      setOther(null);
      return;
    }
    setOtherThread({ id: c.id, name: c.name, plan });
    // A new thread lands on its newest message with the box ready.
    setOtherOpened((n) => n + 1);
  };
  // Open, it stays open (9 Oct): across tabs, through clicks on the page.
  // Only Escape and its own X close it. The page makes room beside it (the
  // rd-frame attribute below), so nothing sits behind it.
  useEffect(() => {
    if (!chat.open) return;
    // An Escape something else already used (a menu in the panel, the phone's screen picker) closes that alone.
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && !document.querySelector("[role=dialog]") && closeChat();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat.open]);
  // Another client: land where the address says (Home from the rail), never on the last client's tab.
  const [seenClient, setSeenClient] = useState(clientId);
  if (seenClient !== clientId) {
    setSeenClient(clientId);
    setTab(pageTab(initialTab));
    setChat({ mounted: false, open: false, about: null, opened: 0, focus: null });
    setMode("chat");
    setPhoneMounted(false);
    setView("own");
    setOther(null);
    // The page's client now: their thread is the page's own, never a second copy behind it.
    setOtherThread((t) => (t?.id === clientId ? null : t));
  }
  // The address asks for the chat: /messages, or ?chat=<message> from the
  // feed or Home (the page under it is what the message is about). It opens
  // once, on that message, and the ask leaves the address.
  const params = useSearchParams();
  const askedChat = params.get("chat");
  const wantChat = askedChat != null || initialTab === "messages";
  const handledAsk = useRef<string | null>(null);
  const askKey = wantChat ? `${clientId}:${askedChat ?? "tab"}` : null;
  useEffect(() => {
    if (!askKey || askKey === handledAsk.current) return;
    handledAsk.current = askKey;
    openChat(null, Number(askedChat) || null);
    if (askedChat != null) {
      const url = new URL(window.location.href);
      url.searchParams.delete("chat");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once an ask
  }, [askKey]);
  // Each tab keeps its own place on the page: leaving one remembers how far
  // down it was, coming back puts it there (a new one opens at the top).
  const scrolls = useRef<Partial<Record<PageTab, number>>>({});
  // The tab showing, for show(): it keeps one identity per client, so Home's
  // copy of it is never a stale one.
  const tabRef = useRef(tab);
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);
  const show = useCallback(
    (asked: RedesignTab) => {
      // "Messages" (Home's events) is the chat, over the tab that is open.
      if (asked === "messages") {
        openChat();
        return;
      }
      const t = asked;
      scrolls.current[tabRef.current] = window.scrollY;
      tabRef.current = t;
      setTab(t);
      requestAnimationFrame(() => window.scrollTo(0, scrolls.current[t] ?? 0));
      // The address follows as ?tab= on the route that is mounted (9 Oct). It
      // used to rewrite the path to the tab's own route while this page stayed
      // mounted; the next refresh (any save revalidates) then fetched that
      // other route, and the whole shell remounted: the chat closed and the
      // tab snapped back to the route's own. Other tabs' query (week,
      // programme, phase) stays out of the address.
      // The hairline preview's ?look= stays (19 Oct): a reload kept the tab but lost the look.
      const look = new URLSearchParams(window.location.search).get("look");
      window.history.replaceState(null, "", `${window.location.pathname}?client=${clientId}&tab=${t}${look ? `&look=${encodeURIComponent(look)}` : ""}`);
    },
    [clientId, openChat]
  );
  const openTab = useCallback((t: string) => show(t as RedesignTab), [show]);
  // The phone follows the coach's tab (the screen a change made there shows on); a pick in the panel holds until the next tab.
  const [phoneScreen, setPhoneScreen] = useState<PhoneScreen>(SCREEN_FOR_TAB[tab] ?? "home");
  // Per client too: a screen picked for one client never opens the next one's phone.
  const phoneFor = `${clientId}:${tab}`;
  const [phoneTab, setPhoneTab] = useState(phoneFor);
  if (phoneTab !== phoneFor) {
    setPhoneTab(phoneFor);
    setPhoneScreen(SCREEN_FOR_TAB[tab] ?? "home");
  }
  // A new object each time the page is read again (after any save): the phone reads again too.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the data, not used inside: its identity is the signal
  const phoneStamp = useMemo(() => ({}), [home, training, nutrition, measurements, pictures, meetings, plan, invoices, messages]);
  // A track with no phase and nothing set up yet opens on one button,
  // "Create a … phase" (NoPhase). Anything already there (targets, logs,
  // metrics) keeps the usual screen, phase or not.
  const hasPhase = (track: string) => plan.phases.some((p) => p.track === track);
  const noMacros = (m: { protein: number | null; carbs: number | null; fats: number | null }) => m.protein == null && m.carbs == null && m.fats == null;
  const nutritionBlank = !hasPhase("nutrition") && noMacros(nutrition.training) && noMacros(nutrition.rest) && nutrition.waterL == null && !nutrition.note.trim() && nutrition.supplements.length === 0 && nutrition.logged.days.length === 0;
  // A metric line with no phase and nothing logged is no lifestyle set up (22 Oct, Alex: "has to be completely empty").
  const measurementsBlank = !hasPhase("lifestyle") && measurements.daily.periods.length === 0 && measurements.weekly.periods.length === 0 && (measurements.monthly?.periods.length ?? 0) === 0 && measurements.notes.length === 0;
  return (
    <OpenChatContext.Provider value={openChat}>
    <div className="rd-frame" data-chat={chat.open ? "open" : undefined}>
      <RedesignRail rail={rail} clientId={clientId} />
      <div className="rd-page">
        <nav className="rd-nav" aria-label="Redesign drafts">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={t.key === tab ? "on" : ""} aria-current={t.key === tab ? "page" : undefined} onClick={() => show(t.key)}>
              {t.label}
              {/* Something owed on this tab (22 Oct, Alex: the dot trail from the rail's number down to the thing). */}
              {dots.tabs.includes(t.key as DotTab) && <i className="rd-due rd-nav-due" role="img" aria-label="needs you" />}
            </button>
          ))}
        </nav>
        <div hidden={tab !== "home"}>
          {/* Keyed per client: Home's own state (What counts, rows marked read, the filter) is one client's. */}
          <HomeTab key={clientId} clientId={clientId} firstName={firstName} home={home} onOpenTab={openTab} dueUnlock={dots.unlock} />
        </div>
        <div hidden={tab !== "training"}>
          {training.draft ? (
            <TrainingTab key={training.draft.id} clientId={clientId} firstName={firstName} program={training.draft} library={training.library} cardioMoves={training.cardioMoves} coachVideos={training.videos} dots={dots} />
          ) : hasPhase("training") ? (
            <NoProgramme clientId={clientId} firstName={firstName} />
          ) : (
            <NoPhase clientId={clientId} firstName={firstName} track="training" plan={plan} />
          )}
        </div>
        <div hidden={tab !== "nutrition"}>
          {nutritionBlank ? <NoPhase clientId={clientId} firstName={firstName} track="nutrition" plan={plan} /> : <NutritionTab key={`${clientId}:${nutrition.id}`} clientId={clientId} firstName={firstName} plan={nutrition} dueFood={dots.food} />}
        </div>
        <div hidden={tab !== "measurements"}>
          {measurementsBlank ? <NoPhase clientId={clientId} firstName={firstName} track="lifestyle" plan={plan} /> : <MeasurementsTab key={`${clientId}:${measurements.id}`} clientId={clientId} firstName={firstName} plan={measurements} />}
        </div>
        <div hidden={tab !== "pictures"}>
          <PicturesTab clientId={clientId} firstName={firstName} plan={pictures} />
        </div>
        <div hidden={tab !== "meetings"}>
          <MeetingsTab clientId={clientId} firstName={firstName} plan={meetings} />
        </div>
        <div hidden={tab !== "plan"}>
          <PlanTab clientId={clientId} firstName={firstName} plan={plan} />
        </div>
        <div hidden={tab !== "invoices"}>
          <InvoicesTab clientId={clientId} firstName={firstName} clientName={clientName} plan={invoices} />
        </div>
      </div>
      {/* The chat's tab on the window's right edge, on every screen of a
          client: it slides the chat out. A dot while there is something from
          them not opened yet. */}
      {/* It stays out while the chat is open (12 Oct), on the panel's edge, and closes it. */}
      {/* With the phone on screen the chat's tab turns white (the one showing is ink) and brings the chat back. */}
      <button
        type="button"
        className={`rd-chattab${chat.open ? " open" : ""}${chat.open && mode === "phone" ? " off" : ""}`}
        onClick={() => (!chat.open ? openChat() : mode === "chat" ? closeChat() : setMode("chat"))}
        aria-label={chat.open && mode === "chat" ? "Close the chat" : `Chat with ${firstName}${chatDot ? ", new message" : ""}`}
        title={chat.open && mode === "chat" ? "Close the chat" : `Chat with ${firstName}`}
        aria-expanded={chat.open && mode === "chat"}
      >
        <ChatIcon />
        {chatDot && <i className="rd-chattab-dot" aria-hidden="true" />}
      </button>
      {/* The client's phone (21 Oct): under the chat's tab, the same panel, their app as they see it. */}
      <button
        type="button"
        className={`rd-chattab rd-phonetab${chat.open ? " open" : ""}${chat.open && mode === "phone" ? " on" : ""}`}
        onClick={() => (chat.open && mode === "phone" ? closeChat() : openPhone())}
        aria-label={chat.open && mode === "phone" ? `Close ${firstName}'s app` : `${firstName}'s app`}
        title={chat.open && mode === "phone" ? `Close ${firstName}'s app` : `${firstName}'s app`}
        aria-expanded={chat.open && mode === "phone"}
      >
        <PhoneIcon />
      </button>
      {chat.mounted && (
        <aside ref={panelRef} className={`rd-chatpanel rd-chatdock${chat.open ? " open" : ""}`} aria-label={mode === "phone" ? `${firstName}'s app` : view === "own" ? `Chat with ${firstName}` : inOther ? `Chat with ${firstOf(other.name)}` : "Chats"} aria-hidden={!chat.open} inert={chat.open ? undefined : true}>
          <div className="rd-panelpart" hidden={mode !== "chat"}>
          {/* All chats (21 Oct, Alex): the list, or a way back to it over a thread. */}
          {view === "own" || inOther ? (
            <ChatsBack unread={othersUnread} onClick={toChatList} />
          ) : (
            // Mounted only from ‹ All chats: the keyboard lands in its search.
            <ChatList chats={chats} title={view === "other" && other ? `Opening ${firstOf(other.name)}…` : "Chats"} here={clientId} isUnread={isUnread} onPick={(c) => void pickChat(c)} onClose={closeChat} autoFocus />
          )}
          <div className="rd-chatview own" hidden={view !== "own"}>
            <MessagesDraft clientId={clientId} firstName={firstName} plan={messages} active={chat.open && mode === "chat" && view === "own"} panel={{ about: chat.about, opened: chat.opened, onClose: closeChat, focus: chat.focus }} />
          </div>
          {otherThread && otherThread.id !== clientId && (
            <div className="rd-chatview other" hidden={!inOther}>
              <MessagesDraft key={otherThread.id} clientId={otherThread.id} firstName={firstOf(otherThread.name)} plan={otherThread.plan} active={chat.open && mode === "chat" && inOther} panel={{ about: null, opened: otherOpened, onClose: closeChat, focus: null }} />
            </div>
          )}
          </div>
          {phoneMounted && (
            <div className="rd-panelpart" hidden={mode !== "phone"}>
              <PhonePreview key={clientId} clientId={clientId} firstName={firstName} screen={phoneScreen} onScreen={setPhoneScreen} stamp={phoneStamp} active={chat.open && mode === "phone"} onClose={closeChat} />
            </div>
          )}
        </aside>
      )}
      <Toaster />
    </div>
    </OpenChatContext.Provider>
  );
}

/** A phone, in the icons' hand (a stroke, round ends). */
function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </svg>
  );
}
