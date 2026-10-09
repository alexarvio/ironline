"use client";

import { memo, useCallback, useEffect, useState, useRef } from "react";
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
import InvoicesDraft from "./invoices/InvoicesDraft";
import RedesignRail from "./RedesignRail";
import type { DraftInvoices, RailData } from "./loaders";

// The redesign drafts on one page: the rail on the left, and Training,
// Nutrition and Measurements all loaded on the right, one shown at a time.
// A switch is instant and keeps what was typed on the other tab; the
// address follows, so a refresh or a link lands on the tab it names.

const TABS = [
  { key: "home", label: "Home" },
  { key: "plan", label: "Plan" },
  { key: "training", label: "Training" },
  { key: "nutrition", label: "Nutrition" },
  { key: "measurements", label: "Measurements" },
  { key: "pictures", label: "Progress pictures" },
  { key: "meetings", label: "Meetings" },
  { key: "invoices", label: "Invoices" },
] as const;
// Messages stopped being a tab (2 Oct): the chat is the panel from the right,
// over any tab. Its address (/admin/redesign/messages) still opens it, on Home.
type PageTab = (typeof TABS)[number]["key"];
export type RedesignTab = PageTab | "messages";
/** The tab a page should open on: ?tab= when it names one, else the page's own. */
export function tabFromParams(tab: string | undefined, fallback: RedesignTab): RedesignTab {
  return tab === "messages" || TABS.some((t) => t.key === tab) ? (tab as RedesignTab) : fallback;
}
type ChatState = { mounted: boolean; open: boolean; about: DraftLink | null; opened: number; focus: number | null };

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
  training: { draft: DraftProgram | null; library: Library; cardioMoves?: CardioMove[] };
  nutrition: DraftNutrition;
  measurements: DraftMeasurements;
  pictures: DraftPictures;
  meetings: DraftMeetings;
  plan: DraftPlan;
  messages: DraftMessages;
  invoices: DraftInvoices;
};

