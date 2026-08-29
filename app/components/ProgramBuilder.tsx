import Link from "next/link";
import { ReactNode } from "react";
import { addExerciseAction, createProgramAction, removeExerciseAction } from "../lib/actions";
import {
  getAssignmentsForDay,
  getCompletedDaysForClient,
  getCustomValues,
  getDeployedProgram,
  getDraftProgram,
  getExerciseStrengthSeries,
  getExerciseWeightTrendPct,
  getLogsForAssignmentByWeek,
  getPreviousWeekAssignmentRef,
  getProgramCurrentWeekIndex,
  getStrengthSeries,
  getWeek,
  listExercisesByGroup,
  listLoggedExercisesForClient,
  listPrograms,
  listTrainingColumns,
  localDateStr,
  MUSCLE_GROUPS,
  programWeekLabel,
  weekStart,
  ProgramDay,
  TrainingProgram,
} from "../lib/queries";
import { DAY_NAMES } from "../lib/db";
import AssignmentFieldInput from "./AssignmentFieldInput";
import DayLabelForm from "./DayLabelForm";
import ExercisePicker from "./ExercisePicker";
import CustomValueInput from "../admin/CustomValueInput";
import ProgramCard from "../admin/ProgramCard";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import AdminDayCard from "./AdminDayCard";
import StrengthProgressPanel from "../admin/StrengthProgressPanel";

function weekLabel(weekStartStr: string, isCurrent: boolean) {
  const d = new Date(weekStartStr + "T00:00:00");
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return isCurrent ? `This week (${formatted})` : formatted;
}

function formatTarget(sets: number, reps: string, targetWeight: number | null, rpe: number | null) {
  const weightPart = targetWeight ? ` @${targetWeight}kg` : "";
  const rpePart = rpe ? ` RPE${rpe}` : "";
  return `${sets}×${reps}${weightPart}${rpePart}`;
}

function formatActualLogs(logs: { weight_kg: number | null; reps: number | null }[]) {
  if (logs.length === 0) return "not logged";
  return logs.map((l) => `${l.weight_kg ?? "–"}kg×${l.reps ?? "–"}`).join(", ");
}

