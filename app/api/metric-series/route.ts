import { getMetricSeries } from "../../lib/queries";
import { requireCoach } from "../../lib/auth";

// Feeds the Measurements graph. It's a route rather than a server-rendered
// chart because switching metric is a control on a panel the coach is already
// looking at — re-rendering the whole tab for it would lose their scroll
// position in the history tables above.
export async function GET(request: Request) {
  await requireCoach();

  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return Response.json({ points: [] });
  }
  return Response.json({ points: getMetricSeries(id) });
}
