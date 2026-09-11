import { getPlanData } from "../lib/queries";
import PlanPhasesCard from "./PlanPhasesCard";
import PlanGoalsCard from "./PlanGoalsCard";

// The Plan tab: two cards. The phases grid answers what block the client
// is in, until when, and what comes after; the goals table is what those
// blocks are steering toward. Server component: it gathers the data and
// hands it to the two interactive cards.
export default function PhaseTimeline({ clientId }: { clientId: number }) {
  const data = getPlanData(clientId);
  return (
    <div className="pl">
      <PlanPhasesCard clientId={clientId} today={data.today} thisWeek={data.thisWeek} phases={data.phases} programs={data.programs} />
      <PlanGoalsCard
        clientId={clientId}
        clientName={data.clientName}
        currentPhaseName={data.currentPhaseName}
        goals={data.goals}
        nextReview={data.nextReview}
        options={data.goalOptions}
      />
    </div>
  );
}
