import { requireCoach } from "../../../lib/auth";
import { touchPresence } from "../../../lib/presence";
import { startTiming } from "../../../lib/timing";
import { loadHome, loadMeasurements, loadMeetings, loadMessages, loadNutrition, loadPictures, loadPlan, loadRail, loadTraining, pickClient, loadInvoices, loadDots } from "../loaders";
import RedesignShell from "../RedesignShell";
import { tabFromParams } from "../tabs";
import NoClients from "../NoClients";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../nutrition/nutrition.css";
import "../measurements/measurements.css";
import "../pictures/pictures.css";
import "./meetings.css";
import "../plan/plan.css";
import "../home/home.css";
import "../messages/messages.css";
import "../invoices/invoices.css";
import "../ncdialog.css";
import "../rail.css";

// The redesign drafts, opened on Meetings. Read-only: nothing here saves.
// Local only, not for live.
//   /admin/redesign/meetings?client=ID
export const dynamic = "force-dynamic";

export default async function MeetingsRedesignPage({ searchParams }: { searchParams: Promise<{ client?: string; week?: string; program?: string; phase?: string; tab?: string }> }) {
  // Each loader timed (app/lib/timing.ts, /api/timing): measuring only, the props are what they were.
  const t = startTiming("meetings");
  const coach = await t.time("auth", () => requireCoach());
  const params = await searchParams;
  const { client, firstName } = t.time("pickClient", () => pickClient(coach.id, params.client));
  t.client(client?.id);
  t.time("presence", () => touchPresence(coach, client ? `${firstName} · Meetings` : "Clients"));
  if (!client) return t.end(<NoClients rail={t.time("rail", () => loadRail(coach))} />);
  return t.end(
    <RedesignShell
      clientId={client.id}
      clientName={client.name ?? "Client"}
      firstName={firstName}
      rail={t.time("rail", () => loadRail(coach))}
      dots={t.time("dots", () => loadDots(client.id))}
      initialTab={tabFromParams(params.tab, "meetings")}
      home={t.time("home", () => loadHome(client.id))}
      training={t.time("training", () => loadTraining(coach.id, client.id, params))}
      nutrition={t.time("nutrition", () => loadNutrition(client.id, params))}
      measurements={t.time("measurements", () => loadMeasurements(client.id, params))}
      pictures={t.time("pictures", () => loadPictures(client.id))}
      meetings={t.time("meetings", () => loadMeetings(client.id))}
      plan={t.time("plan", () => loadPlan(client.id))}
      messages={t.time("messages", () => loadMessages(client.id))}
      invoices={t.time("invoices", () => loadInvoices(coach.id, client.id))}
    />
  );
}
