import { redirect } from "next/navigation";
import { getSessionUser } from "../lib/auth";
import { logoutAction } from "../lib/auth-actions";
import {
  getAssignmentsForDay,
  getClient,
  getClientProfile,
  getDeployedProgram,
  getLogsForAssignment,
  getCurrentWeekNumber,
  getCheckInSections,
  getCheckInStatus,
  getClientPreferences,
  getGraphedSeries,
  listClientReports,
  listPublishedWeekNumbers,
  getNotifications,
  getNutritionGoalsSummary,
  getNutritionPlan,
  getPhotoCadence,
  getPhotoPeriodNote,
  getPublishedWeek,
  listClients,
  listClientGoals,
  listMeetings,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  localDateStr,
  photoPeriodFor,
  photoPeriodIndex,
  programWeekLabel,
  slugify,
  SUPPLEMENT_ITEMS,
  VITAMIN_ITEMS,
} from "../lib/queries";
import { DAY_NAMES_FULL } from "../lib/db";
import SetLogForm from "./SetLogForm";
import TrainingDayCard from "./TrainingDayCard";
import ExerciseCoachNote from "./ExerciseCoachNote";
import PhotoPeriodHistoryRow from "./PhotoPeriodHistoryRow";
import HomeHub, { UpcomingMeeting } from "./HomeHub";
import { TrendMetric } from "./TrendCarousel";
import NutritionDayToggle, { NutritionTargetSet } from "./NutritionDayToggle";
import ReportArchiveList, { ArchiveReport } from "./ReportArchiveList";
import NotificationRow from "./NotificationRow";
import ClientWeekSwitcher from "./ClientWeekSwitcher";
import AppShell, { AppTab } from "./AppShell";
import {
  AccountIcon,
  AppleIcon,
  ArrowRightIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  DumbbellIcon,
  HomeIcon,
  ReportIcon,
} from "../components/icons";
import {
  markAllNotificationsReadAction,
  setClientPreferenceAction,
  setClientUnitsAction,
} from "../lib/actions";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

const PERIOD_UNIT = {
  weekly: "Week",
  biweekly: "Check-in",
  monthly: "Month",
} as const;

// A note with no kind set still needs a header — "Note" is the honest
// fallback rather than guessing which of the three it is.
// Which way weight should be moving for this athlete. Hardcoding "down is
// better" told a client on a lean bulk they were going the wrong way, in
// warning colour, on their own Home screen.
//
// This is a heuristic over the coach's free-text phase because that's the
// only place the intent is recorded today — there's no structured "direction"
// field. It errs toward "down is better", which matches most coaching
// phases; if it guesses wrong the only cost is the colour of one percentage.
// Worth replacing with a real field on the profile when one exists.
function weightGoalIsDown(goalPhase: string | null | undefined): boolean {
  const phase = (goalPhase ?? "").toLowerCase();
  const gaining = ["bulk", "gain", "mass", "build", "bulking", "surplus"];
  return !gaining.some((word) => phase.includes(word));
}

function noteDateLabel(at: string | null): string {
  if (!at) return "";
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Which client the app is showing. There's no login yet, so the admin's
// "View client app" link carries ?client=<id> and this falls back to the
// first client on the books — that fallback is why building a program for
// one client and opening the app showed another's.
// Which client this app is showing is now decided ONLY by the signed session
// cookie. It used to come from ?client=<id>, which meant any logged-in person
// could read another client's entire app by editing the URL. A coach can
// still preview a specific client via ?client=, because requireClientAccess
// grants coaches access to anyone; for a client the parameter is ignored.
async function resolveClientId(raw: string | undefined): Promise<number | null> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.must_change_password) redirect("/login/change-password");

  // A coach may preview any client's app, so ?client= still works for them.
  if (user.role === "coach") {
    const asked = raw ? Number(raw) : null;
    return asked && getClient(asked) ? asked : listClients()[0]?.id ?? null;
  }

  // A client gets their own id and nothing else — the parameter is ignored.
  if (user.client_id == null) redirect("/login");
  return user.client_id;
}

const fmtShortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// Settings' progress-report list is the only place reports appear — a sent
// report's sections_snapshot parsed, plus up to 3 stat deltas derived from
// whichever sections it actually has. No domain knowledge of which
// direction is "good" for a coach-defined metric, so deltas render neutral
// rather than guessing.
type ReportSection = {
  label: string;
  series?: { date: string; value: number }[];
  seriesByField?: Record<string, { unit: string; points: { date: string; value: number }[] }>;
};

function parseReportSections(snapshot: string): ReportSection[] {
  try {
    return JSON.parse(snapshot);
  } catch {
    return [];
  }
}

