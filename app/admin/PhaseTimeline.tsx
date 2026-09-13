import { getPlanData } from "../lib/queries";
import PlanPhasesCard from "./PlanPhasesCard";
import PlanGoalsCard from "./PlanGoalsCard";
import PlanMainGoalCard from "./PlanMainGoalCard";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "12 Sep, 14:02" in server-local time.
const stamp = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

// The Plan tab: the main goal, the phases timeline, and the goals table,
// each a white card. Server component: it gathers the data and hands it to
// the interactive cards.
export default function PhaseTimeline({ clientId }: { clientId: number }) {
  const data = getPlanData(clientId);
  return (
    <div className="pl">
      <PlanMainGoalCard
        clientId={clientId}
        clientName={data.clientName}
        value={data.mainGoal}
        savedLabel={data.mainGoalSavedAt ? stamp(data.mainGoalSavedAt) : null}
      />
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
