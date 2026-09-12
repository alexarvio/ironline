// Runs once when the server starts. Schedules the nightly backup and, if
// the bucket has no snapshot for today yet, takes one shortly after boot,
// so a deploy never leaves a day uncovered.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { runBackup, msUntilNextRun, backupConfigured } = await import("./app/lib/backup");
  if (!backupConfigured()) return;

  const run = async (why: string) => {
    try {
      const r = await runBackup();
      if (r) console.log(`[backup] ${why}: ${r.snapshot}, uploads +${r.uploadsCopied} (${r.uploadsSkipped} already there), pruned ${r.pruned}`);
    } catch (e) {
      console.error(`[backup] ${why} failed:`, e instanceof Error ? e.message : e);
    }
  };

  const schedule = () => {
    const wait = msUntilNextRun();
    setTimeout(async () => {
      await run("nightly");
      schedule();
    }, wait).unref?.();
  };

  // A minute after boot, then every night at 03:15 server time.
  setTimeout(() => void run("after start"), 60_000).unref?.();
  schedule();
}
