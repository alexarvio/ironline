import { requireCoach } from "../../../lib/auth";
import { startTiming } from "../../../lib/timing";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import "../messages/messages.css";
import PhasesOverview from "./PhasesOverview";
import { loadPhasesOverview } from "./load";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../nutrition/nutrition.css";
import "../measurements/measurements.css";
import "../plan/plan.css";
import "../ncdialog.css";
import "../rail.css";
import "./phases.css";

// Every client's phases and events on one timeline (redrawn 14 Oct; the
// Plan's timeline since 21 Oct): ending soon as a list to act on, the
// clients' lanes below, the rail on the left.
//   /admin/redesign/phases
export const dynamic = "force-dynamic";

export default async function PhasesPage() {
  // Each loader timed (app/lib/timing.ts, /api/timing): measuring only, the props are what they were.
  const t = startTiming("phases");
  const coach = await t.time("auth", () => requireCoach());
  return t.end(
    <div className="rd-frame">
      <RedesignRail rail={t.time("rail", () => loadRail(coach))} clientId={0} />
      <ChatDock chats={t.time("chatDock", () => loadChatDock(coach))} />
      <div className="rd-page">
        <PhasesOverview data={t.time("phasesOverview", () => loadPhasesOverview(coach.id))} />
      </div>
    </div>
  );
}
