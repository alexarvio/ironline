import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createUser, requireCoach } from "../../lib/auth";
import { getData } from "../../lib/db";
import { buildDemoClient } from "../../lib/demoClient";

// The App Review account: a login Apple's reviewers can use to try every
// client screen with something on it. A demo coach of its own ("Sam Carter")
// owns a lived-in demo client (lib/demoClient.ts), so no real coach's client
// list, business numbers or messages are touched.
//
// Open it once, signed in as a coach, on the live site:
//   /api/review-account
// Every visit rebuilds the demo client from scratch and prints a fresh
// password for the reviewer login; put those in App Store Connect's
// "Sign-in required" fields.
export const dynamic = "force-dynamic";

const COACH_EMAIL = "sam.carter@example.com";
const CLIENT_EMAIL = "reviewer@example.com";
const CLIENT_NAME = "Jamie Reviewer";

// Twelve characters, no look-alikes (0/O, 1/l/I), so it can be typed from a screen.
function readablePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(12), (b) => alphabet[b % alphabet.length]).join("");
}

export async function GET() {
  await requireCoach();
  const data = getData();
  const coach = data.users.find((u) => u.email === COACH_EMAIL && u.role === "coach") ?? createUser(COACH_EMAIL, readablePassword(), "coach", null, false);
  // Nobody else may already hold the reviewer's address (a real client, say).
  const holder = data.users.find((u) => u.email === CLIENT_EMAIL);
  const holderClient = holder?.client_id != null ? data.clients.find((c) => c.id === holder.client_id) : null;
  if (holder && !(holder.role === "client" && holderClient?.name === CLIENT_NAME)) {
    return new NextResponse(`${CLIENT_EMAIL} is already someone else's login; nothing was changed.`, { status: 409 });
  }

  const clientId = buildDemoClient(coach.id, CLIENT_NAME);
  const password = readablePassword();
  createUser(CLIENT_EMAIL, password, "client", clientId, false);

  return new NextResponse(
    [
      "App Review account ready.",
      "",
      `Email:    ${CLIENT_EMAIL}`,
      `Password: ${password}`,
      "",
      `A demo client (${CLIENT_NAME}) of a demo coach (Sam Carter), with a live programme, logged training,`,
      "check-ins, messages and meetings. Opening this page again rebuilds it and makes a new password.",
    ].join("\n"),
    { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } }
  );
}
