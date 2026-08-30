import CalendarPanel from "./CalendarPanel";
import AdminShell from "./AdminShell";
import AdminSidebar, { AdminView } from "./AdminSidebar";
import ClientHeader from "./ClientHeader";
import ClientRail from "./ClientRail";
import FeedPanel from "./FeedPanel";
import SectionTabs, { TabSection } from "./SectionTabs";
import InvoicesPanel from "./InvoicesPanel";
import MeasurementsPanel from "./MeasurementsPanel";
import MeetingsPanel from "./MeetingsPanel";
import NutritionPanel from "./NutritionPanel";
import ProgressPicturesPanel from "./ProgressPicturesPanel";
import ReportsPanel from "./ReportsPanel";
import ReportTemplatesPanel from "./ReportTemplatesPanel";
import StartPagePanel from "./StartPagePanel";
import TrackerPanel from "./TrackerPanel";
import ProgramBuilder from "../components/ProgramBuilder";
import ChatPanel from "../components/ChatPanel";
import { getClient, getClientHeaderPlans, listChatMessages, listClients } from "../lib/queries";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; view?: string; tab?: string; month?: string }>;
}) {
  const params = await searchParams;
  const clients = listClients();
  const showFeed = params.view === "feed";
  const showCalendar = params.view === "calendar";
  const showReportTemplates = params.view === "report-templates";
  const isClientView = !showFeed && !showCalendar && !showReportTemplates;
  const selectedId = params.client ? Number(params.client) : isClientView ? clients[0]?.id ?? null : null;
  const client = selectedId ? getClient(selectedId) : undefined;

  const activeView: AdminView = showFeed
    ? "feed"
    : showCalendar
    ? "calendar"
    : showReportTemplates
    ? "report-templates"
    : "client";

  return (
    <AdminShell
      sidebar={<AdminSidebar selectedId={selectedId} activeView={activeView} />}
      rail={client ? <ClientRail clientId={client.id} clientName={client.name} /> : undefined}
    >
      {showFeed ? (
        <div className="ad-pad">
          <FeedPanel />
        </div>
      ) : showCalendar ? (
        <div className="ad-pad">
          <CalendarPanel month={params.month} />
        </div>
      ) : showReportTemplates ? (
        <div className="ad-pad">
          <ReportTemplatesPanel />
        </div>
      ) : !client ? (
        <div className="ad-pad">
          <p className="ad-empty">
            {clients.length === 0
              ? "No clients yet — add one from the sidebar to get started."
              : "Select a client from the sidebar."}
          </p>
        </div>
      ) : (
        <ClientDashboard clientId={client.id} name={client.name} initialTab={params.tab} />
      )}
    </AdminShell>
  );
}

function ClientDashboard({
  clientId,
  name,
  initialTab,
}: {
  clientId: number;
  name: string;
  initialTab?: string;
}) {
  const sections: TabSection[] = [
    { id: "start", label: "Start Page", content: <StartPagePanel clientId={clientId} name={name} /> },
    {
      id: "training",
      label: "Training",
      content: (
        <ProgramBuilder
          clientId={clientId}
          clientName={name}
          weekLinkBase={`/admin?client=${clientId}&tab=training`}
        />
      ),
    },
    { id: "nutrition", label: "Nutrition", content: <NutritionPanel clientId={clientId} /> },
    { id: "measurements", label: "Measurements", content: <MeasurementsPanel clientId={clientId} /> },
    { id: "photos", label: "Progress Pictures", content: <ProgressPicturesPanel clientId={clientId} /> },
    { id: "daily", label: "Daily Tracker", content: <TrackerPanel clientId={clientId} frequency="daily" /> },
    { id: "weekly", label: "Weekly Tracker", content: <TrackerPanel clientId={clientId} frequency="weekly" /> },
    { id: "meetings", label: "Meetings", content: <MeetingsPanel clientId={clientId} /> },
    {
      id: "chat",
      label: "Chat",
      content: <ChatPanel clientId={clientId} viewer="coach" messages={listChatMessages(clientId)} />,
    },
    { id: "invoices", label: "Invoices", content: <InvoicesPanel clientId={clientId} /> },
    { id: "reports", label: "Reports", content: <ReportsPanel clientId={clientId} /> },
  ];

  return (
    <>
      <ClientHeader
        name={name}
        plans={getClientHeaderPlans(clientId)}
        messageHref={`/admin?client=${clientId}&tab=chat`}
      />
      <SectionTabs sections={sections} initialId={initialTab} />
    </>
  );
}
