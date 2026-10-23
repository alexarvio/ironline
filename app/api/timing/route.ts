import { NextResponse } from "next/server";
import { getSessionUser, isOwner } from "../../lib/auth";
import { timingReport } from "../../lib/timing";

// The admin screens' server render times (23 Oct; app/lib/timing.ts): the last 200 renders newest first, and per
// screen and per label the count, median and p90 ms. Owner only; 404 for anyone else, so it never says it exists.
//   /api/timing
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.pending || !isOwner(user)) return notFound();
  return NextResponse.json(timingReport(), { headers: { "Cache-Control": "no-store" } });
}
