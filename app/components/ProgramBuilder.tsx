import { ReactNode } from "react";
import { addSessionAction } from "../lib/actions";
import {
  getAssignmentsForDay,
  listClientPhases,
  programLoggedWeekIndexes,
  getCustomValues,
  getDeployedProgram,
  listCardioForDay,
  listCardioColumns,
  isCardioDone,
  formatRestSeconds,
  getClientProgramNoteMeta,
  getClientHome,
  getExerciseWeightTrendPct,
  getLogsForAssignment,
  getLogsForAssignmentByWeek,
  getLastVisitAtGym,
  currentGymId,
  getPreviousWeekAssignmentRef,
  homeGymId,
  listClientGyms,
  targetAtGym,
  getProgramCurrentWeekIndex,
  getWeek,
  listExercisesByGroup,
  listPrograms,
  listTrainingColumns,
  listColumnChoices,
  MAX_TRAINING_COLUMNS,
  MAX_SESSIONS_PER_WEEK,
  localDateStr,
  MUSCLE_GROUPS,
  programWeekLabel,
  weekStart,
  ProgramDay,
  TrainingProgram,
  programEmptyReason,
  describeMessageLink,
  videoRequestsFor,
} from "../lib/queries";
import ExerciseRowMenu from "../admin/ExerciseRowMenu";
import { coachIdOfClient } from "../lib/tenancy";
import AssignmentFieldInput, { GymWeightInput } from "./AssignmentFieldInput";
import GymChipRow from "../admin/GymChipRow";
import ExerciseNoteCell from "./ExerciseNoteCell";
import DayLabelForm from "./DayLabelForm";
import ReorderableRows from "./ReorderableRows";
import AddExerciseRow from "./AddExerciseRow";
import { DayPendingProvider, PendingChangesBar, type PendingAssignment } from "./DayPending";
import SessionMenu from "../admin/SessionMenu";
import CustomValueInput from "../admin/CustomValueInput";
import AdminDayCard from "./AdminDayCard";
import ReorderableSessions from "./ReorderableSessions";
import CardioBlock from "./CardioBlock";
import DemoVideoDialog from "../admin/DemoVideoDialog";
import LoggedSetsGrid, { repsLowOf, type PreviousLane } from "../admin/LoggedSetsGrid";
import { WeightGoalHint } from "../admin/BuilderContext";
import ProgramBuilderShell, { BuilderProgram, WeekCard } from "../admin/ProgramBuilderShell";
import { phaseRange } from "../lib/phases";
import ColumnMenus from "../admin/ColumnMenus";
import CopyWeekButton from "../admin/CopyWeekButton";

function formatTarget(sets: number, reps: string, targetWeight: number | null, rpe: number | null) {
  const weightPart = targetWeight ? ` @${targetWeight}kg` : "";
  const rpePart = rpe ? ` RPE${rpe}` : "";
  return `${sets}×${reps}${weightPart}${rpePart}`;
}

function formatActualLogs(logs: { weight_kg: number | null; reps: number | null }[]) {
  if (logs.length === 0) return "not logged";
  return logs.map((l) => `${l.weight_kg ?? "–"}kg×${l.reps ?? "–"}`).join(", ");
}

// Column widths from the design. The exercise column takes whatever is left
// (table-layout is fixed), so it isn't listed here; anything the coach adds
// as a custom column falls back to a sane default.
// The exercise column (280px) and the client's logged column (the rest) are
// fixed by the design; these are what's left to divide at a 1440 canvas once
// the 216px rail and 296px panel are taken out. Sized to the content — a
// weight is at most "142.5", an RPE is one or two characters.
// Notes and each gym's weight get enough to read (a gym name like "Muscle
// Factory", a note's first words); "What the client did" takes what is left
// and scrolls its sets inside the cell when they do not fit.
const COLUMN_WIDTH: Record<string, string> = {
  sets: "48px",
  reps: "58px",
  weight_goal: "72px",
  rpe: "48px",
  tempo: "56px",
  rest: "52px",
  notes: "180px",
  distance: "62px",
  time: "58px",
};


