import { NextResponse } from "next/server";
import { getRequestUser } from "../../lib/auth";
import { memoryReport, timingReport } from "../../lib/timing";
import { bucketProbe, storageStats } from "../../lib/storage";

// The admin screens' server render times (23 Oct; app/lib/timing.ts): the last 200 renders newest first, and per
// screen and per label the count, median and p90 ms. Any signed-in coach (23 Oct: the owner's email on Railway is not the
// account Alex uses, and these are timings only, no client data); 404 for anyone else, so it never says it exists.
//   /api/timing
export const dynamic = "force-dynamic";

const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404, headers: { "Cache-Control": "no-store" } });

export async function GET(request: Request) {
  // Read from the request (23 Oct): with Clerk on, the proxy does not run on /api, so the page's own reader saw no one.
  const user = await getRequestUser(request);
  if (!user || user.pending || user.role !== "coach") return notFound();
  // How far the uploads bucket is, asked now (25 Oct): its host and three small asks in ms.
  const bucket = await bucketProbe().catch(() => null);
  // The process's and the container's memory, in MB (4 Nov, Alex: memory is most of the bill; app/lib/timing.ts).
  return NextResponse.json({ memory: memoryReport(), bucket, storage: await storageStats(), ...timingReport() }, { headers: { "Cache-Control": "no-store" } });
}
