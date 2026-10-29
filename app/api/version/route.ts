import { buildId } from "../../lib/buildId";

export const dynamic = "force-dynamic";

// The build the server runs now, for FreshBuild to compare with the page's own.
export function GET() {
  return Response.json({ build: buildId() }, { headers: { "Cache-Control": "no-store" } });
}
