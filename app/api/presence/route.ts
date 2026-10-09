import { NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth";
import { listPresence } from "../../lib/presence";

// Who is in the app right now, for /admin/presence (9 Oct). Coaches only.
// Polling this does not count as being somewhere: the dashboard is left
// open beside the work, and it must not show the owner as "in the app".
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "coach") return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ now: Date.now(), rows: listPresence() });
}