// The Program Builder: pick a program, pick one of its weeks, edit the seven
// days, with the client's real performance alongside. Every week of every
// program is rendered here server-side and handed to the shell, which shows
// one at a time — so switching weeks is instant and no edit state is lost.
export default function ProgramBuilder({
  clientId,
  clientName,
  phaseParam,
  weekLinkBase = "/admin",
}: {
  clientId: number;
  clientName?: string;
  /** `?phase=` — which programme's band to open on. */
  phaseParam?: string;
  weekLinkBase?: string;
}) {
  const allPrograms = listPrograms(clientId);
  // The Plan tab's training phases, so a programme can say when it runs and
  // "Edit dates" has something to open.
  const trainingPhases = listClientPhases(clientId).filter((p) => p.track === "training");
  const deployedProgram = getDeployedProgram(clientId);
  // Every draft, in the order they will run: the Plan tab can hold several
  // future blocks, each a draft here until it is deployed.
  const draftPrograms = allPrograms.filter((p) => p.status === "draft");
  const pastPrograms = allPrograms
    .filter((p) => p.status === "deployed" && p.id !== deployedProgram?.id)
    .sort((a, b) => b.start_week - a.start_week);

  // The client's coach's own library; another coach's exercises never show.
  const exercisesByGroup = listExercisesByGroup(coachIdOfClient(clientId) ?? 0);
  // Each exercise's demo, for a row added in the builder and not applied yet.
  const exerciseVideos: Record<number, string | null> = Object.fromEntries(
    Object.values(exercisesByGroup)
      .flat()
      .map((e) => [e.id, e.video_url ?? null] as const)
  );
  const allColumns = listTrainingColumns(clientId);
  const cardioColumns = listCardioColumns(clientId);
  const columnChoices = listColumnChoices(clientId);
  const columns = allColumns.filter((c) => c.visible);
  const customColumnIds = allColumns.filter((c) => c.kind === "custom").map((c) => c.id);
  const customValues = getCustomValues(customColumnIds);
  const customValueFor = (assignmentId: number, columnId: number) =>
    customValues.find((v) => v.workout_assignment_id === assignmentId && v.column_id === columnId)?.value ?? "";

  // The client's gyms. The home gym's weight is the Weight figure; with any
  // other gym still in use, each gets its own box and the logged lanes say
  // where the sets were done.
  const allGyms = listClientGyms(clientId, true);
  const home = homeGymId(clientId);
  const homeGym = allGyms.find((g) => g.id === home) ?? null;
  const otherGyms = listClientGyms(clientId).filter((g) => g.id !== home);
  const multiGym = homeGym != null && otherGyms.length > 0;
  const gymNameOf = (id: number | null) => allGyms.find((g) => g.id === id)?.name ?? null;
  const gymNames = Object.fromEntries(allGyms.map((g) => [g.id, g.name]));
  // The exercise table's column widths; Weight grows a box per gym.
  const columnWidths: Record<string, string> = multiGym
    ? { ...COLUMN_WIDTH, weight_goal: `${100 * (otherGyms.length + 1)}px` }
    : COLUMN_WIDTH;
  const cell = (l: { set_number: number; weight_kg: number | null; reps: number | null; rpe_actual: number | null }) => ({
    setNumber: l.set_number,
    weightKg: l.weight_kg,
    reps: l.reps,
    rpe: l.rpe_actual,
  });

  const currentWeek = weekStart(localDateStr());
  // Sessions with news the coach has not opened yet (a finished workout, a
  // reason for missing one): the week and the session carry the dot.
  const newDayIds = new Set(getClientHome(clientId).unseenDayIds);
  const liveWeekNumber = deployedProgram ? deployedProgram.start_week + getProgramCurrentWeekIndex(deployedProgram) - 1 : null;

  function renderDays(days: ProgramDay[]) {
    return days.map((day) => ({
      id: day.id,
      card: renderDay(day, days),
    }));
  }

  function renderDay(day: ProgramDay, days: ProgramDay[]) {
      const assignments = getAssignmentsForDay(day.id);
      // A session is its place in the week: no weekday, just Session 1, 2, 3.
      const sessionName = `Session ${day.day_of_week}`;
      // A message can link a session or exercise the client can open: the
      // live programme's weeks up to this one. Elsewhere there is no link to
      // make, so no way in.
      const sessionLink = describeMessageLink(clientId, { kind: "session", dayId: day.id });
      const messageable = !sessionLink.gone;
      const cardioCount = listCardioForDay(day.id).length;
      const isEmpty = assignments.length === 0 && cardioCount === 0;
      // How many weeks of this day's programme come after it, for the
      // "also add to the remaining weeks" option on the add row.
      const dayProgram = allPrograms.find(
        (p) => day.week_number >= p.start_week && day.week_number < p.start_week + p.total_weeks
      );
      const remainingWeeks = dayProgram ? dayProgram.start_week + dayProgram.total_weeks - 1 - day.week_number : 0;
      // A video can be asked for on a programme the client has (live, or
      // one they have finished); a draft is not theirs to film yet.
      const canAskVideo = dayProgram?.status === "deployed";
      const videoRequests = canAskVideo ? videoRequestsFor(assignments.map((a) => a.id)) : new Map();
      // Videos in this session the coach has not opened yet, said on its
      // header so a folded session shows where the video is.
      const newVideos = [...videoRequests.values()].filter((r) => r.file_path && !r.seen_at).length;
      const videoWhere = `${sessionName}${day.label ? ` · ${day.label}` : ""}, ${dayProgram ? programWeekLabel(dayProgram, day.week_number) : `Week ${day.week_number}`}`;
      const setsLoggedThisWeek = assignments.reduce((sum, a) => {
        const wg = getLogsForAssignmentByWeek(a.id).find((g) => g.weekStart === currentWeek);
        return sum + (wg ? wg.logs.length : 0);
      }, 0);
      // Which gym the client picked for this session, read off the sets they
      // logged on it. Only worth saying when they have more than one gym.
      const dayLog = allGyms.length > 1 ? assignments.flatMap((a) => getLogsForAssignment(a.id))[0] : undefined;
      const dayGymName = dayLog ? gymNameOf(dayLog.gym_id ?? home) : null;
      // Complete as the client's app counts it: every planned set logged and
      // every cardio ticked.
      const sessionDone =
        !isEmpty &&
        assignments.every((a) => {
          const logged = new Set(getLogsForAssignment(a.id).map((l) => l.set_number));
          return Array.from({ length: a.sets }, (_, i) => i + 1).every((n) => logged.has(n));
        }) &&
        listCardioForDay(day.id).every((c) => isCardioDone(c.id));
      const summary = isEmpty
        ? "Nothing yet"
        : [
            assignments.length ? `${assignments.length} exercise${assignments.length === 1 ? "" : "s"}` : null,
            cardioCount ? `${cardioCount} cardio` : null,
          ]
            .filter(Boolean)
            .join(" · ");

      // Everything the pending-changes bar needs to show a diff against:
      // the saved value of every editable field on the day.
      const pendingAssignments: PendingAssignment[] = assignments.map((a) => ({
        id: a.id,
        exerciseId: a.exercise_id,
        exerciseName: a.exercise_name ?? "Exercise",
        fields: {
          sets: String(a.sets),
          reps: a.reps ?? "",
          targetWeight: a.target_weight_kg == null ? "" : String(a.target_weight_kg),
          rpe: a.rpe_target == null ? "" : String(a.rpe_target),
          tempo: a.tempo ?? "",
          rest: formatRestSeconds(a.rest_seconds),
          distance: a.distance ?? "",
          time: a.time ?? "",
          notes: a.notes ?? "",
        },
        custom: Object.fromEntries(columns.filter((c) => c.kind === "custom").map((c) => [c.id, customValueFor(a.id, c.id)])),
        gyms: Object.fromEntries(
          otherGyms.map((g) => {
            const kg = a.gym_targets?.[g.id]?.kg;
            return [g.id, kg == null ? "" : String(kg)];
          })
        ),
      }));
      const weekIdx = dayProgram ? day.week_number - dayProgram.start_week + 1 : day.week_number;
      const remainingLabel =
        remainingWeeks <= 0
          ? ""
          : remainingWeeks === 1
          ? `W${weekIdx + 1}`
          : `W${weekIdx + 1}–W${weekIdx + remainingWeeks}`;

      return (
        <DayPendingProvider
          key={day.id}
          dayId={day.id}
          dayName={sessionName}
          weekLabel={`W${weekIdx}`}
          remainingCount={remainingWeeks}
          remainingLabel={remainingLabel}
          columns={columns.map((c) => ({ id: c.id, kind: c.kind, key: c.key, label: c.label }))}
          assignments={pendingAssignments}
          cardio={listCardioForDay(day.id).map((c) => ({ id: c.id, fields: { name: c.name, time: c.time, pace: c.pace, incline: c.incline, distance: c.distance ?? "", notes: c.notes } }))}
          label={day.label ?? ""}
          isRest={false}
          gymNames={gymNames}
        >
        <AdminDayCard
          dayName={sessionName}
          labelSlot={
            <DayLabelForm programDayId={day.id} defaultLabel={day.label ?? ""} placeholder="Session name (e.g. Push A)" fallback={sessionName} />
          }
          menuSlot={
            <SessionMenu
              programDayId={day.id}
              sessionName={sessionName}
              message={messageable ? { link: sessionLink.link, area: "Training", label: sessionLink.label } : null}
              // Duplicate copies exercises and cardio alike; an empty session has nothing to copy.
              copy={
                assignments.length > 0 || cardioCount > 0
                  ? {
                      fromDayId: day.id,
                      sourceName: `${sessionName}${day.label ? ` · ${day.label}` : ""}`,
                      newSessionNumber: days.length < MAX_SESSIONS_PER_WEEK ? days.length + 1 : null,
                      remainingWeeks,
                      remainingLabel,
                      targets: days
                        .filter((d) => d.id !== day.id)
                        .map((d) => ({
                          id: d.id,
                          name: `Session ${d.day_of_week}${d.label ? ` · ${d.label}` : ""}`,
                          exerciseCount: getAssignmentsForDay(d.id).length,
                        })),
                    }
                  : null
              }
            />
          }
          statusPill={
            setsLoggedThisWeek > 0 || dayGymName || newVideos > 0 ? (
              <>
                {newVideos > 0 && (
                  <span className="pb-video-pill" title="Open the session: the dot on an exercise's ⋯ marks the video">
                    {newVideos === 1 ? "New video" : `${newVideos} new videos`}
                  </span>
                )}
                {setsLoggedThisWeek > 0 && (
                  <span className="pb-logged-pill">
                    {setsLoggedThisWeek} set{setsLoggedThisWeek === 1 ? "" : "s"} logged
                  </span>
                )}
                {dayGymName && (
                  <span className="pb-day-gym" title="The gym the client picked for this session">
                    {dayGymName}
                  </span>
                )}
              </>
            ) : undefined
          }
          gymSlot={
            day.skip_reason || sessionDone ? (
              <>
                {sessionDone && <span className="pb-day-done">Session completed</span>}
                {day.skip_reason && !sessionDone && (
                  <span className="pb-day-skip" title="The client's reason for not doing this session">
                    Couldn&rsquo;t train · {day.skip_reason}
                  </span>
                )}
              </>
            ) : undefined
          }
          summary={summary}
          isRest={isEmpty}
          // Every day starts folded; the coach opens the one they are working
          // on, or Expand all. Keyed by day, so an open day survives an Apply.
          defaultOpen={false}
          news={newDayIds.has(day.id) ? { clientId, dayId: day.id } : undefined}
          footSlot={<PendingChangesBar />}
          defaultMode={assignments.length === 0 && cardioCount > 0 ? "cardio" : "exercises"}
          cardio={
            <CardioBlock
              groups={MUSCLE_GROUPS.filter((g) => g.slug === "cardio")}
              exercisesByGroup={{ cardio: exercisesByGroup.cardio ?? [] }}
              columns={cardioColumns}
            />
          }
          exercises={
          <div className="exercise-table-wrap">
            {/* Grip and Exercise are 22 + 280 exactly, as in the cardio table,
                so the toggle between the two never moves them; 280 holds the
                trend, a name on up to two lines and "Add demo". The spare
                width goes to "What the client did", which scrolls inside its
                own cell when a week has more sets than fit, rather than
                taking room from the names. */}
            <table
              className="exercise-table"
              style={{ minWidth: 22 + 280 + columns.reduce((sum, col) => sum + parseInt(columnWidths[col.key] ?? "90px", 10), 0) + 280 }}
            >
              <colgroup>
                <col style={{ width: "22px" }} />
                <col style={{ width: "280px" }} />
                {columns.map((col) => (
                  <col key={col.id} style={{ width: columnWidths[col.key] ?? "90px" }} />
                ))}
                <col />
              </colgroup>
              <thead>
                <tr>
                  {/* Grip column for drag-to-reorder. */}
                  <th aria-hidden="true"></th>
                  <th>Exercise</th>
                  {columns.map((col) => (
                    <th key={col.id}>{col.label}</th>
                  ))}
                  <th className="logged-col">
                    <span className="pb-log-head">
                      <span>What the client did</span>
                      <span className="pb-log-legend">
                        <span className="met">● target met</span>
                        <span className="under">● under</span>
                      </span>
                    </span>
                  </th>
                </tr>
              </thead>
              <ReorderableRows
                programDayId={day.id}
                exerciseVideos={exerciseVideos}
                remainingWeeks={remainingWeeks}
                columnCount={columns.length + 2}
                footer={
                  <AddExerciseRow
                    columns={columns.map((c) => ({ id: c.id, kind: c.kind, key: c.key, label: c.label }))}
                    // "Other" only earns a tile when something is filed there.
                    groups={MUSCLE_GROUPS.filter((g) => g.slug !== "other" || (exercisesByGroup.other?.length ?? 0) > 0)}
                    exercisesByGroup={exercisesByGroup}
                  />
                }
                rows={assignments.map((a) => {
                  const weekGroups = getLogsForAssignmentByWeek(a.id);
                  // Two independent facts about this exercise, both shown when
                  // there's history for them: how the client is trending on it
                  // overall, and what last week actually asked for versus what
                  // they did. Neither depends on whether this day is published.
                  const prevRef = getPreviousWeekAssignmentRef(clientId, day.week_number, day.day_of_week, a.exercise_id);

                  // This week over last, each judged against the target that
                  // was live for ITS OWN week — see LoggedSetsGrid for why
                  // that matters.
                  const thisWeekSets = weekGroups
                    .flatMap((wg) => wg.logs)
                    .map((l) => ({
                      setNumber: l.set_number,
                      weightKg: l.weight_kg,
                      reps: l.reps,
                      rpe: l.rpe_actual,
                    }));
                  // Last week's lane: the same exercise on the same day a week
                  // earlier. No lane at all when there is no earlier week; "new
                  // this week" when the week exists but the exercise wasn't on it.
                  const hasPrevWeek = day.week_number > 1 && getWeek(clientId, day.week_number - 1).length > 0;
                  // With gyms, sets logged this week compare against the last
                  // visit to the same gym, since last week may have been the
                  // other one. A gym never trained at before has nothing to
                  // compare against, and no target of its own to be under.
                  const ownLogs = multiGym ? getLogsForAssignment(a.id) : [];
                  const loggedGym = ownLogs.length ? ownLogs[0].gym_id ?? home : null;
                  const visit =
                    loggedGym != null
                      ? getLastVisitAtGym(clientId, a.exercise_id, loggedGym, { week: day.week_number, dayOfWeek: day.day_of_week })
                      : null;
                  const firstVisit = loggedGym != null && loggedGym !== home && !visit && a.gym_targets?.[loggedGym]?.kg == null;
                  // The trend is one gym's too: where this week was trained,
                  // or the gym the client is using now.
                  const trendGym = multiGym ? loggedGym ?? currentGymId(clientId) : null;
                  const weightTrendPct = getExerciseWeightTrendPct(clientId, a.exercise_id, day.week_number, multiGym ? trendGym : undefined);
                  const trendDir = weightTrendPct == null ? null : weightTrendPct > 0 ? "up" : weightTrendPct < 0 ? "down" : null;
                  const previous: PreviousLane | null =
                    loggedGym != null && (visit || loggedGym !== home)
                      ? visit
                        ? {
                            kind: "logged",
                            weekNumber: visit.weekNumber,
                            gymName: gymNameOf(loggedGym),
                            targetWeightKg: targetAtGym(visit.assignment, loggedGym, home),
                            repsLow: repsLowOf(visit.assignment.reps),
                            sets: visit.logs.map(cell),
                          }
                        : { kind: "absent", note: `First time at ${gymNameOf(loggedGym)}` }
                      : !hasPrevWeek
                      ? null
                      : prevRef
                      ? {
                          kind: "logged",
                          weekNumber: day.week_number - 1,
                          gymName: multiGym && prevRef.actualLogs.length ? gymNameOf(prevRef.actualLogs[0].gym_id ?? home) : null,
                          targetWeightKg: prevRef.target_weight_kg,
                          repsLow: repsLowOf(prevRef.reps),
                          sets: prevRef.actualLogs.map(cell),
                        }
                      : { kind: "absent" };

                  return {
                    id: a.id,
                    cells: (
                    <>
                      <td className="exercise-name-cell">
                        {/* Trend hard left, name, demo hard right — the two
                            marginal facts sit at the edges so the eye runs
                            down a clean column of exercise names between
                            them. */}
                        <div className="pb-exercise-title">
                          {weightTrendPct != null && trendDir && (
                            <span
                              className={`pb-trend ${trendDir}`}
                              title={trendGym != null ? `Weight trend at ${gymNameOf(trendGym)}` : "Weight trend"}
                            >
                              {trendDir === "up" ? "▲" : "▼"} {Math.abs(weightTrendPct).toFixed(1)}%
                            </span>
                          )}
                          <span className="pb-exercise-name">{a.exercise_name}</span>
                          {/* The prescription's own demo and the library's
                              video are passed separately. Collapsing them to
                              one `url` meant opening the chip on an exercise
                              with only a library video pre-filled the field
                              with it — and the old save-on-blur then copied
                              it onto the prescription, silently, for doing
                              nothing but looking. */}
                          <DemoVideoDialog
                            assignmentId={a.id}
                            clientId={clientId}
                            exerciseName={a.exercise_name ?? "this exercise"}
                            demoUrl={a.demo_url ?? null}
                            libraryUrl={a.exercise_video_url ?? null}
                          />
                        </div>
                        {/* The old "last … / actual …" prose lived here. The
                            logged grid on the right now says the same thing
                            column-aligned and week-labelled, so repeating it
                            as a sentence only made every row taller. */}
                      </td>
                      {columns.map((col) => {
                        if (col.kind === "custom") {
                          return (
                            <td key={col.id}>
                              <CustomValueInput assignmentId={a.id} columnId={col.id} value={customValueFor(a.id, col.id)} />
                            </td>
                          );
                        }
                        switch (col.key) {
                          case "sets":
                            return (
                              <td key={col.id}>
                                <AssignmentFieldInput assignmentId={a.id} name="sets" type="number" min={1} defaultValue={a.sets} />
                              </td>
                            );
                          case "reps":
                            return (
                              <td key={col.id}>
                                <AssignmentFieldInput assignmentId={a.id} name="reps" type="text" defaultValue={a.reps} />
                              </td>
                            );
                          case "weight_goal":
                            if (multiGym) {
                              return (
                                <td key={col.id}>
                                  <div className="pb-gym-weights">
                                    <label title={homeGym!.name}>
                                      <span>{homeGym!.name}</span>
                                      <AssignmentFieldInput
                                        assignmentId={a.id}
                                        name="targetWeight"
                                        type="number"
                                        step={0.5}
                                        defaultValue={a.target_weight_kg ?? ""}
                                      />
                                      <WeightGoalHint kg={a.target_weight_kg} />
                                    </label>
                                    {otherGyms.map((g) => (
                                      <label key={g.id} title={`${g.name}: empty starts from ${homeGym!.name}'s weight`}>
                                        <span>{g.name}</span>
                                        <GymWeightInput
                                          assignmentId={a.id}
                                          gymId={g.id}
                                          placeholder={a.target_weight_kg == null ? "" : String(a.target_weight_kg)}
                                        />
                                        <WeightGoalHint kg={a.gym_targets?.[g.id]?.kg ?? a.target_weight_kg} />
                                      </label>
                                    ))}
                                  </div>
                                </td>
                              );
                            }
                            return (
                              <td key={col.id}>
                                <AssignmentFieldInput
                                  assignmentId={a.id}
                                  name="targetWeight"
                                  type="number"
                                  step={0.5}
                                 
                                  defaultValue={a.target_weight_kg ?? ""}
                                />
                                <WeightGoalHint kg={a.target_weight_kg} />
                              </td>
                            );
                          case "rpe":
                            return (
                              <td key={col.id}>
                                <AssignmentFieldInput
                                  assignmentId={a.id}
                                  name="rpe"
                                  type="number"
                                  step={0.5}
                                 
                                  defaultValue={a.rpe_target ?? ""}
                                />
                              </td>
                            );
                          case "tempo":
                            return (
                              <td key={col.id}>
                                <AssignmentFieldInput
                                  assignmentId={a.id}
                                  name="tempo"
                                  type="text"
                                 
                                  defaultValue={a.tempo ?? ""}
                                />
                              </td>
                            );
                          case "rest":
                            return (
                              <td key={col.id}>
                                <AssignmentFieldInput
                                  assignmentId={a.id}
                                  name="rest"
                                  type="text"
                                 
                                  defaultValue={formatRestSeconds(a.rest_seconds)}
                                />
                              </td>
                            );
                          case "notes":
                            return (
                              <td key={col.id} className="notes-cell">
                                {/* A note is prose, so the cell shows what
                                    fits and opens an editor for the rest. A
                                    one-line input here showed four words and
                                    scrolled the remainder somewhere the coach
                                    could neither read nor edit it. */}
                                <ExerciseNoteCell
                                  assignmentId={a.id}
                                  exerciseName={a.exercise_name ?? "this exercise"}
                                  note={a.notes ?? ""}
                                />
                              </td>
                            );
                          default:
                            return <td key={col.id}>–</td>;
                        }
                      })}
                      {/* "What the client did" runs to the table's edge; the
                          row's bin sits at the end of it rather than in a
                          column of its own, and stays put while the sets
                          scroll. */}
                      <td className="logged-col">
                        <div className="pb-cell-end">
                          <div className="pb-cell-main">
                            <LoggedSetsGrid
                              weekNumber={day.week_number}
                              firstVisit={firstVisit}
                              targetWeightKg={loggedGym != null ? targetAtGym(a, loggedGym, home) : a.target_weight_kg}
                              repsLow={repsLowOf(a.reps)}
                              plannedSets={a.sets}
                              sets={thisWeekSets}
                              previous={previous}
                            />
                          </div>
                          {/* One ⋯ for what the row can do: video, message, remove. */}
                          <ExerciseRowMenu
                            assignmentId={a.id}
                            exerciseName={a.exercise_name ?? "this exercise"}
                            video={
                              canAskVideo
                                ? {
                                    where: videoWhere,
                                    request: (() => {
                                      const r = videoRequests.get(a.id);
                                      return r
                                        ? {
                                            id: r.id,
                                            note: r.note,
                                            src: r.file_path,
                                            sentAt: r.submitted_at,
                                            seen: !!r.seen_at,
                                            replyNote: r.reply_note ?? null,
                                            replySrc: r.reply_file_path ?? null,
                                            repliedAt: r.replied_at ?? null,
                                            replySeen: !!r.reply_seen_at,
                                          }
                                        : null;
                                    })(),
                                  }
                                : null
                            }
                            message={
                              messageable
                                ? {
                                    link: { kind: "exercise", dayId: day.id, assignmentId: a.id },
                                    area: "Training",
                                    label: `${a.exercise_name ?? "Exercise"} · ${sessionLink.label}`,
                                  }
                                : null
                            }
                          />
                        </div>
                      </td>
                    </>
                    ),
                  };
                })}
              />
            </table>
          </div>
          }
        />
        </DayPendingProvider>
    );
  }

  // Everything the shell needs for one program: its weeks as strip cards,
  // each week's day editor, and the forms behind renaming/deploying/copying.
  function buildProgram(program: TrainingProgram, status: BuilderProgram["status"]): BuilderProgram {
    const weekContents: Record<number, ReactNode> = {};
    const weekSummaries: Record<number, string> = {};
    const copySlots: Record<number, ReactNode> = {};
    const weekCards: WeekCard[] = [];
    let copyFromWeek: number | null = null;

    for (let i = 0; i < program.total_weeks; i++) {
      const index = i + 1;
      const weekNumber = program.start_week + i;
      const days = getWeek(clientId, weekNumber);
      const perDay = days.map((d) => getAssignmentsForDay(d.id));
      const trainingDays = perDay.filter((a) => a.length > 0).length;
      const setsLogged = perDay
        .flat()
        .reduce((sum, a) => sum + (getLogsForAssignmentByWeek(a.id).find((g) => g.weekStart === currentWeek)?.logs.length ?? 0), 0);

      weekContents[index] = (
        <div key={`w${index}`} className="program-sheet">
          <ReorderableSessions clientId={clientId} week={weekNumber} sessions={renderDays(days)} />
          {/* A week is only its sessions: an empty week is just this button.
              Seven is the most a week holds, and then the button says so. */}
          {days.length < MAX_SESSIONS_PER_WEEK ? (
            <form action={addSessionAction} className="pb-add-session-form">
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="week" value={weekNumber} />
              <button type="submit" className="pb-add-session">
                + Add session
              </button>
            </form>
          ) : (
            <p className="pb-add-session-full">{MAX_SESSIONS_PER_WEEK} sessions is the most a week can hold.</p>
          )}
        </div>
      );
      weekSummaries[index] = trainingDays
        ? `${trainingDays} session${trainingDays === 1 ? "" : "s"}${setsLogged ? ` · ${setsLogged} sets logged` : ""}`
        : `${programWeekLabel(program, weekNumber)} has no sessions yet. Add the first one`;

      // One tick per session, in order, reporting what the client actually
      // did: trained, not trained in a week that has passed, or not yet.
      // Only sessions with exercises get a tick, so five training days are
      // five ticks and a skipped second one is the second tick in red.
      const railDays = days.flatMap((d, di) => {
        const assignments = perDay[di];
        if (assignments.length === 0) return [];
        const name = `Session ${d.day_of_week}${d.label ? ` · ${d.label}` : ""}`;
        const trained = assignments.some((x) => getLogsForAssignment(x.id).length > 0);
        // Red once it can no longer be trained: the week has passed, the whole
        // programme has, or the client said they couldn't.
        const past = status === "past" || (liveWeekNumber != null && weekNumber < liveWeekNumber);
        if (trained) return { dayOfWeek: d.day_of_week, state: "trained" as const, title: `${name}: trained` };
        if (past || d.skip_reason) return { dayOfWeek: d.day_of_week, state: "missed" as const, title: `${name}: not trained${d.skip_reason ? ` (${d.skip_reason})` : ""}` };
        return { dayOfWeek: d.day_of_week, state: "rest" as const, title: `${name}: not trained yet` };
      });
      // Sessions done, not days lit: a session logged across two days is
      // still one session, and the client's app counts the same way.
      const trainedDays = perDay.filter((a) => a.length > 0 && a.some((x) => getLogsForAssignment(x.id).length > 0)).length;
      const isFuture = liveWeekNumber != null && weekNumber > liveWeekNumber;

      weekCards.push({
        week: index,
        label: programWeekLabel(program, weekNumber),
        days: railDays,
        isLive: liveWeekNumber === weekNumber,
        // … or a video in it the coach has not watched: the dot stays until they do.
        hasNew: days.some((d) => newDayIds.has(d.id)) || [...videoRequestsFor(perDay.flat().map((a) => a.id)).values()].some((r) => r.file_path && !r.seen_at),
        // A week the client has trained in is history and stays. Anything
        // with nothing logged, the live week included, can go: a coach who
        // wants to shorten a block before the client starts it should not
        // have to wait for it to pass. Past programmes are archives, and so
        // are the live programme's past weeks: removing one moves every later
        // week up, so the week the client is on would turn into next week.
        // (A scheduled programme was locked whenever nothing was live, so a
        // new client's first block could not lose a week before it began.)
        locked: status === "past" || (status === "live" && liveWeekNumber != null && weekNumber < liveWeekNumber) || trainedDays > 0,
        // A future week has nothing to report, so it states the plan rather
        // than claiming zero days trained.
        meta: isFuture
          ? `${trainingDays} planned`
          : `${trainedDays} of ${trainingDays} session${trainingDays === 1 ? "" : "s"}`,
      });

      if (trainingDays > 0) copyFromWeek = index;

      if (i > 0) {
        copySlots[index] = (
          <CopyWeekButton
            key={`c${index}`}
            clientId={clientId}
            fromWeek={weekNumber - 1}
            toWeek={weekNumber}
            fromLabel={programWeekLabel(program, weekNumber - 1).toLowerCase()}
            toLabel={programWeekLabel(program, weekNumber).toLowerCase()}
            targetHasContent={trainingDays > 0}
          />
        );
      }
    }

    // A programme's span is when it went out (or is due to) plus however many
    // weeks are on its rail. A draft that has never been sent has no dates of
    // its own — unless the Plan tab drew it one, in which case that phase's
    // are the honest answer.
    const linked = trainingPhases.find((p) => p.program_id === program.id) ?? null;
    const anchor = program.status === "deployed" ? program.deployed_at : program.scheduled_at;
    const span = anchor
      ? (() => {
          // The local day: a UTC stamp can be the day before.
          const from = weekStart(localDateStr(new Date(anchor)));
          const last = new Date(`${from}T00:00:00`);
          last.setDate(last.getDate() + (program.total_weeks - 1) * 7);
          return { start: from, end: localDateStr(last) };
        })()
      : linked
      ? { start: linked.start_week, end: linked.end_week }
      : null;

    return {
      id: program.id,
      name: program.name ?? "",
      status,
      // A draft with a schedule is waiting to go out on its own, so the band
      // reads Scheduled; it is still a draft underneath (editable, deletable).
      state: status === "draft" && program.scheduled_at ? "scheduled" : status,
      totalWeeks: program.total_weeks,
      dates: span ? phaseRange(span.start, span.end) : "",
      start: span?.start ?? null,
      liveWeek: status === "live" ? getProgramCurrentWeekIndex(program) : null,
      phase: linked
        ? {
            phase: linked,
            program: {
              status: status === "live" ? ("live" as const) : program.scheduled_at ? ("scheduled" as const) : ("draft" as const),
              totalWeeks: program.total_weeks,
              loggedWeeks: programLoggedWeekIndexes(program.id),
            },
          }
        : null,
      emptyReason: status === "draft" && !program.scheduled_at ? programEmptyReason(program.id) : null,
      defaultWeek: status === "live" ? getProgramCurrentWeekIndex(program) : 1,
      weekCards,
      copyFromWeek,
      weekContents,
      weekSummaries,
      copySlots,
    };
  }

  const asked = phaseParam && /^\d+$/.test(phaseParam) ? Number(phaseParam) : null;
  const programs: BuilderProgram[] = [
    ...(deployedProgram ? [buildProgram(deployedProgram, "live")] : []),
    ...draftPrograms.map((p) => buildProgram(p, "draft")),
    ...pastPrograms.map((p) => buildProgram(p, "past")),
  ].map((bp) => {
    // The client's note about this programme rides with it, so it shows
    // inside the programme it is about rather than above all of them.
    const note = getClientProgramNoteMeta(clientId, bp.id);
    return { ...bp, clientNote: note ? { ...note, from: (clientName || "the client").split(" ")[0] } : null };
  });

  return (
    <div className="pb">
      <ProgramBuilderShell
        programs={programs}
        clientId={clientId}
        today={localDateStr()}
        others={listClientPhases(clientId).map((p) => ({
          id: p.id,
          track: p.track,
          name: p.name,
          start_week: p.start_week,
          end_week: p.end_week,
        }))}
        weekLinkBase={weekLinkBase}
        initialProgramId={asked && programs.some((p) => p.id === asked) ? asked : null}
        columnsSlot={<ColumnMenus key="cols" clientId={clientId} choices={columnChoices} cardio={cardioColumns} max={MAX_TRAINING_COLUMNS} />}
        gymsSlot={
          <GymChipRow
            key="gyms"
            clientId={clientId}
            gyms={listClientGyms(clientId).map((g) => ({ id: g.id, name: g.name, home: g.id === home }))}
          />
        }
        emptySlot={<p key="empty" className="empty-note">No programmes yet. Start one and build the first week.</p>}
      />

    </div>
  );
}
