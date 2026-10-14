import { requireCoach } from "../../../lib/auth";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import "../messages/messages.css";
import PhasesOverview from "./PhasesOverview";
import { loadPhasesOverview } from "./load";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../plan/plan.css";
import "../ncdialog.css";
import "../rail.css";
import "./phases.css";

// Every client's phases and events on one timeline (redrawn 14 Oct): ending
// soon as a list to act on, the clients' lanes below, the rail on the left.
//   /admin/redesign/phases
export const dynamic = "force-dynamic";

export default async function PhasesPage() {
  const coach = await requireCoach();
  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <ChatDock chats={loadChatDock(coach)} />
      <div className="rd-page">
        <PhasesOverview data={loadPhasesOverview(coach.id)} />
      </div>
    </div>
  );
}
