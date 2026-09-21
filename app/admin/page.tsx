import AdminShell from "./AdminShell";
import AdminSidebar from "./AdminSidebar";
import SectionTabs, { TabSection } from "./SectionTabs";
import { MessageAboutProvider } from "./MessageAbout";
import NutritionPanel from "./NutritionPanel";
import MeetingsPanel from "./MeetingsPanel";
import MessagesPanel from "./MessagesPanel";
import ProgressPicturesPanel from "./ProgressPicturesPanel";
import MeasurementsPanel from "./MeasurementsPanel";
import ClientOverviewPanel from "./ClientOverviewPanel";
import FeedPanel from "./FeedPanel";
import CalendarPanel from "./CalendarPanel";
import CalendarDayPanel from "./CalendarDayPanel";
import ProgramBuilder from "../components/ProgramBuilder";
import PhaseTimeline from "./PhaseTimeline";
import ClientHomePanel from "./ClientHomePanel";
import PhasesOverviewPanel from "./PhasesOverviewPanel";
import BusinessPanel from "./BusinessPanel";
import StyleGuidePanel from "./StyleGuidePanel";
import { getClient, getClientEngagement, getClientHome, getOverviewPanel, listClients, type OverviewPanel } from "../lib/queries";
import { coachOwnsClient } from "../lib/tenancy";
import CoachesPanel from "./CoachesPanel";

import { isOwner, requireCoach } from "../lib/auth";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

