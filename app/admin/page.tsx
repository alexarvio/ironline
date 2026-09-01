import AdminShell from "./AdminShell";
import AdminSidebar from "./AdminSidebar";
import ClientHeader from "./ClientHeader";
import SectionTabs, { TabSection } from "./SectionTabs";
import NutritionPanel from "./NutritionPanel";
import MeasurementsPanel from "./MeasurementsPanel";
import ClientOverviewPanel from "./ClientOverviewPanel";
import ProgramBuilder from "../components/ProgramBuilder";
import { getClient, getClientProfile, getOverviewPanel, listClients } from "../lib/queries";

// Age in whole years, or null when no birthdate is on file — the header
// simply omits it rather than showing a placeholder beside the name.
function ageFrom(birthdate: string | null): number | null {
  if (!birthdate) return null;
  const born = new Date(`${birthdate}T00:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - born.getFullYear();
  const before = now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate());
  if (before) age--;
  return age >= 0 && age < 130 ? age : null;
}
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
    <AdminShell
      sidebar={<AdminSidebar selectedId={selectedId} />}
      panel={client ? <ClientOverviewPanel panel={getOverviewPanel(client.id)} clientId={client.id} /> : undefined}
    >
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
  // Three tabs, per the workstation design. Start Page became the right-hand
  // panel, and Daily/Weekly Tracker collapsed into Measurements — a metric's
  // rhythm is a property of the metric, not a reason for its own screen.
  const profile = getClientProfile(clientId);
  const overview = getOverviewPanel(clientId);

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
      <ClientHeader name={name} age={ageFrom(profile.birthdate)} since={overview.clientSince} />
      <SectionTabs sections={sections} initialId={initialTab} />
    </>
  );
}
