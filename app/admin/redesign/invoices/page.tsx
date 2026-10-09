import { requireCoach } from "../../../lib/auth";
import { loadHome, loadMeasurements, loadMeetings, loadMessages, loadNutrition, loadPictures, loadPlan, loadRail, loadTraining, pickClient, loadInvoices } from "../loaders";
import RedesignShell, { tabFromParams } from "../RedesignShell";
import NoClients from "../NoClients";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../nutrition/nutrition.css";
import "../measurements/measurements.css";
import "../pictures/pictures.css";
import "../meetings/meetings.css";
import "../plan/plan.css";
import "../home/home.css";
import "../messages/messages.css";
import "./invoices.css";
import "../ncdialog.css";
import "../rail.css";

// The client's tabs, opened on Invoices.
//   /admin/redesign/invoices?client=ID
export const dynamic = "force-dynamic";

export default async function InvoicesRedesignPage({ searchParams }: { searchParams: Promise<{ client?: string; week?: string; program?: string; phase?: string; tab?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const { client, firstName } = pickClient(coach.id, params.client);
  if (!client) return <NoClients rail={loadRail(coach)} />;
  return (
    <RedesignShell
      clientId={client.id}
      clientName={client.name ?? "Client"}
      firstName={firstName}
      rail={loadRail(coach)}
      initialTab={tabFromParams(params.tab, "invoices")}
      home={loadHome(client.id)}
      training={loadTraining(coach.id, client.id, params)}
      nutrition={loadNutrition(client.id, params)}
      measurements={loadMeasurements(client.id, params)}
      pictures={loadPictures(client.id)}
      meetings={loadMeetings(client.id)}
      plan={loadPlan(client.id)}
      messages={loadMessages(client.id)}
      invoices={loadInvoices(coach.id, client.id)}
    />
  );
}
