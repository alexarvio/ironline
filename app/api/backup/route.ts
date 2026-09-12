import { requireCoach } from "../../lib/auth";
import { runBackup, backupConfigured } from "../../lib/backup";

// The coach can take a backup on demand: POST /api/backup while signed in.
// Same run the nightly timer does; useful right after a deploy or before
// anything risky. GET says whether backups are configured at all.
export const dynamic = "force-dynamic";

export async function GET() {
  await requireCoach();
  return Response.json({ configured: backupConfigured() });
}

export async function POST() {
  await requireCoach();
  if (!backupConfigured()) return Response.json({ ok: false, error: "Backups are not configured on this server" }, { status: 400 });
  try {
    const result = await runBackup();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Backup failed" }, { status: 500 });
  }
}
