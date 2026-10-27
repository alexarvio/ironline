import { NextResponse } from "next/server";
import { getRequestUser } from "../../lib/auth";
import { getData } from "../../lib/db";

// Settings, Your data (27 Oct, Alex): everything a coach's coaching holds, as one file they keep. Every row of every
// table that belongs to one of their clients (by client_id), their own rows (by coach_id: the library, programmes,
// the calendar, invoices, profile, plans), and their clients themselves. Never anyone else's, never the sign-in tables
// (users, sign-in locks), and never another coach's. Photos and videos are named by their paths; the files stay in
// storage. JSON, one key a table, so it reads anywhere.
//   /api/export  → norcoach-export-2026-10-27.json
export const dynamic = "force-dynamic";

/** Tables that are about sign-in or the company, never part of a coach's export. */
const LEFT_OUT = new Set(["users", "login_lock_events", "support_messages", "coach_reset_applied", "workspace_reset_applied", "sessions_migrated", "_seq"]);

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user || user.pending || user.role !== "coach") return NextResponse.json({ error: "Not found" }, { status: 404 });
  const data = getData() as unknown as Record<string, unknown>;
  const clientIds = new Set((getData().clients ?? []).filter((c) => c.coach_id === user.id).map((c) => c.id));
  const out: Record<string, unknown> = {};
  for (const [table, rows] of Object.entries(data)) {
    if (LEFT_OUT.has(table) || !Array.isArray(rows)) continue;
    const mine = rows.filter((r) => {
      if (!r || typeof r !== "object") return false;
      const row = r as Record<string, unknown>;
      if (table === "clients") return clientIds.has(row.id as number);
      if (typeof row.client_id === "number") return clientIds.has(row.client_id);
      return row.coach_id === user.id;
    });
    if (mine.length) out[table] = mine;
  }
  const day = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify({ exported: new Date().toISOString(), coach: user.email, clients: clientIds.size, tables: out }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="norcoach-export-${day}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