// The right-hand client panel, while the workstation is being redesigned
// around the client's Home tab. Set back to true to bring it back; nothing
// about ClientOverviewPanel itself has changed. NOTE: the client card
// editor, app access and delete live only in that panel.
const SHOW_CLIENT_PANEL = false;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    client?: string;
    tab?: string;
    /** Opens the card straight into edit mode. Nothing sets it any more:
        the New client dialog collects the member info before the client
        exists. Kept so an old link still opens the card. */
    onboard?: string;
    loginOk?: string;
    loginError?: string;
    /** Cross-client views from the rail: "feed" or "calendar". With one of
        these set the working area shows that view instead of a client, and
        the client panel is hidden since there is no single client in play. */
    view?: string;
    /** Coaches (owner only): the outcome of the last account change. */
    coachOk?: string;
    coachError?: string;
    /** Feed: the category filter, and which page of it. */
    cat?: string;
    page?: string;
    month?: string;
    /** Calendar: the day shown in the right-hand panel (YYYY-MM-DD). */
    day?: string;
    /** Phases: how many weeks the timeline shows. */
    win?: string;
    /** Training, Nutrition and Measurements: the phase whose header band is
        open. One parameter for all three — only one tab is on screen at a
        time, and an id from another track simply falls back to the default. */
    phase?: string;
  }>;
}) {
  const coach = await requireCoach();
  const params = await searchParams;
  const clients = listClients(coach.id);
  const owner = isOwner(coach);
  // Coaches is the owner's view only; for anyone else the parameter is ignored.
  const view =
    params.view === "feed" || params.view === "calendar" || params.view === "phases" || params.view === "business" || params.view === "style" || (params.view === "coaches" && owner)
      ? params.view
      : null;
  // ?client= only opens one of this coach's own clients; anything else lands
  // on their first client, as if no client had been asked for.
  const asked = params.client ? Number(params.client) : null;
  const selectedId = view ? null : asked != null && coachOwnsClient(coach.id, asked) ? asked : clients[0]?.id ?? null;
  const client = selectedId ? getClient(selectedId) : undefined;
  // Read once: the right-hand panel and the client's Home show the same facts.
  const overview = client ? getOverviewPanel(client.id) : null;

  return (
    <AdminShell
      sidebar={<AdminSidebar coachId={coach.id} coachEmail={coach.email} selectedId={selectedId} view={view} isOwner={owner} />}
      panel={
        view === "calendar" ? (
          <CalendarDayPanel coachId={coach.id} day={params.day} month={params.month} />
        ) : view || !SHOW_CLIENT_PANEL ? undefined : client && overview ? (
          <ClientOverviewPanel
            panel={overview}
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
          <FeedPanel coachId={coach.id} coachEmail={coach.email} owner={owner} category={params.cat} page={params.page} />
        </div>
      ) : view === "phases" ? (
        <div className="ad-pad ad-stack">
          <PhasesOverviewPanel coachId={coach.id} win={params.win} />
        </div>
      ) : view === "business" ? (
        <div className="ad-pad ad-stack">
          <BusinessPanel coachId={coach.id} />
        </div>
      ) : view === "style" ? (
        <div className="ad-pad ad-stack">
          <StyleGuidePanel />
        </div>
      ) : view === "coaches" ? (
        <div className="ad-pad">
          <CoachesPanel ownerId={coach.id} ok={params.coachOk} error={params.coachError} />
        </div>
      ) : view === "calendar" ? (
        <div className="ad-pad">
          <CalendarPanel coachId={coach.id} month={params.month} day={params.day} />
        </div>
      ) : !client || !overview ? (
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
          overview={overview}
          phaseParam={params.phase}
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
  overview,
  phaseParam,
  initialTab,
  loginOk,
  loginError,
}: {
  clientId: number;
  name: string;
  overview: OverviewPanel;
  phaseParam?: string;
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
  const home = getClientHome(clientId);
  const dot = (tab: string) => home.unseenTabs.includes(tab);
  const sections: TabSection[] = [
    {
      // Home first: what needs the coach for this client, spelled out, and
      // what the client has been doing. The rail's dot says "look here"; this
      // says why. Its count is what is new since the coach last looked.
      id: "home",
      label: "Home",
      count: home.unseenCount,
      content: (
        <ClientHomePanel
          clientId={clientId}
          panel={overview}
          home={home}
          engagement={getClientEngagement(clientId)}
        />
      ),
    },
    {
      // The plan spans nutrition, training and lifestyle, so it belongs to
      // neither tab: it is the first thing the coach sees for a client.
      id: "plan",
      label: "Plan",
      content: <PhaseTimeline clientId={clientId} />,
    },
    {
      id: "training",
      label: "Training",
      dot: dot("training"),
      content: (
        <ProgramBuilder
          clientId={clientId}
          clientName={name}
          phaseParam={initialTab === "training" ? phaseParam : undefined}
          weekLinkBase={`/admin?client=${clientId}&tab=training`}
        />
      ),
    },
    // `?phase=` is only ever the tab-in-the-address's phase: each tab keeps its
    // own ids (Training: programmes; the others: phases), so another tab's id
    // would open the wrong one. Without it a tab opens on its live phase.
    { id: "nutrition", label: "Nutrition", dot: dot("nutrition"), content: <NutritionPanel clientId={clientId} phaseParam={initialTab === "nutrition" ? phaseParam : undefined} /> },
    { id: "measurements", label: "Measurements", dot: dot("measurements"), content: <MeasurementsPanel clientId={clientId} phaseParam={initialTab === "measurements" ? phaseParam : undefined} /> },
    { id: "meetings", label: "Meetings", content: <MeetingsPanel clientId={clientId} /> },
    { id: "photos", label: "Progress pictures", dot: dot("photos"), content: <ProgressPicturesPanel clientId={clientId} /> },
    // Messages is always the last tab. New sections go before it.
    { id: "messages", label: "Messages", content: <MessagesPanel clientId={clientId} /> },
  ];


  return (
    <>
      {/* No client header strip. Name, age and "client since" are all in the
          right-hand panel now; printing them twice on one screen made the
          panel read as an echo of the header rather than the place those
          facts are kept. The tabs are the top of this column. */}
      {/* Keyed by client: switching client lands on Home (or the tab asked
          for). Within a client the tabs follow ?tab= themselves, so a deep
          link such as the feed's "See the week" opens its tab, and a save
          never remounts the one on screen. */}
      {/* Any tab can message the client about what it shows (MessageAbout). */}
      <MessageAboutProvider value={{ clientId, firstName: name.split(" ")[0] || name }}>
        <SectionTabs key={clientId} clientId={clientId} sections={sections} initialId={initialTab} />
      </MessageAboutProvider>
    </>
  );
}
