/* One-off backfill for the training-programs model change: retroactively
   wraps each client's existing program_days (created before the "program"
   concept existed) into TrainingProgram rows, so the redesigned admin
   Training tab has something to show for clients that already had weeks
   built. Splits each client's weeks into maximal consecutive runs sharing
   the same fully-published/not status, so an existing "week 1 published,
   weeks 2-3 draft" client correctly becomes one deployed + one draft
   program instead of a single program spanning mismatched statuses.

   A deployed run's deployed_at is backdated so "today" lands on its last
   (most recently built) week, matching how it was actually being used,
   rather than resetting everyone to "week 1 of N" the moment this runs.

   Run with: npx tsx scripts/backfill-programs.ts
   The dev server must be stopped first — it keeps its own in-memory copy of
   the JSON store and would overwrite this script's writes on its next save.
*/
import { getData, persist, allocId } from "../app/lib/db";
import { getWeek, listWeekNumbers } from "../app/lib/queries";

const data = getData();
const clientIds = [...new Set(data.program_days.map((d) => d.client_id))];

type Run = { start: number; end: number; published: boolean };

clientIds.forEach((clientId) => {
  const existing = data.training_programs.filter((p) => p.client_id === clientId);
  if (existing.length > 0) {
    console.log(`Client ${clientId}: already has ${existing.length} program(s), skipping.`);
    return;
  }
  const weeks = listWeekNumbers(clientId).sort((a, b) => a - b);
  if (weeks.length === 0) return;

  const runs: Run[] = [];
  weeks.forEach((w) => {
    const published = getWeek(clientId, w).every((d) => d.status === "published");
    const last = runs[runs.length - 1];
    if (last && last.end === w - 1 && last.published === published) {
      last.end = w;
    } else {
      runs.push({ start: w, end: w, published });
    }
  });

  runs.forEach((run) => {
    const totalWeeks = run.end - run.start + 1;
    let deployedAt: string | null = null;
    if (run.published) {
      const d = new Date();
      d.setDate(d.getDate() - (totalWeeks - 1) * 7);
      deployedAt = d.toISOString();
    }
    data.training_programs.push({
      id: allocId("training_programs"),
      client_id: clientId,
      name: null,
      start_week: run.start,
      total_weeks: totalWeeks,
      status: run.published ? "deployed" : "draft",
      deployed_at: deployedAt,
      scheduled_at: null,
    });
    console.log(
      `Client ${clientId}: backfilled ${run.published ? "deployed" : "draft"} program, weeks ${run.start}-${run.end}.`
    );
  });
});

persist();
console.log("Done.");