// The 7-day program canvas + performance feed, used by /admin for whichever
// client is currently selected. `week`, if it names a week belonging to an
// older (neither deployed nor draft) program, additionally shows that
// program's card for reference.
export default function ProgramBuilder({
  clientId,
  week,
  weekLinkBase = "/admin",
}: {
  clientId: number;
  week?: number;
  weekLinkBase?: string;
}) {
  const allPrograms = listPrograms(clientId);
  const deployedProgram = getDeployedProgram(clientId);
  const draftProgram = getDraftProgram(clientId);
  const pastPrograms = allPrograms
    .filter((p) => p.status === "deployed" && p.id !== deployedProgram?.id)
    .sort((a, b) => b.start_week - a.start_week);
  const viewingPastProgram =
    week != null ? pastPrograms.find((p) => week >= p.start_week && week < p.start_week + p.total_weeks) ?? null : null;
  const canDeleteDraft = draftProgram !== null;

  // "Week N" always means N's position within ITS program, not the
  // underlying global week_number — see programWeekLabel.
  const programForWeek = (weekNumber: number): TrainingProgram | undefined =>
    allPrograms.find((p) => weekNumber >= p.start_week && weekNumber < p.start_week + p.total_weeks);

  const exercisesByGroup = listExercisesByGroup();
  const allColumns = listTrainingColumns(clientId);
  const columns = allColumns.filter((c) => c.visible);
  const customColumnIds = allColumns.filter((c) => c.kind === "custom").map((c) => c.id);
  const customValues = getCustomValues(customColumnIds);
  const customValueFor = (assignmentId: number, columnId: number) =>
    customValues.find((v) => v.workout_assignment_id === assignmentId && v.column_id === columnId)?.value ?? "";

  const completedDays = getCompletedDaysForClient(clientId, 10);

  const currentWeek = weekStart(localDateStr());

  const strengthOverall = getStrengthSeries(clientId, 3650);
  const loggedExercises = listLoggedExercisesForClient(clientId);
  const strengthByExercise = Object.fromEntries(
    loggedExercises.map((e) => [e.id, getExerciseStrengthSeries(clientId, e.id, 3650)])
  );

  // Renders one week's 7 days as expandable cards — a local function (not a
  // separate component) so it can share every closure above without prop-
  // drilling columns/customValues/exercisesByGroup through for every week of
  // every program rendered on this page.
  function renderDays(days: ProgramDay[]) {
    return days.map((day) => {
      const assignments = getAssignmentsForDay(day.id);
      const isRest = assignments.length === 0;
      const formId = `add-exercise-${day.id}`;
      const setsLoggedThisWeek = assignments.reduce((sum, a) => {
        const wg = getLogsForAssignmentByWeek(a.id).find((g) => g.weekStart === currentWeek);
        return sum + (wg ? wg.logs.length : 0);
      }, 0);
      const summary = isRest
        ? "Rest day"
        : `${assignments.length} exercise${assignments.length === 1 ? "" : "s"}${
            setsLoggedThisWeek > 0 ? ` · ${setsLoggedThisWeek} sets logged` : ""
          }`;
      return (
        <AdminDayCard
          key={day.id}
          dayName={DAY_NAMES[day.day_of_week - 1]}
          labelSlot={
            <DayLabelForm
              programDayId={day.id}
              defaultLabel={day.label ?? ""}
              placeholder={isRest ? "Rest" : "Day label (e.g. Push A)"}
            />
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
                    <th key={col.id}>{col.label}</th>
                  ))}
                  <th className="logged-col">Logged by client</th>
                  <th aria-hidden="true"></th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => {
                  const weekGroups = getLogsForAssignmentByWeek(a.id);
                  const prevRef =
                    day.status === "published"
                      ? null
                      : getPreviousWeekAssignmentRef(clientId, day.week_number, day.day_of_week, a.exercise_id);
                  // Only on published days — this is a "how is the client actually
                  // trending" signal drawn from real logged history, and showing it
                  // next to a draft day's "Actual: not logged" reads as a
                  // contradiction (the badge isn't about this row, it's about the
                  // exercise overall, but sitting there it looks like it is).
                  const weightTrendPct =
                    day.status === "published" ? getExerciseWeightTrendPct(clientId, a.exercise_id, day.week_number) : null;
                  const trendDir = weightTrendPct == null ? null : weightTrendPct > 0 ? "up" : weightTrendPct < 0 ? "down" : null;
                  return (
                    <tr key={a.id}>
                      <td className="exercise-name-cell">
                        {a.exercise_name}
                        {a.exercise_video_url && (
                          <a
                            href={a.exercise_video_url}
                            target="_blank"
                            rel="noreferrer"
                            className="video-link"
                          >
                            ▶ demo
                          </a>
                        )}
                        {weightTrendPct != null && (
                          <div className="exercise-weight-trend">
                            <span className="exercise-meta">Weight trend</span>{" "}
                            <span className={`metric-carousel-trend${trendDir ? ` ${trendDir}` : ""}`}>
                              {trendDir === "up" ? "▲" : trendDir === "down" ? "▼" : "–"} {Math.abs(weightTrendPct).toFixed(1)}%
                            </span>
                          </div>
                        )}
                        {prevRef && (
                          <div className="prev-week-ref" style={{ marginTop: 4 }}>
                            <div className="exercise-meta">
                              <span className="prev-week-ref-label">Last week target</span>{" "}
                              {formatTarget(prevRef.sets, prevRef.reps, prevRef.target_weight_kg, prevRef.rpe_target)}
                            </div>
                            <div className="exercise-meta">
                              <span className="prev-week-ref-label">Actual</span> {formatActualLogs(prevRef.actualLogs)}
                            </div>
                          </div>
                        )}
                      </td>
                      {columns.map((col) => {
                        if (col.kind === "custom") {
                          return (
                            <td key={col.id}>
                              <CustomValueInput
                                assignmentId={a.id}
                                columnId={col.id}
                                value={customValueFor(a.id, col.id)}
                              />
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
                                <AssignmentFieldInput
                                  assignmentId={a.id}
                                  name="notes"
                                  type="text"
                                  placeholder="optional"
                                  defaultValue={a.notes ?? ""}
                                />
                              </td>
                            );
                          default:
                            return <td key={col.id}>–</td>;
                        }
                      })}
                      <td className="logged-col">
                        {weekGroups.length === 0 ? (
                          <span className="exercise-meta">–</span>
                        ) : (
                          <div className="logged-weeks">
                            {weekGroups.map((wg) => (
                              <div key={wg.weekStart} className="logged-week-group">
                                <div className="logged-week-label">
                                  {weekLabel(wg.weekStart, wg.weekStart === currentWeek)}
                                </div>
                                <div className="logged-sets">
                                  {wg.logs.map((l) => (
                                    <span key={l.id} className="set-chip">
                                      <span>#{l.set_number}</span>
                                      <span>
                                        {l.weight_kg ?? "–"}kg × {l.reps ?? "–"}
                                        {l.rpe_actual ? ` @${l.rpe_actual}` : ""}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
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
                    <button className="btn secondary" type="submit" form={formId}>
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

  // Every week of a program, pre-rendered, keyed by its position (1..N)
  // within that program — handed to ProgramWeekSwitcher, which shows one at
  // a time client-side.
  function weekContentsFor(program: TrainingProgram) {
    const contents: Record<number, ReactNode> = {};
    for (let i = 0; i < program.total_weeks; i++) {
      contents[i + 1] = (
        <div key={i + 1} className="program-sheet">
          {renderDays(getWeek(clientId, program.start_week + i))}
        </div>
      );
    }
    return contents;
  }

  return (
    <div>
      <div className="plan-stack">
        {deployedProgram && (
          <ProgramCard
            clientId={clientId}
            program={deployedProgram}
            kind="deployed"
            defaultWeekIndex={getProgramCurrentWeekIndex(deployedProgram)}
            weekContents={weekContentsFor(deployedProgram)}
            columns={allColumns}
            weekLinkBase={weekLinkBase}
          />
        )}

        {draftProgram && (
          <ProgramCard
            clientId={clientId}
            program={draftProgram}
            kind="draft"
            defaultWeekIndex={1}
            weekContents={weekContentsFor(draftProgram)}
            columns={allColumns}
            canDelete={canDeleteDraft}
            weekLinkBase={weekLinkBase}
          />
        )}

        {viewingPastProgram && (
          <ProgramCard
            clientId={clientId}
            program={viewingPastProgram}
            kind="past"
            defaultWeekIndex={1}
            weekContents={weekContentsFor(viewingPastProgram)}
            columns={allColumns}
            weekLinkBase={weekLinkBase}
          />
        )}

        {!draftProgram && (
          <form action={createProgramAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="weekLinkBase" value={weekLinkBase} />
            <button className="btn new-program-btn" type="submit">
              + New program
            </button>
          </form>
        )}
      </div>

      {pastPrograms.length > 0 && (
        <div className="past-weeks-row">
          <span className="past-weeks-label">Past programs:</span>
          {pastPrograms.map((p) => (
            <Link
              key={p.id}
              href={`${weekLinkBase}${weekLinkBase.includes("?") ? "&" : "?"}week=${p.start_week}`}
              scroll={false}
              className={`toggle-btn${p.id === viewingPastProgram?.id ? " active" : ""}`}
            >
              {p.name || `Weeks ${p.start_week}–${p.start_week + p.total_weeks - 1}`}
            </Link>
          ))}
        </div>
      )}

      <StrengthProgressPanel overall={strengthOverall} exercises={loggedExercises} byExercise={strengthByExercise} />

      <div className="nutrition-table-wrap builder-card" style={{ marginTop: 16 }}>
        <h3 className="builder-pill-heading">Completed workouts</h3>
        {completedDays.length === 0 ? (
          <p className="empty-note">
            Nothing completed yet — once the client finishes every set for a day, it shows up here.
          </p>
        ) : (
          <div className="exercise-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Program</th>
                  <th>Day</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {completedDays.map((d) => {
                  const program = programForWeek(d.weekNumber);
                  return (
                    <tr key={d.dayId}>
                      <td>{program ? programWeekLabel(program, d.weekNumber) : `Week ${d.weekNumber}`}</td>
                      <td className="exercise-name-cell">
                        {DAY_NAMES[d.dayOfWeek - 1]}
                        {d.label ? ` — ${d.label}` : ""}
                      </td>
                      <td className="computed-cell">{d.completedAt}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
