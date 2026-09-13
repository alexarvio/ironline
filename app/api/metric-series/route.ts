import { getMetricSeries } from "../../lib/queries";
import { requireCoach } from "../../lib/auth";
import { clientIdForMetricDefinition, coachOwnsClient } from "../../lib/tenancy";

// Feeds the Measurements graph. It's a route rather than a server-rendered
// chart because switching metric is a control on a panel the coach is already
// looking at — re-rendering the whole tab for it would lose their scroll
// position in the history tables above.
export async function GET(request: Request) {
  const coach = await requireCoach();

  const id = Number(new URL(request.url).searchParams.get("id"));
  // Only a metric of one of this coach's clients; anything else reads as empty.
  if (!Number.isInteger(id) || id <= 0 || !coachOwnsClient(coach.id, clientIdForMetricDefinition(id))) {
    return Response.json({ points: [] });
  }
  return Response.json({ points: getMetricSeries(id) });
}