export default function RedesignShell({ clientId, clientName, firstName, rail, initialTab, home, training, nutrition, measurements, pictures, meetings, plan, messages, invoices }: RedesignShellProps) {
  const pageTab = (t: RedesignTab): PageTab => (t === "messages" ? "home" : t);
  const [tab, setTab] = useState<PageTab>(pageTab(initialTab));
  // The chat sliding in from the right (ChatPanel.tsx): mounted on first
  // use, then kept, so it slides both ways; `opened` counts the openings,
  // so each one sets what the reply is about (and the message to land on).
  const [chat, setChat] = useState<ChatState>({ mounted: false, open: false, about: null, opened: 0, focus: null });
  const closeChat = () => setChat((c) => ({ ...c, open: false }));
  // The same function for the life of the page (2 Oct): it reaches every tab
  // through OpenChatContext, and a new one each render redrew them all.
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = chat.mounted;
  }, [chat.mounted]);
  const openChat = useCallback((about?: Parameters<OpenChat>[0], focus: number | null = null) => {
    const next = (c: ChatState) => ({ mounted: true, open: true, about: about ? { ...about, gone: false } : null, opened: c.opened + 1, focus });
    if (mountedRef.current) setChat(next);
    else {
      // In closed first, then open a frame later, so even the first one slides.
      mountedRef.current = true;
      setChat((c) => ({ ...c, mounted: true }));
      requestAnimationFrame(() => requestAnimationFrame(() => setChat(next)));
    }
  }, []);
  // The chat tab's dot: the chat reads its own thread now, not the page, so
  // opening it clears the dot here, until a newer message from the client.
  const newestFromClient = messages.messages.find((m) => !m.mine)?.id ?? null;
  const [seenNewest, setSeenNewest] = useState<number | null>(null);
  if (chat.open && seenNewest !== newestFromClient) setSeenNewest(newestFromClient);
  const chatDot = !!messages.unread && seenNewest !== newestFromClient;
  const panelRef = useRef<HTMLElement>(null);
  // Open, it stays open (9 Oct): across tabs, through clicks on the page.
  // Only Escape and its own X close it. The page makes room beside it (the
  // rd-frame attribute below), so nothing sits behind it.
  useEffect(() => {
    if (!chat.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[role=dialog]") && closeChat();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chat.open]);
  // Another client: land where the address says (Home from the rail), never on the last client's tab.
  const [seenClient, setSeenClient] = useState(clientId);
  if (seenClient !== clientId) {
    setSeenClient(clientId);
    setTab(pageTab(initialTab));
    setChat({ mounted: false, open: false, about: null, opened: 0, focus: null });
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
      window.history.replaceState(null, "", `${window.location.pathname}?client=${clientId}&tab=${t}`);
    },
    [clientId, openChat]
  );
  const openTab = useCallback((t: string) => show(t as RedesignTab), [show]);
  // A track with no phase and nothing set up yet opens on one button,
  // "Create a … phase" (NoPhase). Anything already there (targets, logs,
  // metrics) keeps the usual screen, phase or not.
  const hasPhase = (track: string) => plan.phases.some((p) => p.track === track);
  const noMacros = (m: { protein: number | null; carbs: number | null; fats: number | null }) => m.protein == null && m.carbs == null && m.fats == null;
  const nutritionBlank = !hasPhase("nutrition") && noMacros(nutrition.training) && noMacros(nutrition.rest) && nutrition.waterL == null && !nutrition.note.trim() && nutrition.supplements.length === 0 && nutrition.logged.days.length === 0;
  const measurementsBlank = !hasPhase("lifestyle") && measurements.metrics.length === 0 && measurements.daily.periods.length === 0 && measurements.weekly.periods.length === 0 && measurements.notes.length === 0;
  return (
    <OpenChatContext.Provider value={openChat}>
    <div className="rd-frame" data-chat={chat.open ? "open" : undefined}>
      <RedesignRail rail={rail} clientId={clientId} />
      <div className="rd-page">
        <nav className="rd-nav" aria-label="Redesign drafts">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={t.key === tab ? "on" : ""} aria-current={t.key === tab ? "page" : undefined} onClick={() => show(t.key)}>
              {t.label}
            </button>
          ))}
        </nav>
        <div hidden={tab !== "home"}>
          <HomeTab clientId={clientId} firstName={firstName} home={home} onOpenTab={openTab} />
        </div>
        <div hidden={tab !== "training"}>
          {training.draft ? (
            <TrainingTab key={training.draft.id} clientId={clientId} firstName={firstName} program={training.draft} library={training.library} cardioMoves={training.cardioMoves} />
          ) : hasPhase("training") ? (
            <NoProgramme clientId={clientId} firstName={firstName} />
          ) : (
            <NoPhase clientId={clientId} firstName={firstName} track="training" plan={plan} />
          )}
        </div>
        <div hidden={tab !== "nutrition"}>
          {nutritionBlank ? <NoPhase clientId={clientId} firstName={firstName} track="nutrition" plan={plan} /> : <NutritionTab key={nutrition.id} clientId={clientId} firstName={firstName} plan={nutrition} />}
        </div>
        <div hidden={tab !== "measurements"}>
          {measurementsBlank ? <NoPhase clientId={clientId} firstName={firstName} track="lifestyle" plan={plan} /> : <MeasurementsTab key={measurements.id} clientId={clientId} firstName={firstName} plan={measurements} />}
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
      <button type="button" className={`rd-chattab${chat.open ? " hidden" : ""}`} onClick={() => openChat()} aria-label={`Chat with ${firstName}${chatDot ? ", new message" : ""}`} title={`Chat with ${firstName}`} tabIndex={chat.open ? -1 : 0}>
        <ChatIcon />
        {chatDot && <i className="rd-chattab-dot" aria-hidden="true" />}
      </button>
      {chat.mounted && (
        <aside ref={panelRef} className={`rd-chatpanel${chat.open ? " open" : ""}`} aria-label={`Chat with ${firstName}`} aria-hidden={!chat.open} inert={chat.open ? undefined : true}>
          <MessagesDraft clientId={clientId} firstName={firstName} plan={messages} active={chat.open} panel={{ about: chat.about, opened: chat.opened, onClose: closeChat, focus: chat.focus }} />
        </aside>
      )}
      <Toaster />
    </div>
    </OpenChatContext.Provider>
  );
}
