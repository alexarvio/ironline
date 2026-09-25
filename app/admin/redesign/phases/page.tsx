import { requireCoach } from "../../../lib/auth";
import { loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import PhasesBoard from "./PhasesBoard";
import { loadPhasesBoard } from "./load";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../rail.css";
import "./phases.css";

// Every client's phases and events on one timeline, in the redesign, the
// rail on its left. Replaces /admin?view=phases.
//   /admin/redesign/phases
export const dynamic = "force-dynamic";

export default async function PhasesPage() {
  const coach = await requireCoach();
  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <div className="rd-page">
        <PhasesBoard data={loadPhasesBoard(coach.id)} />
      </div>
    </div>
  );
}
