import AdminShell from "./AdminShell";
import AdminSidebar from "./AdminSidebar";
import ClientHeader from "./ClientHeader";
import SectionTabs, { TabSection } from "./SectionTabs";
import NutritionPanel from "./NutritionPanel";
import StartPagePanel from "./StartPagePanel";
import TrackerPanel from "./TrackerPanel";
import ProgramBuilder from "../components/ProgramBuilder";
import { getClient, getClientHeaderPlans, listClients } from "../lib/queries";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; tab?: string }>;
}) {
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
  // The core loop, nothing else: say who this client is, build their
  // training, set their nutrition, and define what they log daily and
  // weekly.
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
