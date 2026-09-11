import { getClient, getGoalEditorOptions, getGoalSummaries, getMeetingsWorkspaceData, localDateStr } from "../lib/queries";
import MeetingsWorkspace, { type WsGoal } from "./MeetingsWorkspace";

// The Meetings tab. Gathers everything the workspace shows and hands it
// over as plain props; the workspace is the interactive part.
export default function MeetingsPanel({ clientId }: { clientId: number }) {
  const today = localDateStr();
  const data = getMeetingsWorkspaceData(clientId);
  const firstName = (getClient(clientId)?.name ?? "the client").split(" ")[0];

  // Every goal, with its live standing in a few words, and its definition.
  const goals: WsGoal[] = getGoalSummaries(clientId).map(({ goal, view, tracking }) => {
    let status = "";
    if (view.kind === "metric") {
      const figure = (view.barLabel ?? "").split(" · ")[0];
      status = `${figure} · ${view.reached ? "reached" : (view.sub ?? "").includes("on pace") ? "on pace" : (view.sub ?? "").includes("behind") ? "behind" : "tracking"}`;
    } else if (view.kind === "exercise") status = (view.right ?? "").replace(/^best /, "");
    else if (view.kind === "habit") status = `${view.segments?.done ?? 0} of ${view.segments?.total ?? 0} · ${view.tone === "green" ? "on track" : "behind"}`;
    else status = goal.done ? "done" : "text";
    return { id: goal.id, text: goal.text, tone: view.tone, status, def: tracking, done: goal.done, meetingId: goal.meeting_id ?? null, tracking: goal.tracked_by ?? null };
  });
  const active = goals.filter((g) => !g.done);
  const earliest = active.length ? getGoalSummaries(clientId).map((s) => s.goal.created_at).filter((d): d is string => !!d).sort()[0] : null;
  const goalsSetLabel = earliest ? `set ${new Date(`${earliest}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "";
  const withGoals = (m: (typeof data.past)[number]) => ({ ...m, goals: goals.filter((g) => g.meetingId === m.id) });

  return (
    <MeetingsWorkspace
      clientId={clientId}
      firstName={firstName}
      today={today}
      upcoming={data.upcoming ? withGoals(data.upcoming) : null}
      alsoScheduled={data.alsoScheduled.map(withGoals)}
      past={data.past.map(withGoals)}
      goals={active}
      goalsSetLabel={goalsSetLabel}
      dots={data.dots}
      others={data.others}
      lastLink={data.lastLink}
      goalOptions={getGoalEditorOptions(clientId)}
    />
  );
}
