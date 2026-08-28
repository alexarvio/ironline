import Link from "next/link";
import { addExerciseAction, addWeekSheetAction, publishWeekAction, removeExerciseAction } from "../lib/actions";
import {
  getAssignmentsForDay,
  getCurrentWeekNumber,
  getCustomValues,
  getExerciseStrengthSeries,
  getLogsForAssignmentByWeek,
  getPreviousWeekAssignmentRef,
  getRecentLogsForClient,
  getStrengthSeries,
  getWeek,
  ensureWeekSkeleton,
  listExercisesByGroup,
  listLoggedExercisesForClient,
  listTrainingColumns,
  listWeekNumbers,
  localDateStr,
  MUSCLE_GROUPS,
  weekStart,
} from "../lib/queries";
import { DAY_NAMES } from "../lib/db";
import AssignmentFieldInput from "./AssignmentFieldInput";
import DayLabelForm from "./DayLabelForm";
import ExercisePicker from "./ExercisePicker";
import CustomValueInput from "../admin/CustomValueInput";
import TrainingColumnsPanel from "../admin/TrainingColumnsPanel";
import ConfirmDeleteButton from "./ConfirmDeleteButton";
import AdminDayCard from "./AdminDayCard";
import StrengthProgressPanel from "../admin/StrengthProgressPanel";
import WeekActionsMenu from "./WeekActionsMenu";

function weekLabel(weekStartStr: string, isCurrent: boolean) {
  const d = new Date(weekStartStr + "T00:00:00");
  const formatted = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return isCurrent ? `This week (${formatted})` : formatted;
}

function weekHref(base: string, week: number) {
  return `${base}${base.includes("?") ? "&" : "?"}week=${week}`;
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

// The 7-day program canvas + "what's logged" feed, used by /admin for
// whichever client is currently selected. `week` and `weekLinkBase` are
// optional so callers can omit them: without them this defaults to
// whichever week getCurrentWeekNumber computes, same as the old hardcoded
// WEEK=1 did for a client with only one week ever built.
export default function ProgramBuilder({
  clientId,
  week,
  weekLinkBase = "/admin",
}: {
  clientId: number;
  week?: number;
  weekLinkBase?: string;
}) {
  const computedCurrentWeek = getCurrentWeekNumber(clientId);
  const activeWeek = week ?? computedCurrentWeek;
  ensureWeekSkeleton(clientId, activeWeek);
  const days = getWeek(clientId, activeWeek);
  const existingWeeks = [...new Set([...listWeekNumbers(clientId), activeWeek])].sort((a, b) => a - b);
  const latestWeek = Math.max(...existingWeeks);
  const exercisesByGroup = listExercisesByGroup();
  const allColumns = listTrainingColumns(clientId);
  const columns = allColumns.filter((c) => c.visible);
  const customColumnIds = allColumns.filter((c) => c.kind === "custom").map((c) => c.id);
  const customValues = getCustomValues(customColumnIds);
  const customValueFor = (assignmentId: number, columnId: number) =>
    customValues.find((v) => v.workout_assignment_id === assignmentId && v.column_id === columnId)?.value ?? "";

  const recentLogs = getRecentLogsForClient(clientId, 10) as Array<{
    id: number;
    exercise_name: string;
    weight_kg: number | null;
    reps: number | null;
    rpe_actual: number | null;
    day_of_week: number;
    logged_at: string;
  }>;

  const allPublished = days.every((d) => d.status === "published");
  const allDraft = days.every((d) => d.status === "draft");
  const anyBuilt = days.some((d) => getAssignmentsForDay(d.id).length > 0);
  // Only offer deletion for the latest week while it's still untouched by a
  // deploy, and only when there's another week to fall back to — matches
  // the guard in removeWeekAction so the button never looks clickable when
  // the action would silently no-op.
  const canDeleteActiveWeek = existingWeeks.length > 1 && activeWeek === latestWeek && allDraft;
  const currentWeek = weekStart(localDateStr());

  const strengthOverall = getStrengthSeries(clientId, 3650);
  const loggedExercises = listLoggedExercisesForClient(clientId);
  const strengthByExercise = Object.fromEntries(
    loggedExercises.map((e) => [e.id, getExerciseStrengthSeries(clientId, e.id, 3650)])
  );

  return (
    <div>
      <div className="week-switcher-row">
        <div className="week-switcher">
          {existingWeeks.map((w) => (
            <Link
              key={w}
              href={weekHref(weekLinkBase, w)}
              scroll={false}
              className={`toggle-btn${w === activeWeek ? " active" : ""}`}
            >
              Week {w}
              {w === computedCurrentWeek && <span className="week-current-dot" aria-hidden="true" />}
            </Link>
          ))}
        </div>
        <WeekActionsMenu
          clientId={clientId}
          latestWeek={latestWeek}
          activeWeek={activeWeek}
          canDeleteActiveWeek={canDeleteActiveWeek}
        />
      </div>

      <TrainingColumnsPanel clientId={clientId} columns={allColumns} />

      <div className="program-sheet">
        {days.map((day) => {
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
              statusPill={<span className={`status-pill ${day.status}`}>{day.status}</span>}
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
                      <th>Logged by client</th>
                      <th aria-hidden="true"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((a) => {
                      const weekGroups = getLogsForAssignmentByWeek(a.id);
                      const prevRef =
                        day.status === "published"
                          ? null
                          : getPreviousWeekAssignmentRef(clientId, activeWeek, day.day_of_week, a.exercise_id);
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
                          <td>
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
        })}
      </div>

      <div className="publish-bar">
        <div>
          <strong>Status: </strong>
          {allPublished ? (
            <span className="status-pill published">published</span>
          ) : (
            <span className="status-pill draft">draft</span>
          )}
          <div className="exercise-meta" style={{ marginTop: 4 }}>
            {allPublished
              ? "The client can see this week right now."
              : anyBuilt
              ? "Client can't see this yet — deploy to make it live."
              : "Add at least one exercise, then deploy."}
          </div>
        </div>
        <form action={publishWeekAction} style={{ marginLeft: "auto" }}>
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="week" value={activeWeek} />
          <button className="deploy-btn" type="submit">
            Deploy week {activeWeek} to client
          </button>
        </form>
      </div>

      <div className="nutrition-table-wrap builder-card" style={{ marginTop: 16 }}>
        <h3 className="builder-pill-heading">Start something new</h3>
        <p className="empty-note" style={{ marginBottom: 12 }}>
          Not a continuation of week {latestWeek} — a fresh, empty week {latestWeek + 1} the client won&rsquo;t see
          until you build it out and deploy it.
        </p>
        <form action={addWeekSheetAction}>
          <input type="hidden" name="clientId" value={clientId} />
          <button className="btn secondary" type="submit">
            + Blank week {latestWeek + 1}
          </button>
        </form>
      </div>

      <StrengthProgressPanel overall={strengthOverall} exercises={loggedExercises} byExercise={strengthByExercise} />

      <h3 style={{ marginTop: 24 }}>What this client has logged</h3>
      {recentLogs.length === 0 ? (
        <p className="empty-note">
          Nothing logged yet — once the client logs a set, it shows up here
          automatically, no refresh step.
        </p>
      ) : (
        <div className="log-list">
          {recentLogs.map((log) => (
            <div key={log.id} className="log-item">
              <span>
                {DAY_NAMES[log.day_of_week - 1]} · {log.exercise_name} —{" "}
                {log.weight_kg ?? "–"}kg × {log.reps ?? "–"}
                {log.rpe_actual ? ` @ RPE ${log.rpe_actual}` : ""}
              </span>
              <span className="when">{log.logged_at}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
