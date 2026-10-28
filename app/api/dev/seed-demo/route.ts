import { NextResponse } from "next/server";
import { requireCoach } from "../../../lib/auth";
import { buildDemoClient } from "../../../lib/demoClient";

// Local development only: builds "Demo Client", a lived-in client for looking
// at the coach screens with something on them (lib/demoClient.ts). Calling it
// again removes the previous Demo Client and builds a fresh one. Refuses
// anywhere but a dev machine, so it can never run on live.
//   GET http://localhost:3000/api/dev/seed-demo   (signed in as the coach)
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) return new NextResponse("Not here.", { status: 403 });
  const coach = await requireCoach();
  const id = buildDemoClient(coach.id, "Demo Client");
  return NextResponse.json({ ok: true, clientId: id, open: `/admin?client=${id}&tab=training` });
}
