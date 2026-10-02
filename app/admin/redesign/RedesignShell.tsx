"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ChatIcon } from "../../components/icons";
import { OpenChatContext, type OpenChat } from "./ChatPanel";
import { Toaster } from "../../components/ui/toast";
import TrainingDraft, { type DraftProgram, type Library } from "./training/TrainingDraft";
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

export type RedesignShellProps = {
  clientId: number;
  clientName: string;
  firstName: string;
  rail: RailData;
  initialTab: RedesignTab;
  home: DraftHome;
  training: { draft: DraftProgram | null; library: Library };
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
  const [chat, setChat] = useState<{ mounted: boolean; open: boolean; about: DraftLink | null; opened: number; focus: number | null }>({ mounted: false, open: false, about: null, opened: 0, focus: null });
  const closeChat = () => setChat((c) => ({ ...c, open: false }));
  const openChat = (about?: Parameters<OpenChat>[0], focus: number | null = null) => {
    const next = (c: typeof chat) => ({ mounted: true, open: true, about: about ? { ...about, gone: false } : null, opened: c.opened + 1, focus });
    if (chat.mounted) setChat(next);
    else {
      // In closed first, then open a frame later, so even the first one slides.
      setChat((c) => ({ ...c, mounted: true }));
      requestAnimationFrame(() => requestAnimationFrame(() => setChat(next)));
    }
  };
  const panelRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!chat.open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !document.querySelector("[role=dialog]") && closeChat();
    // A click anywhere outside it slides it away too, except in what the chat
    // itself opened over the page (its menus, the link picker, a toast).
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t || panelRef.current?.contains(t)) return;
      if (t.closest("[data-radix-popper-content-wrapper], [role=dialog], [role=menu], [data-sonner-toaster]")) return;
      closeChat();
      // That click only closes the chat (2 Oct): it used to go on to what was
      // under it too, folding a session or switching tab in the same breath.
      const swallow = (c: MouseEvent) => {
        c.preventDefault();
        c.stopPropagation();
      };
      document.addEventListener("click", swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener("click", swallow, { capture: true }), 600);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
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
  const show = (asked: RedesignTab) => {
    // "Messages" (Home's events) is the chat, over the tab that is open.
    if (asked === "messages") {
      openChat();
      return;
    }
    const t = asked;
    scrolls.current[tab] = window.scrollY;
    setTab(t);
    requestAnimationFrame(() => window.scrollTo(0, scrolls.current[t] ?? 0));
    // Keep the other tab's query (week, programme, phase) out of this one's address.
    window.history.replaceState(null, "", `/admin/redesign/${t}?client=${clientId}`);
  };
  // A track with no phase and nothing set up yet opens on one button,
  // "Create a … phase" (NoPhase). Anything already there (targets, logs,
  // metrics) keeps the usual screen, phase or not.
  const hasPhase = (track: string) => plan.phases.some((p) => p.track === track);
  const noMacros = (m: { protein: number | null; carbs: number | null; fats: number | null }) => m.protein == null && m.carbs == null && m.fats == null;
  const nutritionBlank = !hasPhase("nutrition") && noMacros(nutrition.training) && noMacros(nutrition.rest) && nutrition.waterL == null && !nutrition.note.trim() && nutrition.supplements.length === 0 && nutrition.logged.days.length === 0;
  const measurementsBlank = !hasPhase("lifestyle") && measurements.metrics.length === 0 && measurements.daily.periods.length === 0 && measurements.weekly.periods.length === 0 && measurements.notes.length === 0;
  return (
    <OpenChatContext.Provider value={openChat}>
    <div className="rd-frame">
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
          <HomeDraft clientId={clientId} firstName={firstName} home={home} onOpenTab={(t) => show(t as RedesignTab)} />
        </div>
        <div hidden={tab !== "training"}>
          {training.draft ? (
            <TrainingDraft key={training.draft.id} clientId={clientId} firstName={firstName} program={training.draft} library={training.library} />
          ) : hasPhase("training") ? (
            <NoProgramme clientId={clientId} firstName={firstName} />
          ) : (
            <NoPhase clientId={clientId} firstName={firstName} track="training" plan={plan} />
          )}
        </div>
        <div hidden={tab !== "nutrition"}>
          {nutritionBlank ? <NoPhase clientId={clientId} firstName={firstName} track="nutrition" plan={plan} /> : <NutritionDraft key={nutrition.id} clientId={clientId} firstName={firstName} plan={nutrition} />}
        </div>
        <div hidden={tab !== "measurements"}>
          {measurementsBlank ? <NoPhase clientId={clientId} firstName={firstName} track="lifestyle" plan={plan} /> : <MeasurementsDraft key={measurements.id} clientId={clientId} firstName={firstName} plan={measurements} />}
        </div>
        <div hidden={tab !== "pictures"}>
          <PicturesDraft clientId={clientId} firstName={firstName} plan={pictures} />
        </div>
        <div hidden={tab !== "meetings"}>
          <MeetingsDraft clientId={clientId} firstName={firstName} plan={meetings} />
        </div>
        <div hidden={tab !== "plan"}>
          <PlanDraft clientId={clientId} firstName={firstName} plan={plan} />
        </div>
        <div hidden={tab !== "invoices"}>
          <InvoicesDraft clientId={clientId} firstName={firstName} clientName={clientName} plan={invoices} />
        </div>
      </div>
      {/* The chat's tab on the window's right edge, on every screen of a
          client: it slides the chat out. A dot while there is something from
          them not opened yet. */}
      <button type="button" className={`rd-chattab${chat.open ? " hidden" : ""}`} onClick={() => openChat()} aria-label={`Chat with ${firstName}${messages.unread ? ", new message" : ""}`} title={`Chat with ${firstName}`} tabIndex={chat.open ? -1 : 0}>
        <ChatIcon />
        {messages.unread && <i className="rd-chattab-dot" aria-hidden="true" />}
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
