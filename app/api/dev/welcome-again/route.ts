import { NextResponse } from "next/server";
import { getSessionUser } from "../../../lib/auth";
import { getData, persist } from "../../../lib/db";

// Local development only: marks the signed-in coach for the welcome steps
// again and opens them, to try /welcome without a fresh sign-up.
//   GET http://localhost:3000/api/dev/welcome-again
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.RAILWAY_ENVIRONMENT) return new NextResponse("Not here.", { status: 403 });
  const user = await getSessionUser();
  const row = user?.role === "coach" ? getData().users.find((u) => u.id === user.id) : null;
  if (!row) return NextResponse.redirect(new URL("/login", req.url));
  row.onboarding = true;
  persist();
  return NextResponse.redirect(new URL("/welcome", req.url));
}
