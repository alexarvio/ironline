import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./app/lib/sentryOptions";

// Errors thrown while rendering, in server actions and in route handlers go
// to Sentry (settings in app/lib/sentryOptions.ts).
export const onRequestError = Sentry.captureRequestError;

// Runs once when the server starts. Starts Sentry, then schedules the nightly
// backup and, if the bucket has no snapshot for today yet, takes one shortly
// after boot, so a deploy never leaves a day uncovered.
export async function register() {
  Sentry.init(sentryOptions);
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Postgres mode (STORE=postgres) loads the data before the server takes
  // any request; in JSON mode this does nothing.
  const { initStore } = await import("./app/lib/pg/runtime");
  await initStore();
  // Storage bucket on (UPLOADS_STORE=bucket): copy any files the bucket does
  // not have yet, in the background so the server starts straight away.
  const { copyDiskUploadsToBucket } = await import("./app/lib/storage");
  void copyDiskUploadsToBucket().catch((e) => console.error("[uploads] copy to bucket failed:", e instanceof Error ? e.message : e));
  // Reminder pushes for booked calls (a day and an hour before), checked
  // every five minutes on the live server.
  const { meetingRemindersOn, runMeetingReminders } = await import("./app/lib/meetingReminders");
  if (meetingRemindersOn()) {
    const remind = () =>
      void runMeetingReminders()
        .then((n) => n && console.log(`[reminders] sent ${n}`))
        .catch((e) => console.error("[reminders] failed:", e instanceof Error ? e.message : e));
    setInterval(remind, 5 * 60_000).unref?.();
    setTimeout(remind, 90_000).unref?.();
  }
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
