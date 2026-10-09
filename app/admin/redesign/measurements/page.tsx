import { requireCoach } from "../../../lib/auth";
import { touchPresence } from "../../../lib/presence";
import { loadHome, loadMeasurements, loadMeetings, loadMessages, loadNutrition, loadPictures, loadPlan, loadRail, loadTraining, pickClient, loadInvoices } from "../loaders";
import RedesignShell from "../RedesignShell";
import { tabFromParams } from "../tabs";
import NoClients from "../NoClients";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../nutrition/nutrition.css";
import "./measurements.css";
import "../pictures/pictures.css";
import "../meetings/meetings.css";
import "../plan/plan.css";
import "../home/home.css";
import "../messages/messages.css";
import "../invoices/invoices.css";
import "../ncdialog.css";
import "../rail.css";

// The redesign drafts, opened on Measurements. Read-only: nothing here saves.
// Local only, not for live.
//   /admin/redesign/measurements?client=ID&phase=ID
export const dynamic = "force-dynamic";

export default async function MeasurementsRedesignPage({ searchParams }: { searchParams: Promise<{ client?: string; week?: string; program?: string; phase?: string; tab?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const { client, firstName } = pickClient(coach.id, params.client);
  touchPresence(coach, client ? `${firstName} · Measurements` : "Clients");
  if (!client) return <NoClients rail={loadRail(coach)} />;
  return (
    <RedesignShell
      clientId={client.id}
      clientName={client.name ?? "Client"}
      firstName={firstName}
      rail={loadRail(coach)}
      initialTab={tabFromParams(params.tab, "measurements")}
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
