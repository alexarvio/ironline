import { requireCoach } from "../../../lib/auth";
import { loadHome, loadMeasurements, loadMeetings, loadMessages, loadNutrition, loadPictures, loadPlan, loadRail, loadTraining, pickClient, loadInvoices } from "../loaders";
import RedesignShell from "../RedesignShell";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../nutrition/nutrition.css";
import "../measurements/measurements.css";
import "./pictures.css";
import "../meetings/meetings.css";
import "../plan/plan.css";
import "../home/home.css";
import "../messages/messages.css";
import "../invoices/invoices.css";
import "../ncdialog.css";
import "../rail.css";

// The redesign drafts, opened on Progress pictures. Read-only: nothing here saves.
// Local only, not for live.
//   /admin/redesign/pictures?client=ID
export const dynamic = "force-dynamic";

export default async function PicturesRedesignPage({ searchParams }: { searchParams: Promise<{ client?: string; week?: string; program?: string; phase?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const { client, firstName } = pickClient(coach.id, params.client);
  if (!client) return <p style={{ padding: 32 }}>No clients yet.</p>;
  return (
    <RedesignShell
      clientId={client.id}
      clientName={client.name ?? "Client"}
      firstName={firstName}
      rail={loadRail(coach)}
      initialTab="pictures"
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
