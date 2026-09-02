import { ReactNode } from "react";
import { addExerciseAction, createProgramAction, removeExerciseAction, removeProgramAction } from "../lib/actions";
import {
  getAssignmentsForDay,
  getCustomValues,
  getDeployedProgram,
  getDraftProgram,
  getExerciseWeightTrendPct,
  getLogsForAssignment,
  getLogsForAssignmentByWeek,
  getPreviousWeekAssignmentRef,
  getProgramCurrentWeekIndex,
  getWeek,
  listExercisesByGroup,
  listPrograms,
  listTrainingColumns,
  listColumnChoices,
  MAX_TRAINING_COLUMNS,
  localDateStr,
  MUSCLE_GROUPS,
  programWeekLabel,
  weekStart,
  ProgramDay,
  TrainingProgram,
} from "../lib/queries";
import { DAY_NAMES_FULL } from "../lib/db";
import AssignmentFieldInput from "./AssignmentFieldInput";
import ExerciseNoteCell from "./ExerciseNoteCell";
import DayLabelForm from "./DayLabelForm";
import ExercisePicker from "./ExercisePicker";
import CustomValueInput from "../admin/CustomValueInput";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import AdminDayCard from "./AdminDayCard";
import DemoVideoDialog from "../admin/DemoVideoDialog";
import LoggedSetsGrid, { LoggedWeekRow } from "../admin/LoggedSetsGrid";
import ProgramBuilderShell, { BuilderProgram, WeekCard } from "../admin/ProgramBuilderShell";
import ProgramNameForm from "../admin/ProgramNameForm";
import AutosaveNote from "../admin/AutosaveNote";
import ProgramDeployControls from "../admin/ProgramDeployControls";
import ColumnChipRow from "../admin/ColumnChipRow";
import CopyWeekButton from "../admin/CopyWeekButton";
import DayRestToggle from "../admin/DayRestToggle";

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
// The exercise column (210px) and the client's logged column (300px) are
// fixed by the design; these are what's left to divide at a 1440 canvas once
// the 216px rail and 296px panel are taken out. Sized to the content — a
// weight is at most "142.5", an RPE is one or two characters.
const COLUMN_WIDTH: Record<string, string> = {
  sets: "48px",
  reps: "58px",
  weight_goal: "64px",
  rpe: "48px",
  tempo: "56px",
  rest: "52px",
  distance: "62px",
  time: "58px",
};

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// The Program Builder: pick a program, pick one of its weeks, edit the seven
// days, with the client's real performance alongside. Every week of every
// program is rendered here server-side and handed to the shell, which shows
// one at a time — so switching weeks is instant and no edit state is lost.
export default function ProgramBuilder({
  clientId,
  clientName,
  weekLinkBase = "/admin",
}: {
  clientId: number;
  clientName?: string;
  weekLinkBase?: string;
}) {
  // Stamped on the server, so it changes exactly when a server action has run
  // and revalidated this route — which is what lets the autosave note say
  // "Saved" only once the save has actually landed.
  const renderedAt = Date.now();

  const allPrograms = listPrograms(clientId);
  const deployedProgram = getDeployedProgram(clientId);
  const draftProgram = getDraftProgram(clientId);
  const pastPrograms = allPrograms
    .filter((p) => p.status === "deployed" && p.id !== deployedProgram?.id)
    .sort((a, b) => b.start_week - a.start_week);

  const exercisesByGroup = listExercisesByGroup();
  const allColumns = listTrainingColumns(clientId);
  const columnChoices = listColumnChoices(clientId);
  const columns = allColumns.filter((c) => c.visible);
  const customColumnIds = allColumns.filter((c) => c.kind === "custom").map((c) => c.id);
  const customValues = getCustomValues(customColumnIds);
  const customValueFor = (assignmentId: number, columnId: number) =>
    customValues.find((v) => v.workout_assignment_id === assignmentId && v.column_id === columnId)?.value ?? "";

  const currentWeek = weekStart(localDateStr());
  const liveWeekNumber = deployedProgram ? deployedProgram.start_week + getProgramCurrentWeekIndex(deployedProgram) - 1 : null;

  function renderDays(days: ProgramDay[]) {
    return days.map((day) => {
      const assignments = getAssignmentsForDay(day.id);
      // Marked rest is the coach saying so; an empty day reads the same way
      // visually but still invites the first exercise.
      const markedRest = day.is_rest === true && assignments.length === 0;
      const isRest = assignments.length === 0;
      const formId = `add-exercise-${day.id}`;
      const setsLoggedThisWeek = assignments.reduce((sum, a) => {
        const wg = getLogsForAssignmentByWeek(a.id).find((g) => g.weekStart === currentWeek);
        return sum + (wg ? wg.logs.length : 0);
      }, 0);
      const summary = markedRest
        ? "Rest day"
        : assignments.length === 0
        ? "Nothing yet — add the first exercise"
        : `${assignments.length} exercise${assignments.length === 1 ? "" : "s"}`;

      return (
        <AdminDayCard
          key={day.id}
          dayName={DAY_NAMES_FULL[day.day_of_week - 1]}
          labelSlot={
            <DayLabelForm
              programDayId={day.id}
              defaultLabel={day.label ?? ""}
              placeholder={markedRest ? "Rest" : "Day label (e.g. Push A)"}
            />
          }
          restSlot={
            <DayRestToggle programDayId={day.id} isRest={markedRest} hasExercises={assignments.length > 0} />
          }
          statusPill={
            setsLoggedThisWeek > 0 ? (
              <span className="pb-logged-pill">
                {setsLoggedThisWeek} set{setsLoggedThisWeek === 1 ? "" : "s"} logged
              </span>
            ) : undefined
          }
          summary={summary}
          isRest={isRest}
          defaultOpen={!isRest}
        >
          <div className="exercise-table-wrap">
            <table className="exercise-table">
              <thead>
                <tr>
                  <th>Exercise</th>
                  {columns.map((col) => (
                    <th key={col.id} style={{ width: COLUMN_WIDTH[col.key] ?? "90px" }}>
                      {col.label}
                    </th>
                  ))}
                  <th className="logged-col">What the client did</th>
                  {/* Holds the row delete on an exercise row and the Add button on the
                      add row, so it needs to fit the wider of the two. */}
                  <th aria-hidden="true" style={{ width: "58px" }}></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const weekGroups = getLogsForAssignmentByWeek(a.id);
                  // Two independent facts about this exercise, both shown when
                  // there's history for them: how the client is trending on it
                  // overall, and what last week actually asked for versus what
                  // they did. Neither depends on whether this day is published.
                  const prevRef = getPreviousWeekAssignmentRef(clientId, day.week_number, day.day_of_week, a.exercise_id);
                  const weightTrendPct = getExerciseWeightTrendPct(clientId, a.exercise_id, day.week_number);
                  const trendDir = weightTrendPct == null ? null : weightTrendPct > 0 ? "up" : weightTrendPct < 0 ? "down" : null;

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
                  const loggedRows: LoggedWeekRow[] = [];
                  if (prevRef) {
                    loggedRows.push({
                      weekLabel: `W${day.week_number - 1}`,
                      targetWeightKg: prevRef.target_weight_kg,
                      sets: prevRef.actualLogs.map((l) => ({
                        setNumber: l.set_number,
                        weightKg: l.weight_kg,
                        reps: l.reps,
                        rpe: l.rpe_actual,
                      })),
                      current: false,
                    });
                  }
                  loggedRows.push({
                    weekLabel: `W${day.week_number}`,
                    targetWeightKg: a.target_weight_kg,
                    sets: thisWeekSets,
                    current: true,
                  });

                  return (
                    <tr key={a.id}>
                      <td className="exercise-name-cell">
                        {/* Trend hard left, name, demo hard right — the two
                            marginal facts sit at the edges so the eye runs
                            down a clean column of exercise names between
                            them. */}
                        <div className="pb-exercise-title">
                          {weightTrendPct != null && trendDir && (
                            <span className={`pb-trend ${trendDir}`}>
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
                            return (
                              <td key={col.id}>
                                <AssignmentFieldInput
                                  assignmentId={a.id}
                                  name="targetWeight"
                                  type="number"
                                  step={0.5}
                                  placeholder="kg"
                                  defaultValue={a.target_weight_kg ?? ""}
                                />
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
                                  placeholder="RPE"
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
                                  placeholder="e.g. 3-1-1"
                                  defaultValue={a.tempo ?? ""}
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
                      <td className="logged-col">
                        <LoggedSetsGrid rows={loggedRows} />
                      </td>
                      <td>
                        <ConfirmDeleteButton
                          action={removeExerciseAction}
                          hiddenFields={{ assignmentId: a.id }}
                          label={`Delete ${a.exercise_name}`}
                        />
                      </td>
                    </tr>
                  );
                })}

                <tr className="add-exercise-row">
                  <td>
                    <ExercisePicker formId={formId} groups={MUSCLE_GROUPS} exercisesByGroup={exercisesByGroup} />
                  </td>
                  {columns.map((col) => {
                    if (col.kind === "custom") {
                      return <td key={col.id} aria-hidden="true"></td>;
                    }
                    switch (col.key) {
                      case "sets":
                        return (
                          <td key={col.id}>
                            <input name="sets" form={formId} type="number" min={1} defaultValue={3} />
                          </td>
                        );
                      case "reps":
                        return (
                          <td key={col.id}>
                            <input name="reps" form={formId} type="text" defaultValue="8-10" />
                          </td>
                        );
                      case "weight_goal":
                        return (
                          <td key={col.id}>
                            <input name="targetWeight" form={formId} type="number" step="0.5" placeholder="kg" />
                          </td>
                        );
                      case "rpe":
                        return (
                          <td key={col.id}>
                            <input name="rpe" form={formId} type="number" step="0.5" placeholder="RPE" />
                          </td>
                        );
                      case "tempo":
                        return (
                          <td key={col.id}>
                            <input name="tempo" form={formId} type="text" placeholder="e.g. 3-1-1" />
                          </td>
                        );
                      case "notes":
                        return (
                          <td key={col.id}>
                            <input name="notes" form={formId} type="text" placeholder="optional" />
                          </td>
                        );
                      default:
                        return <td key={col.id} aria-hidden="true"></td>;
                    }
                  })}
                  <td aria-hidden="true"></td>
                  <td>
                    <button className="pb-add-btn" type="submit" form={formId}>
                      Add
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <form id={formId} action={addExerciseAction} style={{ display: "none" }}>
            <input type="hidden" name="programDayId" value={day.id} />
          </form>
        </AdminDayCard>
      );
    });
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
          {renderDays(days)}
        </div>
      );
      weekSummaries[index] = trainingDays
        ? `${trainingDays} training day${trainingDays === 1 ? "" : "s"}${setsLogged ? ` · ${setsLogged} sets logged` : ""}`
        : `${programWeekLabel(program, weekNumber)} is empty — pick a day and add the first exercise`;

      // Seven ticks in weekday order reporting what the client actually did:
      // trained, planned-but-missed, or rest. Planned-vs-actual is the whole
      // point of the rail — a skipped session must not look like a rest day.
      const railDays = Array.from({ length: 7 }, (_, di) => {
        const dow = di + 1;
        const day = days.find((d) => d.day_of_week === dow);
        const assignments = day ? getAssignmentsForDay(day.id) : [];
        const name = DAY_NAMES_FULL[di];
        if (assignments.length === 0) {
          return { dayOfWeek: dow, state: "rest" as const, title: `${name} — rest day` };
        }
        const logged = assignments.some((a) => getLogsForAssignment(a.id).length > 0);
        return logged
          ? { dayOfWeek: dow, state: "trained" as const, title: `${name} — trained` }
          : { dayOfWeek: dow, state: "missed" as const, title: `${name} — planned, nothing logged` };
      });
      const trainedDays = railDays.filter((d) => d.state === "trained").length;
      const isFuture = liveWeekNumber != null && weekNumber > liveWeekNumber;

      weekCards.push({
        week: index,
        label: programWeekLabel(program, weekNumber),
        days: railDays,
        isLive: liveWeekNumber === weekNumber,
        // A future week has nothing to report, so it states the plan rather
        // than claiming zero days trained.
        meta: isFuture
          ? `${trainingDays} planned`
          : `${trainedDays} day${trainedDays === 1 ? "" : "s"} trained`,
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

    // Programs carry no created_at, so the meta line says when it went live
    // rather than inventing a creation date; a draft simply doesn't have one
    // yet.
    const deployedOn = program.deployed_at ? fmtDay(program.deployed_at.slice(0, 10)) : null;
    return {
      id: program.id,
      name: program.name ?? "",
      status,
      statusLabel: status === "live" ? "Live" : status === "draft" ? "Draft" : "Past",
      totalWeeks: program.total_weeks,
      meta: `${program.total_weeks} week${program.total_weeks === 1 ? "" : "s"}${
        deployedOn ? ` · deployed ${deployedOn}` : " · not deployed yet"
      }`,
      defaultWeek: status === "live" ? getProgramCurrentWeekIndex(program) : 1,
      weekCards,
      copyFromWeek,
      weekContents,
      weekSummaries,
      copySlots,
      nameSlot: (
        <div key={`n${program.id}`} className="pb-name-slot">
          <ProgramNameForm programId={program.id} defaultName={program.name ?? ""} placeholder="Program name" />
          {/* No "N weeks" field. A programme's length is however many weeks
              are on the rail, and having two places to say it meant the number
              and the rail could disagree — "+ Add week" is the one way to make
              the programme longer. */}
          {status === "draft" && <AutosaveNote renderedAt={renderedAt} />}
        </div>
      ),
      actionsSlot:
        status === "draft" ? (
          <div key={`a${program.id}`} className="pb-deploy-row">
            <span className="pb-deploy-note">Nothing sent to {(clientName ?? "").split(" ")[0] || "the client"} yet</span>
            <ProgramDeployControls programId={program.id} scheduledAt={program.scheduled_at} />
            <ConfirmDeleteButton
              action={removeProgramAction}
              hiddenFields={{ programId: program.id, weekLinkBase }}
              label={`Delete draft ${program.name || "program"}`}
            />
          </div>
        ) : status === "live" ? (
          <div key={`a${program.id}`} className="pb-live-row">
            <span className="pb-live-dot" aria-hidden="true" />
            <span className="pb-live-text">Live — {clientName || "the client"} can see this now</span>
          </div>
        ) : (
          <span key={`a${program.id}`} className="pb-live-text past">Past program — read only for the client</span>
        ),
    };
  }

  const programs: BuilderProgram[] = [
    ...(deployedProgram ? [buildProgram(deployedProgram, "live")] : []),
    ...(draftProgram ? [buildProgram(draftProgram, "draft")] : []),
    ...pastPrograms.map((p) => buildProgram(p, "past")),
  ];

  return (
    <div className="pb">
      <ProgramBuilderShell
        programs={programs}
        clientId={clientId}
        columnsSlot={<ColumnChipRow key="cols" clientId={clientId} choices={columnChoices} max={MAX_TRAINING_COLUMNS} />}
        newProgramSlot={
          draftProgram ? null : (
            <form key="new-program" action={createProgramAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="weekLinkBase" value={weekLinkBase} />
              <button className="pb-new-program" type="submit">
                + New program
              </button>
            </form>
          )
        }
        emptySlot={<p key="empty" className="empty-note">No programs yet — start one and build the first week.</p>}
      />

    </div>
  );
}
