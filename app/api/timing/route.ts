import { NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth";
import { timingReport } from "../../lib/timing";

// The admin screens' server render times (23 Oct; app/lib/timing.ts): the last 200 renders newest first, and per
// screen and per label the count, median and p90 ms. Any signed-in coach (23 Oct: the owner's email on Railway is not the
// account Alex uses, and these are timings only, no client data); 404 for anyone else, so it never says it exists.
//   /api/timing
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.pending || user.role !== "coach") return notFound();
  return NextResponse.json(timingReport(), { headers: { "Cache-Control": "no-store" } });
}
