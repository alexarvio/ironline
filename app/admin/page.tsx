import AdminShell from "./AdminShell";
import AdminSidebar from "./AdminSidebar";
import SectionTabs, { TabSection } from "./SectionTabs";
import NutritionPanel from "./NutritionPanel";
import MeasurementsPanel from "./MeasurementsPanel";
import ClientOverviewPanel from "./ClientOverviewPanel";
import FeedPanel from "./FeedPanel";
import CalendarPanel from "./CalendarPanel";
import CalendarDayPanel from "./CalendarDayPanel";
import BrandingPanel from "./BrandingPanel";
import ProgramBuilder from "../components/ProgramBuilder";
import { getClient, getOverviewPanel, listClients } from "../lib/queries";

import { requireCoach } from "../lib/auth";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    tab?: string;
    /** Set by createClientAction on the redirect after a client is made —
        opens their card straight into edit mode so the coach fills it in
        while they're still thinking about the new client. */
    onboard?: string;
    loginOk?: string;
    loginError?: string;
    /** Cross-client views from the rail: "feed" or "calendar". With one of
        these set the working area shows that view instead of a client, and
        the client panel is hidden since there is no single client in play. */
    view?: string;
    month?: string;
    /** Calendar: the day shown in the right-hand panel (YYYY-MM-DD). */
    day?: string;
  }>;
}) {
  await requireCoach();
  const params = await searchParams;
  const clients = listClients();
  const view =
    params.view === "feed" || params.view === "calendar" || params.view === "branding" ? params.view : null;
  const selectedId = view ? null : params.client ? Number(params.client) : clients[0]?.id ?? null;
  const client = selectedId ? getClient(selectedId) : undefined;

  return (
    <AdminShell
      sidebar={<AdminSidebar selectedId={selectedId} />}
      panel={
        view === "calendar" ? (
          <CalendarDayPanel day={params.day} month={params.month} />
        ) : view ? undefined : client ? (
          <ClientOverviewPanel
            panel={getOverviewPanel(client.id)}
            clientId={client.id}
            onboarding={params.onboard === "1"}
            loginOk={params.loginOk}
            loginError={params.loginError}
          />
        ) : undefined
      }
    >
      {view === "feed" ? (
        <div className="ad-pad">
          <FeedPanel />
        </div>
      ) : view === "calendar" ? (
        <div className="ad-pad">
          <CalendarPanel month={params.month} day={params.day} />
        </div>
      ) : view === "branding" ? (
        <div className="ad-pad">
          <BrandingPanel />
        </div>
      ) : !client ? (
        <div className="ad-pad">
          <p className="ad-empty">
            {clients.length === 0
              ? "No clients yet. Add one from the sidebar to get started."
              : "Select a client from the sidebar."}
          </p>
        </div>
      ) : (
        <ClientDashboard
          clientId={client.id}
          name={client.name}
          initialTab={params.tab}
          loginOk={params.loginOk}
          loginError={params.loginError}
        />
      )}
    </AdminShell>
  );
}

function ClientDashboard({
  clientId,
  name,
  initialTab,
  loginOk,
  loginError,
}: {
  clientId: number;
  name: string;
  initialTab?: string;
  loginOk?: string;
  loginError?: string;
}) {
  // The core loop, nothing else: say who this client is, build their
  // training, set their nutrition, and define what they log daily and
  // weekly.
  // Three tabs, per the workstation design. Start Page became the right-hand
  // panel, and Daily/Weekly Tracker collapsed into Measurements — a metric's
  // rhythm is a property of the metric, not a reason for its own screen.
  const sections: TabSection[] = [
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
  ];


  return (
    <>
      {/* No client header strip. Name, age and "client since" are all in the
          right-hand panel now; printing them twice on one screen made the
          panel read as an echo of the header rather than the place those
          facts are kept. The tabs are the top of this column. */}
      <SectionTabs sections={sections} initialId={initialTab} />
    </>
  );
}
