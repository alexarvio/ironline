import { NextResponse } from "next/server";
import { getData, persist } from "../../../lib/db";

// Local development only: gives the local coach login (COACH_EMAIL, a made-up
// address) a real email, so signing in through Clerk with an email code
// reaches it. Removes a test sign-up waiting for approval with that email
// first, and drops any old Clerk link so the next sign-in links afresh.
// Refuses anywhere but a dev machine.
//   GET http://localhost:3000/api/dev/coach-email?to=you@example.com
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) return new NextResponse("Not here.", { status: 403 });
  const to = new URL(req.url).searchParams.get("to")?.trim().toLowerCase() ?? "";
  const from = process.env.COACH_EMAIL?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !from) return NextResponse.json({ ok: false, error: "bad email" }, { status: 400 });
  const data = getData();
  const coach = data.users.find((u) => u.role === "coach" && u.email === from);
  if (!coach) return NextResponse.json({ ok: false, error: "no local coach with COACH_EMAIL" }, { status: 404 });
  const removed = data.users.filter((u) => u.email === to && u.role === "coach" && u.pending).length;
  const other = data.users.find((u) => u.email === to && !(u.role === "coach" && u.pending));
  if (other) return NextResponse.json({ ok: false, error: "that email already has a real account" }, { status: 409 });
  data.users = data.users.filter((u) => !(u.email === to && u.role === "coach" && u.pending));
  coach.email = to;
  delete coach.clerk_user_id;
  persist();
  return NextResponse.json({ ok: true, coachId: coach.id, removedPending: removed });
}
