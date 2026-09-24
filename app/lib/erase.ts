import { allocId, getData, persist } from "./db";
import { deleteBackupUploads } from "./backup";
import { removeAllSubscriptions } from "./push";
import { removeClient } from "./queries";
import { deleteUploadFolder } from "./storage";

// Erasing a client: everything of theirs, wherever it lives. Their rows in the
// store (removeClient), their files on the disk, in the uploads bucket and in
// the backup bucket's mirror, and their push devices in Postgres. What is left
// afterwards is only what the law makes the coach keep (invoices, when the
// client deleted the account themselves) and the nightly snapshots, which age
// out after 30 days.

// Every uploads folder that is per client: <kind>/<clientId>/...
const CLIENT_UPLOAD_KINDS = ["avatars", "chat", "demos", "meals", "progress", "videos"] as const;

export async function eraseClient(clientId: number, opts: { selfDeleted: boolean }) {
  const data = getData();
  const client = data.clients.find((c) => c.id === clientId);
  if (!client) return;
  const userIds = data.users.filter((u) => u.role === "client" && u.client_id === clientId).map((u) => u.id);

  if (opts.selfDeleted) {
    data.account_deletions = [
      ...(data.account_deletions ?? []),
      { id: allocId("account_deletions"), at: new Date().toISOString(), coach_id: client.coach_id ?? null, client_id: clientId, name: client.name },
    ];
    persist();
  }
  // The rows first: from here the client is gone from the app, whatever
  // happens to the file clean-up below.
  removeClient(clientId, { keepInvoices: opts.selfDeleted });

  const failures: unknown[] = [];
  const attempt = async (work: () => Promise<unknown>) => {
    try {
      await work();
    } catch (error) {
      failures.push(error);
    }
  };
  await attempt(() => removeAllSubscriptions(userIds));
  for (const kind of CLIENT_UPLOAD_KINDS) {
    const folder = `${kind}/${clientId}/`;
    await attempt(() => deleteUploadFolder(folder));
    await attempt(() => deleteBackupUploads(folder));
  }
  if (failures.length) {
    // The account is deleted; some files may not be. Loud, so they can be
    // removed by hand: the client was promised everything goes.
    console.error(`[erase] client ${clientId}: ${failures.length} clean-up step(s) failed`, failures);
    const Sentry = await import("@sentry/nextjs").catch(() => null);
    Sentry?.captureException(new Error(`Erasing client ${clientId}: ${failures.length} file clean-up step(s) failed`), { extra: { failures: failures.map(String) } });
  }
}