function deriveReportStats(sections: ReportSection[]): { label: string; value: string }[] {
  const stats: { label: string; value: string }[] = [];
  for (const s of sections) {
    if (stats.length >= 3) break;
    if (s.series && s.series.length >= 2) {
      const delta = s.series[s.series.length - 1].value - s.series[0].value;
      stats.push({ label: s.label, value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` });
    } else if (s.seriesByField) {
      for (const [field, { points, unit }] of Object.entries(s.seriesByField)) {
        if (stats.length >= 3 || points.length < 2) continue;
        const delta = points[points.length - 1].value - points[0].value;
        stats.push({ label: field, value: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}${unit ? ` ${unit}` : ""}` });
      }
    }
  }
  return stats;
}

function getWeekDays(CLIENT_ID: number, week?: number) {
  // Auto-advances the moment a week the coach has already deployed starts —
  // see getCurrentWeekNumber's doc comment in lib/queries.ts. Callers that
  // want a specific week (the Training tab's week switcher) pass one in.
  const targetWeek = week ?? getCurrentWeekNumber(CLIENT_ID);
  const publishedDays = getPublishedWeek(CLIENT_ID, targetWeek);
  return publishedDays.map((day) => ({ day, assignments: getAssignmentsForDay(day.id) }));
}

function HomeTab({ CLIENT_ID }: { CLIENT_ID: number }) {
  const client = getClient(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);
  // Home's header keeps the goal countdown to whole weeks ("11 weeks to
  // goal") so it reads as one line next to the phase/week label instead of
  // wrapping — getTimeToGoal's day-precision string (e.g. "11 weeks 5d") is
  // still what the coach sees in admin's Start Page, unchanged.
  const goalNote = (() => {
    if (!profile.goal_date) return null;
    const days = Math.round(
      (new Date(`${profile.goal_date}T00:00:00`).getTime() - new Date(`${localDateStr()}T00:00:00`).getTime()) / 86400000
    );
    if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
    if (days === 0) return "Goal date is today";
    if (days < 7) return `${days} day${days === 1 ? "" : "s"} to goal`;
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} to goal`;
  })();
  const goals = [...listClientGoals(CLIENT_ID, "short"), ...listClientGoals(CLIENT_ID, "long")]
    .filter((g) => !g.done)
    .map((g) => g.text);

  const days = getWeekDays(CLIENT_ID);
  const daysTrained = days.filter((d) => d.assignments.some((a) => getLogsForAssignment(a.id).length > 0)).length;
  const totalDaysBuilt = days.filter((d) => d.assignments.length > 0).length;
  const setsThisWeek = days.reduce(
    (sum, d) => sum + d.assignments.reduce((s, a) => s + getLogsForAssignment(a.id).length, 0),
    0
  );
  const setsPlannedThisWeek = days.reduce((sum, d) => sum + d.assignments.reduce((s, a) => s + a.sets, 0), 0);

  // Week-over-week volume trend for the "Sets logged" stat — same
  // weight*reps volume measure the report/admin panels already use.
  const volumeOf = (weekDays: ReturnType<typeof getWeekDays>) =>
    weekDays.reduce(
      (sum, d) =>
        sum +
        d.assignments.reduce(
          (s, a) => s + getLogsForAssignment(a.id).reduce((v, l) => v + (l.weight_kg ?? 0) * (l.reps ?? 0), 0),
          0
        ),
      0
    );
  const currentWeekNumber = getCurrentWeekNumber(CLIENT_ID);
  const volumeThisWeek = volumeOf(days);
  const volumePrevWeek = volumeOf(getWeekDays(CLIENT_ID, currentWeekNumber - 1));
  const volumeTrendPct = volumePrevWeek > 0 ? ((volumeThisWeek - volumePrevWeek) / volumePrevWeek) * 100 : null;
  const volumeTrendLabel = volumeTrendPct == null ? null : `${volumeTrendPct >= 0 ? "+" : ""}${Math.round(volumeTrendPct)}% vol`;

  const today = localDateStr();

  const upcomingMeeting = listMeetings(CLIENT_ID)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  const upcoming: UpcomingMeeting = (() => {
    if (!upcomingMeeting) return null;
    const when = new Date(`${upcomingMeeting.date}T00:00:00`);
    const days = Math.round((when.getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000);
    return {
      monthCap: when.toLocaleDateString("en-US", { month: "short" }),
      dayNumber: String(when.getDate()),
      topic: upcomingMeeting.topic || "Check-in call",
      inLabel: days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`,
      whenLabel: `${DAY_LABELS[when.getDay()]}${upcomingMeeting.time ? ` ${upcomingMeeting.time}` : ""}`,
      durationLabel: `${upcomingMeeting.duration_minutes} min`,
    };
  })();

  // ---- "Today" due items (was the Check-ins tab; folded into Home) ----
  // Computation itself lives in getDueItems() in lib/queries.ts, shared with
  // applyDueClientReminders() so the notification feed's reminders and this
  // list never disagree on what's due. dailyDefs/weeklyDefs/*LoggedToday are
  // still needed here directly for the Tracker sub-tab below.
  const checkInStatus = getCheckInStatus(CLIENT_ID);

  const coachNotes = coachNotesFor(CLIENT_ID, 5);

  // One swipeable carousel of trend panels: Weight plus whatever the coach
  // has pinned (that pin toggle lives in the admin Tracker tabs only — "any
  // metric the coach wants" graphed is just "any metric they've pinned").
  // Each entry needs >=2 points to plot a shape and compute a trend, so
  // anything thinner than that is left out rather than shown as an empty
  // slide. goodDown says which direction of change is the good one — known
  // for weight (down is good); left undefined for coach-pinned metrics
  // since there's no way to know that generically, and guessing would risk
  // coloring a genuinely good change red.
  const trendMetric = (
    id: string,
    name: string,
    unit: string,
    series: { date: string; value: number }[],
    goodDown?: boolean
  ): TrendMetric | null => {
    if (series.length < 2) return null;
    const fmt = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toFixed(1));
    const average = series.reduce((sum, p) => sum + p.value, 0) / series.length;
    const first = series[0].value;
    const last = series[series.length - 1].value;
    const pct = first !== 0 ? ((last - first) / first) * 100 : null;
    const improving = pct == null || goodDown == null ? null : goodDown ? pct < 0 : pct > 0;
    const weeksSpan = Math.max(
      1,
      Math.round(
        (new Date(series[series.length - 1].date).getTime() - new Date(series[0].date).getTime()) / (7 * 86400000)
      )
    );
    return {
      id,
      name,
      points: series,
      currentValueLabel: fmt(last),
      unitLabel: unit,
      trendLabel: pct == null ? "" : `${pct > 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`,
      trendGood: improving ?? true,
      rangeLabel: `${fmt(first)}${unit} → ${fmt(last)}${unit} · ${weeksSpan} week${weeksSpan === 1 ? "" : "s"}`,
      avgLabel: `avg ${fmt(average)}${unit ? ` ${unit}` : ""}`,
    };
  };

  // The coach chooses which figures are graphed (up to six, from the
  // Measurements tab in the admin); getGraphedSeries falls back to Weight
  // when nothing has been chosen. Direction-of-good is only known for
  // weight, read from the goal phase.
  const trendMetrics: TrendMetric[] = getGraphedSeries(CLIENT_ID)
    .map((g) =>
      trendMetric(
        g.key,
        g.name,
        g.unit,
        g.series,
        g.name.toLowerCase().includes("weight") ? weightGoalIsDown(profile?.goal_phase) : undefined
      )
    )
    .filter((m): m is TrendMetric => m !== null);

  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <HomeHub
      dateLabel={dateLabel}
      name={client?.name ?? ""}
      subLine={`${profile.goal_phase || "No goal phase set yet"}${profile.current_week ? ` · ${profile.current_week}` : ""}`}
      goalNote={goalNote}
      daysTrained={daysTrained}
      totalDays={totalDaysBuilt}
      setsThisWeek={setsThisWeek}
      setsPlanned={setsPlannedThisWeek}
      volumeTrendLabel={volumeTrendLabel}
      trendMetrics={trendMetrics}
      goals={goals}
      upcoming={upcoming}
      coachNotes={coachNotes}
      checkInStatus={checkInStatus}
    />
  );
}

