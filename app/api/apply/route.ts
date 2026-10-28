import { NextResponse } from "next/server";
import { sendApplicationEmail, type Application } from "../../lib/mail";

// The website's Apply form (norcoachapp.com/apply.html, website/; 28 Oct, Alex: "email me"): each application is
// emailed to APPLY_TO_EMAIL (else OWNER_EMAIL) through Resend, Reply going to the coach who applied. Public, so the
// website can post here from its own origin; a hidden field and a few sends an hour per address keep bots out.
// When mail isn't set up or Resend refuses, the application is written to the server log whole, so none is lost,
// and the form says it didn't go.
//   POST /api/apply  { name, email, business?, clients?, uses?, hardest?, website? (the bot trap) }
export const dynamic = "force-dynamic";

const ORIGINS = new Set(["https://norcoachapp.com", "https://www.norcoachapp.com"]);
const devOrigin = (o: string) => process.env.NODE_ENV !== "production" && /^http:\/\/localhost:\d+$/.test(o);

function cors(request: Request): Record<string, string> {
  const origin = request.headers.get("origin") ?? "";
  if (!ORIGINS.has(origin) && !devOrigin(origin)) return {};
  return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" };
}

// Five sends an hour from one address, kept in memory: enough for a person, a wall for a script.
const recent = new Map<string, number[]>();
function tooMany(ip: string): boolean {
  const now = Date.now();
  const times = (recent.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  times.push(now);
  recent.set(ip, times);
  if (recent.size > 5000) recent.clear();
  return times.length > 5;
}

const field = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const headers = { ...cors(request), "Cache-Control": "no-store" };
  const reply = (status: number, body: object) => NextResponse.json(body, { status, headers });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return reply(400, { error: "Bad request" });
  }
  // A person never sees the trap field; a bot fills it. It gets a thank-you and nothing is sent.
  if (field(body.website, 200)) return reply(200, { ok: true });

  const a: Application = {
    name: field(body.name, 120),
    email: field(body.email, 200),
    business: field(body.business, 200),
    clients: field(body.clients, 20),
    uses: Array.isArray(body.uses) ? body.uses.slice(0, 10).map((u) => field(u, 40)).filter(Boolean) : [],
    hardest: field(body.hardest, 4000),
  };
  if (!a.name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)) return reply(400, { error: "Name and email" });

  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) return reply(429, { error: "Too many" });

  if (await sendApplicationEmail(a)) return reply(200, { ok: true });
  console.error(`[apply] not emailed, kept here: ${JSON.stringify(a)}`);
  return reply(503, { error: "Not sent" });
}
