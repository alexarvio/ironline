import Link from "next/link";
import CalendarPanel from "./CalendarPanel";
import ClientSidebar from "./ClientSidebar";
import FeedPanel from "./FeedPanel";
import MetricGraph from "./MetricGraph";
import SectionTabs, { TabSection } from "./SectionTabs";
import InvoicesPanel from "./InvoicesPanel";
import MeasurementsPanel from "./MeasurementsPanel";
import MeetingsPanel from "./MeetingsPanel";
import NotBuiltPanel from "./NotBuiltPanel";
import NutritionPanel from "./NutritionPanel";
import ProgressPicturesPanel from "./ProgressPicturesPanel";
import StartPagePanel from "./StartPagePanel";
import TrackerPanel from "./TrackerPanel";
import ProgramBuilder from "../components/ProgramBuilder";
import ChatPanel from "../components/ChatPanel";
import { getClient, getClientSummary, getStrengthSeries, getWeightSeries, listChatMessages, listClients } from "../lib/queries";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; view?: string; tab?: string; month?: string; week?: string }>;
}) {
  const params = await searchParams;
  const clients = listClients();
  const showFeed = params.view === "feed";
  const showCalendar = params.view === "calendar";
  const selectedId = params.client
    ? Number(params.client)
    : !showFeed && !showCalendar
    ? clients[0]?.id ?? null
    : null;
  const client = selectedId ? getClient(selectedId) : undefined;
  const week = params.week ? Number(params.week) : undefined;

  return (
    <div className="admin-shell">
      <div className="top-nav" style={{ maxWidth: "none", padding: "0 24px" }}>
        <Link className="brand" href="/">
          Ironline
        </Link>
        <div className="nav-links">
          <Link href="/coach">Coach</Link>
          <Link href="/client">Client</Link>
          <Link className="active" href="/admin">
            Admin panel
          </Link>
        </div>
      </div>

      <div className="admin-body">
        <ClientSidebar
          selectedId={selectedId}
          activeView={showFeed ? "feed" : showCalendar ? "calendar" : "client"}
        />

        <main className="admin-main">
          {showFeed ? (
            <FeedPanel />
          ) : showCalendar ? (
            <CalendarPanel month={params.month} />
          ) : !client ? (
            <p className="empty-note">
              {clients.length === 0
                ? "No clients yet — add one from the sidebar to get started."
                : "Select a client from the sidebar."}
            </p>
          ) : (
            <ClientDashboard clientId={client.id} name={client.name} initialTab={params.tab} week={week} />
          )}
        </main>
      </div>
    </div>
  );
}

function ClientDashboard({
  clientId,
  name,
  initialTab,
  week,
}: {
  clientId: number;
  name: string;
  initialTab?: string;
  week?: number;
}) {
  const summary = getClientSummary(clientId);
  const strengthSeries = getStrengthSeries(clientId, 3650);
  const weightSeries = getWeightSeries(clientId, 3650);

  const sections: TabSection[] = [
    {
      id: "start",
      label: "Start Page",
      content: <StartPagePanel clientId={clientId} name={name} />,
    },
    {
      id: "training",
      label: "Training",
      content: (
        <ProgramBuilder clientId={clientId} week={week} weekLinkBase={`/admin?client=${clientId}&tab=training`} />
      ),
    },
    { id: "nutrition", label: "Nutrition", content: <NutritionPanel clientId={clientId} /> },
    {
      id: "measurements",
      label: "Measurements",
      content: <MeasurementsPanel clientId={clientId} />,
    },
    {
      id: "photos",
      label: "Progress Pictures",
      content: <ProgressPicturesPanel clientId={clientId} />,
    },
    {
      id: "daily",
      label: "Daily Tracker",
      content: <TrackerPanel clientId={clientId} frequency="daily" />,
    },
    {
      id: "weekly",
      label: "Weekly Tracker",
      content: <TrackerPanel clientId={clientId} frequency="weekly" />,
    },
    {
      id: "meetings",
      label: "Meetings",
      content: <MeetingsPanel clientId={clientId} />,
    },
    {
      id: "chat",
      label: "Chat",
      content: <ChatPanel clientId={clientId} viewer="coach" messages={listChatMessages(clientId)} />,
    },
    {
      id: "invoices",
      label: "Invoices",
      content: <InvoicesPanel clientId={clientId} />,
    },
  ];

  return (
    <div>
      <header className="client-header">
        <div className="client-header-main">
          <h1>{name}</h1>
          <div className="client-stat-row">
            <div className="client-stat">
              <span className="stat-label">Training</span>
              <span className="stat-value">
                {summary.programPublished
                  ? `Published · ${summary.trainingDaysBuilt} day${
                      summary.trainingDaysBuilt === 1 ? "" : "s"
                    } built`
                  : summary.trainingDaysBuilt > 0
                  ? `Draft · ${summary.trainingDaysBuilt} day${
                      summary.trainingDaysBuilt === 1 ? "" : "s"
                    } built`
                  : "Not started"}
              </span>
            </div>
            <div className="client-stat">
              <span className="stat-label">Workout</span>
              <span className="stat-value">{summary.totalSetsLogged} sets logged</span>
            </div>
            <div className="client-stat">
              <span className="stat-label">Nutrition</span>
              <span className="stat-value">Not tracked yet</span>
            </div>
            <div className="client-stat">
              <span className="stat-label">Last active</span>
              <span className="stat-value">{summary.lastActive ?? "No activity yet"}</span>
            </div>
          </div>
        </div>
        <div className="client-avatar-large" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </div>
      </header>

      <MetricGraph strengthSeries={strengthSeries} weightSeries={weightSeries} />

      <SectionTabs sections={sections} initialId={initialTab} />
    </div>
  );
}
