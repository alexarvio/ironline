import AdminShell from "./AdminShell";
import AdminSidebar from "./AdminSidebar";
import ClientHeader from "./ClientHeader";
import SectionTabs, { TabSection } from "./SectionTabs";
import NutritionPanel from "./NutritionPanel";
import StartPagePanel from "./StartPagePanel";
import TrackerPanel from "./TrackerPanel";
import ProgramBuilder from "../components/ProgramBuilder";
import { getClient, getClientHeaderPlans, listClients } from "../lib/queries";
import { requireCoach } from "../lib/auth";
import ClientLoginPanel from "./ClientLoginPanel";

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
    loginOk?: string;
    loginError?: string;
  }>;
}) {
  await requireCoach();
  const params = await searchParams;
  const clients = listClients();
  const selectedId = params.client ? Number(params.client) : clients[0]?.id ?? null;
  const client = selectedId ? getClient(selectedId) : undefined;

  return (
    <AdminShell sidebar={<AdminSidebar selectedId={selectedId} />}>
      {!client ? (
        <div className="ad-pad">
          <p className="ad-empty">
            {clients.length === 0
              ? "No clients yet — add one from the sidebar to get started."
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
  const sections: TabSection[] = [
    {
      id: "start",
      label: "Start Page",
      content: (
        <>
          <StartPagePanel clientId={clientId} name={name} />
          <ClientLoginPanel
            clientId={clientId}
            name={name}
            ok={loginOk}
            error={loginError}
          />
        </>
      ),
    },
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
    { id: "daily", label: "Daily Tracker", content: <TrackerPanel clientId={clientId} frequency="daily" /> },
    { id: "weekly", label: "Weekly Tracker", content: <TrackerPanel clientId={clientId} frequency="weekly" /> },
  ];

  return (
    <>
      <ClientHeader name={name} plans={getClientHeaderPlans(clientId)} />
      <SectionTabs sections={sections} initialId={initialTab} />
    </>
  );
}