function TrainingTab({ CLIENT_ID, week }: { CLIENT_ID: number; week: number }) {
  const days = getWeekDays(CLIENT_ID, week);
  const trainingDays = days.filter((d) => d.assignments.length > 0);
  const daysFullyDone = trainingDays.filter((d) =>
    d.assignments.every((a) => getLogsForAssignment(a.id).length >= a.sets)
  ).length;
  const weekPct = trainingDays.length > 0 ? Math.round((daysFullyDone / trainingDays.length) * 100) : 0;

  return (
    <div>
      <p className="app-lead">
        Your coach&rsquo;s deployed week. Log your sets below — your trainer sees this the moment
        you save it, no extra step.
      </p>

      {trainingDays.length > 0 && (
        <div className="week-progress-card">
          <div>
            <div className="week-progress-label">This week</div>
            <div className="week-progress-value">
              {daysFullyDone} of {trainingDays.length} days trained
            </div>
          </div>
          <div
            className="week-progress-ring"
            style={{ background: `conic-gradient(var(--accent) 0deg ${weekPct * 3.6}deg, var(--paper-raised) ${weekPct * 3.6}deg 360deg)` }}
          >
            <div className="week-progress-ring-inner">{weekPct}%</div>
          </div>
        </div>
      )}

      {days.length === 0 ? (
        <p className="empty-note">Nothing deployed yet — your coach is still building this week.</p>
      ) : trainingDays.length === 0 ? (
        <p className="empty-note">
          Your coach published this week, but hasn&rsquo;t added any exercises yet — it&rsquo;s all
          rest days for now.
        </p>
      ) : (
        (() => {
          // Auto-open the first day that isn't fully logged yet, so the
          // client lands on today's (or the next outstanding) workout
          // instead of a wall of collapsed containers.
          const firstOpenIndex = trainingDays.findIndex(
            ({ assignments }) => !assignments.every((a) => getLogsForAssignment(a.id).length >= a.sets)
          );
          return trainingDays.map(({ day, assignments }, i) => {
            const doneCount = assignments.filter((a) => getLogsForAssignment(a.id).length >= a.sets).length;
            return (
              <TrainingDayCard
                key={day.id}
                name={DAY_NAMES_FULL[day.day_of_week - 1]}
                label={day.label}
                doneCount={doneCount}
                totalCount={assignments.length}
                defaultOpen={i === (firstOpenIndex === -1 ? 0 : firstOpenIndex)}
              >
                <div className="training-exercise-table">
                  {assignments.map((a) => {
                    const logs = getLogsForAssignment(a.id);
                    const nextSetNumber = logs.length + 1;
                    const doneAllSets = nextSetNumber > a.sets;
                    return (
                      <div key={a.id} className="training-exercise-row">
                        <div className="training-exercise-row-top">
                          <strong>{a.exercise_name}</strong>
                          <span className="training-exercise-target">
                            {a.sets} set{a.sets === 1 ? "" : "s"}
                          </span>
                          {/* Only exercises the coach actually wrote a note on
                              render the button — an empty bubble on every row
                              would be noise. */}
                          {a.notes && (
                            <ExerciseCoachNote
                              assignmentId={a.id}
                              dateLabel={noteDateLabel(a.note_at)}
                              text={a.notes}
                              unread={!a.note_read}
                            />
                          )}
                        </div>
                        {/* The coach's demo for this prescription wins; the
                            exercise library's own video is the fallback. */}
                        {(a.demo_url || a.exercise_video_url) && (
                          <a
                            href={a.demo_url ?? a.exercise_video_url ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="video-link"
                          >
                            ▶ how to
                          </a>
                        )}

                        {/* Coach's target laid out as the first row of the same
                            table the client logs into below, instead of a
                            separate row of badges — so "what to aim for" and
                            "what I actually did" line up column-by-column.
                            Tempo only gets its own column when the coach set
                            one; the wrap scrolls horizontally rather than
                            squeezing columns if it (or future metrics) don't
                            fit the phone width. */}
                        <div className="training-set-table-wrap">
                          <table className="training-set-table">
                            <thead>
                              <tr>
                                <th>Set</th>
                                <th>Weight</th>
                                <th>Reps</th>
                                <th>RPE</th>
                                {a.tempo && <th>Tempo</th>}
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="training-goal-row">
                                <td className="training-set-cell-num">Goal</td>
                                <td>{a.target_weight_kg != null ? `${a.target_weight_kg}kg` : "—"}</td>
                                <td>{a.reps}</td>
                                <td>{a.rpe_target ?? "—"}</td>
                                {a.tempo && <td>{a.tempo}</td>}
                                <td />
                              </tr>
                              {logs.map((l) => (
                                <tr key={l.id} className="training-set-row">
                                  <td className="training-set-cell-num">{l.set_number}</td>
                                  <td>{l.weight_kg}kg</td>
                                  <td>{l.reps}</td>
                                  <td>{l.rpe_actual ?? "—"}</td>
                                  {a.tempo && <td>—</td>}
                                  <td className="training-set-cell-action">✓</td>
                                </tr>
                              ))}
                              {!doneAllSets && (
                                <SetLogForm
                                  assignmentId={a.id}
                                  nextSetNumber={nextSetNumber}
                                  targetWeight={a.target_weight_kg}
                                  targetReps={a.reps}
                                  targetRpe={a.rpe_target}
                                  showTempoColumn={!!a.tempo}
                                />
                              )}
                            </tbody>
                          </table>
                        </div>
                        {doneAllSets && (
                          <div className="exercise-meta training-exercise-done">✓ All sets logged for today</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </TrainingDayCard>
            );
          });
        })()
      )}
    </div>
  );
}

function NutritionTab({ CLIENT_ID }: { CLIENT_ID: number }) {
  const summary = getNutritionGoalsSummary(CLIENT_ID);
  const plan = getNutritionPlan(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);

  const today = localDateStr();
  const dow = (() => {
    const jsDay = new Date(`${today}T00:00:00`).getDay();
    return jsDay === 0 ? 7 : jsDay;
  })();
  const todayDay = getWeekDays(CLIENT_ID).find((d) => d.day.day_of_week === dow);
  const isTrainingDay = !!todayDay && todayDay.assignments.length > 0;
  const dateLabel = new Date(`${today}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" });

  // Both day types' targets are computed up front (not just today's) so the
  // Training day/Rest day toggle can switch between them client-side with no
  // server round trip — see NutritionDayToggle.
  const macroSet = (kcalTarget: number, protein: number, carbs: number, fats: number, caption: string): NutritionTargetSet => {
    const macroKcal = protein * 4 + carbs * 4 + fats * 9;
    const maxGrams = Math.max(protein, carbs, fats, 1);
    const macro = (id: string, name: string, grams: number, kcalPerGram: number) => ({
      id,
      name,
      grams,
      barPct: Math.round((grams / maxGrams) * 100),
      share: macroKcal > 0 ? `${Math.round(((grams * kcalPerGram) / macroKcal) * 100)}% of kcal` : "—",
    });
    return {
      kcalLabel: kcalTarget.toLocaleString("en-US"),
      caption,
      macros: [macro("protein", "Protein", protein, 4), macro("carbs", "Carbs", carbs, 4), macro("fat", "Fat", fats, 9)],
    };
  };

  const hasTargets = summary.trainingKcal > 0 || summary.restKcal > 0;
  const training = macroSet(
    summary.trainingKcal,
    summary.trainingProtein,
    summary.trainingCarbs,
    summary.trainingFats,
    "Training day targets"
  );
  const rest = macroSet(summary.restKcal, summary.restProtein, summary.restCarbs, summary.restFats, "Rest day targets");

  const supplementRows = SUPPLEMENT_ITEMS.map((item) => ({ item, entry: plan.supplements[slugify(item)] })).filter(
    (r) => r.entry?.quantity
  );
  const vitaminRows = VITAMIN_ITEMS.map((item) => ({ item, entry: plan.vitamins[slugify(item)] })).filter(
    (r) => r.entry?.quantity
  );
  const referenceRows = [...supplementRows, ...vitaminRows];
  const coachNotes = coachNotesFor(CLIENT_ID, 3);

  return (
    <div className="nutrition-dark">
      {!hasTargets ? (
        <p className="empty-note">Your coach hasn&rsquo;t set up nutrition targets yet.</p>
      ) : (
        <NutritionDayToggle dateLabel={dateLabel} training={training} rest={rest} initialIsTraining={isTrainingDay} />
      )}

      {/* The coach's note on the targets (Nutrition tab → "Note on the
          targets"). Distinct from the "Coach notes" feed further down, which
          is per-exercise/check-in commentary; this is the standing guidance
          that goes with the numbers, so it sits right under them. */}
      {plan.coach_notes?.trim() && (
        <section className="home-dark-section">
          <span className="home-dark-section-title">From your coach</span>
          <p className="nd-coach-note">{plan.coach_notes}</p>
        </section>
      )}

      {profile.water_goal && (
        <div className="nd-water-row">
          <span className="nd-water-label">Water goal</span>
          <span className="nd-water-value">{profile.water_goal}</span>
        </div>
      )}

      {referenceRows.length > 0 && (
        <section className="home-dark-section">
          <span className="home-dark-section-title">Supplements</span>
          <div className="home-dark-rows">
            {referenceRows.map(({ item, entry }) => (
              <div key={item} className="nd-supp-row">
                <div className="nd-supp-name">{item}</div>
                <div className="nd-supp-detail">
                  {entry!.quantity}
                  {entry!.timing ? ` · ${entry!.timing}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="home-dark-section">
        <span className="home-dark-section-title">Coach notes</span>
        {coachNotes.length === 0 ? (
          <p className="home-dark-empty">No notes yet.</p>
        ) : (
          <div className="home-dark-rows">
            {coachNotes.map((n) => (
              <div key={n.id} className="home-dark-note-row">
                <span className={`home-dark-note-dot${n.unread ? " unread" : ""}`} aria-hidden="true" />
                <div className="home-dark-row-body">
                  <div className="home-dark-note-top">
                    <span className="home-dark-note-context">{n.context}</span>
                    <span className="home-dark-note-time">{n.timeLabel}</span>
                  </div>
                  <div className="home-dark-note-text">{n.text}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="nd-footnote">Meal logging isn&rsquo;t on yet — your coach sets the targets, you hit them.</div>
    </div>
  );
}

function SettingsTab({ CLIENT_ID }: { CLIENT_ID: number }) {
  const client = getClient(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);
  const prefs = getClientPreferences(CLIENT_ID);

  const weeksInLabel = (() => {
    if (!profile.coaching_start_date) return null;
    const weeks = Math.floor(
      (new Date(`${localDateStr()}T00:00:00`).getTime() - new Date(`${profile.coaching_start_date}T00:00:00`).getTime()) /
        (7 * 86400000)
    );
    return weeks >= 0 ? `${weeks} week${weeks === 1 ? "" : "s"} in` : null;
  })();

  const sentReports = listClientReports(CLIENT_ID).filter((r) => r.status === "sent");
  const reports: ArchiveReport[] = sentReports.map((r) => {
    const sections = parseReportSections(r.sections_snapshot);
    const summary = r.summary || "";
    const firstSentence = summary.match(/^.*?[.!?](?=\s|$)/)?.[0];
    const chartSection = sections.find((s) => s.series && s.series.length >= 2);
    return {
      id: r.id,
      period: `${fmtShortDate(r.period_start)} – ${fmtShortDate(r.period_end)}`,
      summary: firstSentence || summary,
      body: summary,
      isNew: r.opened_at == null,
      stats: deriveReportStats(sections),
      chart: chartSection
        ? {
            points: chartSection.series!,
            fromLabel: fmtShortDate(chartSection.series![0].date),
            toLabel: fmtShortDate(chartSection.series![chartSection.series!.length - 1].date),
            caption: chartSection.label,
          }
        : null,
    };
  });
  // "1 new · 3 saved" while anything is unopened, otherwise just the count.
  const newReportCount = reports.filter((r) => r.isNew).length;
  const reportCountLabel = `${newReportCount > 0 ? `${newReportCount} new · ` : ""}${reports.length} saved`;

  const toggleDefs: { key: "coach_notes" | "checkin_reminders" | "weekly_digest"; label: string; detail: string }[] = [
    { key: "coach_notes", label: "Coach notes", detail: "Log a note when your coach comments on your work" },
    { key: "checkin_reminders", label: "Check-in reminders", detail: "Nudge when a tracker, measurement or photo is due" },
    { key: "weekly_digest", label: "Weekly summary", detail: "Sunday recap of your week (coming soon)" },
  ];

  return (
    <div className="settings-dark">
      <div className="home-dark-datebar">Your account</div>
      <div className="home-dark-name">{client?.name}</div>
      <div className="home-dark-subrow">
        {profile.coaching_start_date && (
          <span className="home-dark-sub">Client since {fmtShortDate(profile.coaching_start_date)}</span>
        )}
        {weeksInLabel && <span className="home-dark-goal">{weeksInLabel}</span>}
      </div>

      <div className="home-dark-hr" />

      <section className="home-dark-section" style={{ paddingTop: 18 }}>
        <div className="home-dark-section-head">
          <span className="home-dark-section-title">Progress reports</span>
          {reports.length > 0 && <span className="home-dark-section-count">{reportCountLabel}</span>}
        </div>
        {reports.length === 0 ? (
          <p className="home-dark-empty">No reports sent yet.</p>
        ) : (
          <ReportArchiveList reports={reports} />
        )}
      </section>

      <section className="home-dark-section">
        <span className="home-dark-section-title">Preferences</span>
        <div className="home-dark-rows">
          {toggleDefs.map((t) => {
            const on = prefs[t.key];
            return (
              <form key={t.key} action={setClientPreferenceAction}>
                <input type="hidden" name="clientId" value={CLIENT_ID} />
                <input type="hidden" name="key" value={t.key} />
                <input type="hidden" name="value" value={(!on).toString()} />
                <button type="submit" className="settings-toggle-row">
                  <div className="home-dark-row-body">
                    <div className="home-dark-row-title">{t.label}</div>
                    <div className="home-dark-row-detail">{t.detail}</div>
                  </div>
                  <span className={`settings-switch${on ? " on" : ""}`} aria-hidden="true">
                    <span className="settings-switch-knob" />
                  </span>
                </button>
              </form>
            );
          })}
          <div className="settings-units-row">
            <div className="home-dark-row-title">Units</div>
            <div className="settings-units-options">
              {(["metric", "imperial"] as const).map((u) => (
                <form key={u} action={setClientUnitsAction}>
                  <input type="hidden" name="clientId" value={CLIENT_ID} />
                  <input type="hidden" name="units" value={u} />
                  <button type="submit" className={`settings-unit-btn${prefs.units === u ? " active" : ""}`}>
                    {u === "metric" ? "kg · cm" : "lb · in"}
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="home-dark-section">
        <span className="home-dark-section-title">Connected apps</span>
        <div className="home-dark-rows">
          <div className="settings-app-row">
            <div className="home-dark-row-body">
              <div className="home-dark-row-title">Apple Health</div>
              <div className="home-dark-row-detail">Auto-log steps, weight & workouts</div>
            </div>
            <span className="settings-app-action">Connect</span>
          </div>
          <div className="settings-app-row">
            <div className="home-dark-row-body">
              <div className="home-dark-row-title">Health Connect</div>
              <div className="home-dark-row-detail">Auto-log steps, weight & workouts</div>
            </div>
            <span className="settings-app-action">Connect</span>
          </div>
        </div>
        <div className="home-dark-empty" style={{ marginTop: 12 }}>
          Health syncing needs the Ironline mobile app — not available on web.
        </div>
      </section>

      <section className="home-dark-section">
        <span className="home-dark-section-title">Data</span>
        <div className="home-dark-rows">
          <div className="settings-data-row">
            <div className="home-dark-row-title">Export my data</div>
            <ArrowRightIcon />
          </div>
          <div className="settings-data-row">
            <div className="home-dark-row-title">Privacy policy</div>
            <ArrowRightIcon />
          </div>
          <div className="settings-data-row warn">
            <div className="home-dark-row-title">Delete account</div>
            <ArrowRightIcon />
          </div>
        </div>
      </section>

      <form action={logoutAction}>
        <button type="submit" className="settings-logout-btn">
          Log out
        </button>
      </form>
      <div className="settings-footnote">Ironline · Full Potential Coaching</div>
    </div>
  );
}


const NOTIFICATION_KIND_LABEL: Record<string, string> = {
  coach_note: "Coach note",
  report: "Progress report",
  programme: "Programme",
  reminder: "Reminder",
  general: "Update",
};

function notificationIcon(kind: string) {
  switch (kind) {
    case "report":
      return <ReportIcon />;
    case "programme":
      return <CalendarIcon />;
    case "reminder":
      return <ClockIcon />;
    default:
      return <ChatIcon />;
  }
}

function notificationTimeLabel(iso: string) {
  const d = new Date(iso);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Coach chat messages, same feed the Notifications screen shows (kind
// "coach_note"), filtered down to just those so a tab reads as "what has my
// coach said about my work" — shared by Home and Nutrition's "Coach notes".
function coachNotesFor(CLIENT_ID: number, limit: number) {
  return getNotifications(CLIENT_ID)
    .filter((n) => n.kind === "coach_note")
    .slice(0, limit)
    .map((n) => ({
      id: n.id,
      context: "Coach note",
      timeLabel: notificationTimeLabel(n.created_at),
      text: n.message,
      unread: !n.read,
    }));
}

// Notifications sub-view — grouped Today/Earlier, each row a self-submitting
// form (mark-read on tap, same auto-submit pattern used elsewhere in this
// app, e.g. PhotoUploadBox) rather than client-side state.
function NotificationsPanel({ CLIENT_ID }: { CLIENT_ID: number }) {
  const notifications = getNotifications(CLIENT_ID);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const todayStr = localDateStr();
  const groups = [
    { label: "Today", items: notifications.filter((n) => n.created_at.slice(0, 10) === todayStr) },
    { label: "Earlier", items: notifications.filter((n) => n.created_at.slice(0, 10) !== todayStr) },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="cn-notifications">
      <div className="cn-notif-header">
        <span className="cn-unread-label">{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}</span>
        <form action={markAllNotificationsReadAction}>
          <input type="hidden" name="clientId" value={CLIENT_ID} />
          <button type="submit" className="cn-markall">
            Mark all read
          </button>
        </form>
      </div>

      {groups.length === 0 ? (
        <p className="cn-empty">No notifications yet.</p>
      ) : (
        groups.map((g) => (
          <section key={g.label} className="cn-notif-group">
            <span className="cn-notif-group-label">{g.label}</span>
            <div className="cn-notif-list">
              {g.items.map((n) => (
                <NotificationRow key={n.id} id={n.id} actionTab={n.action_tab} actionRef={n.action_ref}>
                  <span className={`cn-notif-icon${n.read ? "" : " unread"}`} aria-hidden="true">
                    {notificationIcon(n.kind)}
                  </span>
                  <span className="cn-notif-body">
                    <span className="cn-notif-top">
                      <span className="cn-notif-kind">{NOTIFICATION_KIND_LABEL[n.kind] ?? "Update"}</span>
                      <span className="cn-notif-time">{notificationTimeLabel(n.created_at)}</span>
                    </span>
                    <span className={`cn-notif-text${n.read ? "" : " unread"}`}>{n.message}</span>
                    {n.action_label && <span className="cn-notif-action">{n.action_label} →</span>}
                  </span>
                  {!n.read && <span className="cn-notif-dot" aria-hidden="true" />}
                </NotificationRow>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="cn-footnote">Turn individual alerts on or off in Settings → Preferences.</div>
    </div>
  );
}

// Past photo periods and the coach's written feedback on each. The
// current period's upload slots moved into the Check-in screen's
// measurements section; this is the history that sat below them, kept
// reachable there rather than dropped.
function PhotoHistory({ CLIENT_ID }: { CLIENT_ID: number }) {
  const photoSlots = listPhotoSlots(CLIENT_ID);
  const photoUploads = listPhotoUploads(photoSlots.map((s) => s.id));
  const cadence = getPhotoCadence(CLIENT_ID);
  const currentPeriod = photoPeriodFor(localDateStr(), cadence);

  const pastPeriods = listPhotoPeriods(photoSlots.map((s) => s.id)).filter((p) => p !== currentPeriod);
  const periodIndex = photoPeriodIndex(photoSlots.map((s) => s.id));
  if (pastPeriods.length === 0) return null;

  return (
    <div>
      <div className="ci-section-title" style={{ display: "block", marginBottom: 8 }}>
        Earlier sets
      </div>
      <div className="photo-gallery">
        {pastPeriods.map((period) => {
          const photos = photoSlots.map((slot) => ({
            slotId: slot.id,
            label: slot.label,
            src: photoUploads.find((u) => u.slot_id === slot.id && u.period === period)?.file_path ?? null,
          }));
          const uploadedCount = photos.filter((p) => p.src).length;
          return (
            <PhotoPeriodHistoryRow
              key={period}
              title={`${PERIOD_UNIT[cadence]} ${periodIndex[period] ?? "?"}`}
              subtitle={`${uploadedCount}/${photoSlots.length} photos · ${period}`}
              photos={photos}
              note={getPhotoPeriodNote(CLIENT_ID, period)}
            />
          );
        })}
      </div>
    </div>
  );
}

export default async function ClientPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  const CLIENT_ID = await resolveClientId(params.client);
  if (CLIENT_ID == null) {
    return (
      <div className="phone-frame">
        <div className="app-screen">
          <p className="app-lead" style={{ padding: 24 }}>
            No clients yet — add one in the admin panel first.
          </p>
        </div>
      </div>
    );
  }
  const client = getClient(CLIENT_ID);
  // The Check-in screen's three sections, the measurement deltas and this
  // period's photo slots. Built here rather than in HomeTab because the
  // screen is a full-screen push view owned by AppShell.
  const checkInData = getCheckInSections(CLIENT_ID);
  // Same source Home reads, so the tab dots and Home's count can't disagree.
  const checkInStatusForScreen = getCheckInStatus(CLIENT_ID);
  // Most recent coach note, shown at the foot of the check-in the same way
  // Home surfaces them — reusing the notification feed, not a new store.
  const latestCoachNote = coachNotesFor(CLIENT_ID, 1)[0] ?? null;
  const checkIn = {
    dateLabel: new Date(`${localDateStr()}T00:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    today: localDateStr(),
    sections: checkInData.sections,
    phaseLabel: checkInData.phaseLabel,
    deltas: checkInData.deltas,
    photoSlots: checkInData.photoSlots,
    photoPeriodLabel: checkInData.photoPeriodLabel,
    photosDue: checkInData.photosDue,
    photosNextLabel: checkInData.photosNextLabel,
    dueSections: checkInStatusForScreen.dueTypes as string[],
    coachNote: latestCoachNote
      ? { timeLabel: latestCoachNote.timeLabel, text: latestCoachNote.text }
      : null,
    photoHistory: <PhotoHistory CLIENT_ID={CLIENT_ID} />,
  };
  const hasUnreadNotifications = getNotifications(CLIENT_ID).some((n) => !n.read);

  const currentWeekNum = getCurrentWeekNumber(CLIENT_ID);
  // Only the currently deployed program's own weeks — not every published
  // week_number ever (a superseded program's weeks would otherwise mix in
  // and, worse, collide on the same "Week 1" label as the current one; see
  // programWeekLabel in lib/queries.ts).
  const deployedProgram = getDeployedProgram(CLIENT_ID);
  const trainingWeeks = deployedProgram
    ? Array.from({ length: deployedProgram.total_weeks }, (_, i) => deployedProgram.start_week + i)
    : listPublishedWeekNumbers(CLIENT_ID).length > 0
    ? listPublishedWeekNumbers(CLIENT_ID)
    : [currentWeekNum];
  const trainingWeekLabels = deployedProgram
    ? Object.fromEntries(trainingWeeks.map((w) => [w, programWeekLabel(deployedProgram, w)]))
    : undefined;
  const trainingWeekContents = Object.fromEntries(trainingWeeks.map((w) => [w, <TrainingTab key={w} CLIENT_ID={CLIENT_ID} week={w} />]));

  const tabs: AppTab[] = [
    { id: "home", label: "Home", icon: <HomeIcon />, content: <HomeTab CLIENT_ID={CLIENT_ID} /> },
    {
      id: "training",
      label: "Training",
      icon: <DumbbellIcon />,
      content: (
        <div className="training-dark">
          <ClientWeekSwitcher
            weeks={trainingWeeks}
            currentWeek={currentWeekNum}
            contents={trainingWeekContents}
            weekLabels={trainingWeekLabels}
          />
        </div>
      ),
    },
    { id: "nutrition", label: "Nutrition", icon: <AppleIcon />, content: <NutritionTab CLIENT_ID={CLIENT_ID} /> },
    { id: "settings", label: "Settings", icon: <AccountIcon />, content: <SettingsTab CLIENT_ID={CLIENT_ID} /> },
  ];

  return (
    <AppShell
      clientName={client?.name ?? ""}
      tabs={tabs}
      notificationsContent={<NotificationsPanel CLIENT_ID={CLIENT_ID} />}
      hasUnreadNotifications={hasUnreadNotifications}
      clientId={CLIENT_ID}
      checkIn={checkIn}
    />
  );
}
