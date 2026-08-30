import {
  getAssignmentsForDay,
  getBranding,
  getClient,
  getClientProfile,
  getDeployedProgram,
  getLogsForAssignment,
  getCurrentWeekNumber,
  getDueItems,
  getLatestSentReport,
  getMetricSeries,
  getPinnedMetricsSummary,
  getWeightSeries,
  listPublishedWeekNumbers,
  getNotifications,
  getNutritionGoalsSummary,
  getNutritionPlan,
  getPhotoCadence,
  getPhotoPeriodNote,
  getPublishedWeek,
  getTimeToGoal,
  listChatMessages,
  listClientGoals,
  listMeetings,
  listMetricDefinitions,
  listMetricPeriods,
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
  weekStart,
} from "../lib/queries";
import { DAY_NAMES } from "../lib/db";
import SetLogForm from "./SetLogForm";
import TrainingDayCard from "./TrainingDayCard";
import PhotoUploadBox from "./PhotoUploadBox";
import PhotoPeriodHistoryRow from "./PhotoPeriodHistoryRow";
import CheckInForm from "./CheckInForm";
import TrackerLogForm from "./TrackerLogForm";
import HomeHub, { DueItem, HomeReport, HubSubTab, UpcomingMeeting } from "./HomeHub";
import { TrendMetric } from "./TrendCarousel";
import ClientWeekSwitcher from "./ClientWeekSwitcher";
import ChatComposeForm from "../components/ChatComposeForm";
import AppShell, { AppTab } from "./AppShell";
import { AppleIcon, CalendarIcon, ChatIcon, ClockIcon, DumbbellIcon, GearIcon, HomeIcon, ReportIcon } from "../components/icons";
import { markAllNotificationsReadAction, markNotificationReadAction } from "../lib/actions";

// Reads live from the JSON store on every request — without this, Next
// statically prerenders this page at build time (before any real data
// exists) and freezes that empty snapshot in the deployed build forever.
export const dynamic = "force-dynamic";

const PERIOD_UNIT = {
  weekly: "Week",
  biweekly: "Check-in",
  monthly: "Month",
} as const;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CLIENT_ID = 3;

function getWeekDays(week?: number) {
  // Auto-advances the moment a week the coach has already deployed starts —
  // see getCurrentWeekNumber's doc comment in lib/queries.ts. Callers that
  // want a specific week (the Training tab's week switcher) pass one in.
  const targetWeek = week ?? getCurrentWeekNumber(CLIENT_ID);
  const publishedDays = getPublishedWeek(CLIENT_ID, targetWeek);
  return publishedDays.map((day) => ({ day, assignments: getAssignmentsForDay(day.id) }));
}

function HomeTab() {
  const client = getClient(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);
  const timeToGoal = getTimeToGoal(profile);
  const goals = [...listClientGoals(CLIENT_ID, "short"), ...listClientGoals(CLIENT_ID, "long")]
    .filter((g) => !g.done)
    .map((g) => g.text);

  const days = getWeekDays();
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
  const volumePrevWeek = volumeOf(getWeekDays(currentWeekNumber - 1));
  const volumeTrendPct = volumePrevWeek > 0 ? ((volumeThisWeek - volumePrevWeek) / volumePrevWeek) * 100 : null;
  const volumeTrendLabel = volumeTrendPct == null ? null : `${volumeTrendPct >= 0 ? "+" : ""}${Math.round(volumeTrendPct)}% vol`;

  const today = localDateStr();
  const currentWeekStart = weekStart(today);

  const upcomingMeeting = listMeetings(CLIENT_ID)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  const upcoming: UpcomingMeeting = upcomingMeeting
    ? {
        dayLabel: DAY_LABELS[new Date(`${upcomingMeeting.date}T00:00:00`).getDay()],
        dateLabel: String(new Date(`${upcomingMeeting.date}T00:00:00`).getDate()),
        topic: upcomingMeeting.topic || "Check-in call",
        timeLabel: upcomingMeeting.time
          ? `${upcomingMeeting.time} · ${upcomingMeeting.duration_minutes}min`
          : `${upcomingMeeting.duration_minutes}min`,
        daysAwayLabel: (() => {
          const days = Math.round(
            (new Date(`${upcomingMeeting.date}T00:00:00`).getTime() - new Date(`${today}T00:00:00`).getTime()) / 86400000
          );
          return days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days away`;
        })(),
      }
    : null;

  // ---- "Today" due items (was the Check-ins tab; folded into Home) ----
  // Computation itself lives in getDueItems() in lib/queries.ts, shared with
  // applyDueClientReminders() so the notification feed's reminders and this
  // list never disagree on what's due. dailyDefs/weeklyDefs/*LoggedToday are
  // still needed here directly for the Tracker sub-tab below.
  const dailyDefs = listMetricDefinitions(CLIENT_ID, "daily");
  const weeklyDefs = listMetricDefinitions(CLIENT_ID, "weekly");
  const dailyLoggedToday = listMetricPeriods(dailyDefs.map((d) => d.id), 1)[0] === today;
  const weeklyLoggedThisWeek = listMetricPeriods(weeklyDefs.map((d) => d.id), 1)[0] === currentWeekStart;

  const dueItems: DueItem[] = getDueItems(CLIENT_ID);

  // ---- Coach notes: coach chat messages, same feed the Notifications
  // screen shows (kind "coach_note"), filtered down to just those so Home
  // reads as "what has my coach said about my work", not a full inbox —
  // the chat itself lives solely behind the header's chat icon now. ----
  const coachNotes = getNotifications(CLIENT_ID)
    .filter((n) => n.kind === "coach_note")
    .slice(0, 5)
    .map((n) => ({
      id: n.id,
      context: "Coach note",
      timeLabel: notificationTimeLabel(n.created_at),
      text: n.message,
      unread: !n.read,
    }));

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

  const trendMetrics: TrendMetric[] = [
    trendMetric("weight", "Weight", "kg", getWeightSeries(CLIENT_ID, 3650), true),
    ...getPinnedMetricsSummary(CLIENT_ID).map(({ def }) => trendMetric(`metric-${def.id}`, def.name, def.unit, getMetricSeries(def.id))),
  ].filter((m): m is TrendMetric => m !== null);

  // ---- Progress report card: collapsed headline until "Read report", plus
  // up to 3 stat deltas and one trend chart pulled from whichever sections
  // the report actually has (no domain knowledge of which are "good" for a
  // coach-defined metric, so deltas render neutral rather than guessing). ----
  const sentReport = getLatestSentReport(CLIENT_ID);
  const fmtShortDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  let report: HomeReport | null = null;
  if (sentReport) {
    type Section = { label: string; series?: { date: string; value: number }[]; seriesByField?: Record<string, { unit: string; points: { date: string; value: number }[] }> };
    const sections: Section[] = (() => {
      try {
        return JSON.parse(sentReport.sections_snapshot);
      } catch {
        return [];
      }
    })();
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
    const chartSection = sections.find((s) => s.series && s.series.length >= 2);
    const summary = sentReport.summary || "";
    const firstSentence = summary.match(/^.*?[.!?](?=\s|$)/)?.[0];
    report = {
      id: sentReport.id,
      periodLabel: `${fmtShortDate(sentReport.period_start)} – ${fmtShortDate(sentReport.period_end)}`,
      headline: firstSentence || summary,
      body: summary,
      stats,
      chart: chartSection
        ? {
            points: chartSection.series!,
            fromLabel: fmtShortDate(chartSection.series![0].date),
            toLabel: fmtShortDate(chartSection.series![chartSection.series!.length - 1].date),
            caption: chartSection.label,
          }
        : null,
      archived: sentReport.archived_at != null,
    };
  }

  const tabs: HubSubTab[] = [
    {
      id: "tracker",
      label: "Tracker",
      content: (
        <div>
          <TrackerLogForm clientId={CLIENT_ID} frequency="daily" loggedForPeriod={dailyLoggedToday} />
          <TrackerLogForm clientId={CLIENT_ID} frequency="weekly" loggedForPeriod={weeklyLoggedThisWeek} />
          {dailyDefs.length === 0 && weeklyDefs.length === 0 && (
            <p className="empty-note">Your coach hasn&rsquo;t set up any tracker metrics yet.</p>
          )}
        </div>
      ),
    },
    {
      id: "measurements",
      label: "Measurements",
      content: <CheckInForm clientId={CLIENT_ID} />,
    },
    {
      id: "photos",
      label: "Photos",
      content: <ProgressTab />,
    },
  ];

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
      goalNote={timeToGoal ? `${timeToGoal} to your goal date` : null}
      daysTrained={daysTrained}
      totalDays={totalDaysBuilt}
      setsThisWeek={setsThisWeek}
      setsPlanned={setsPlannedThisWeek}
      volumeTrendLabel={volumeTrendLabel}
      trendMetrics={trendMetrics}
      goals={goals}
      upcoming={upcoming}
      coachNotes={coachNotes}
      dueItems={dueItems}
      report={report}
      tabs={tabs}
    />
  );
}

function TrainingTab({ week }: { week: number }) {
  const days = getWeekDays(week);
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
                name={DAY_NAMES[day.day_of_week - 1]}
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
                        </div>
                        {a.exercise_video_url && (
                          <a href={a.exercise_video_url} target="_blank" rel="noreferrer" className="video-link">
                            ▶ how to
                          </a>
                        )}
                        {a.notes && <p className="exercise-coach-note">“{a.notes}”</p>}

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

function NutritionTab() {
  const summary = getNutritionGoalsSummary(CLIENT_ID);
  const plan = getNutritionPlan(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);

  const today = localDateStr();
  const dow = (() => {
    const jsDay = new Date(`${today}T00:00:00`).getDay();
    return jsDay === 0 ? 7 : jsDay;
  })();
  const todayDay = getWeekDays().find((d) => d.day.day_of_week === dow);
  const isTrainingDay = !!todayDay && todayDay.assignments.length > 0;

  const kcal = isTrainingDay ? summary.trainingKcal : summary.restKcal;
  const protein = isTrainingDay ? summary.trainingProtein : summary.restProtein;
  const carbs = isTrainingDay ? summary.trainingCarbs : summary.restCarbs;
  const fats = isTrainingDay ? summary.trainingFats : summary.restFats;
  const hasTargets = kcal > 0;

  const supplementRows = SUPPLEMENT_ITEMS.map((item) => ({ item, entry: plan.supplements[slugify(item)] })).filter(
    (r) => r.entry?.quantity
  );
  const vitaminRows = VITAMIN_ITEMS.map((item) => ({ item, entry: plan.vitamins[slugify(item)] })).filter(
    (r) => r.entry?.quantity
  );

  return (
    <div>
      <p className="app-lead">
        {isTrainingDay ? "Today's a training day — here are your targets." : "Today's a rest day — here are your targets."}
      </p>

      {!hasTargets ? (
        <p className="empty-note">Your coach hasn&rsquo;t set up nutrition targets yet.</p>
      ) : (
        <div className="nutrition-target-card">
          <div className="nutrition-target-kcal">{kcal} kcal</div>
          <div className="nutrition-target-grid">
            <div>
              <div className="nutrition-target-label">Protein</div>
              <div className="nutrition-target-value">{protein}g</div>
            </div>
            <div>
              <div className="nutrition-target-label">Carbs</div>
              <div className="nutrition-target-value">{carbs}g</div>
            </div>
            <div>
              <div className="nutrition-target-label">Fat</div>
              <div className="nutrition-target-value">{fats}g</div>
            </div>
          </div>
          {profile.water_goal && <div className="nutrition-target-water">Water: {profile.water_goal}</div>}
        </div>
      )}

      {plan.coach_notes && (
        <div className="empty-note" style={{ marginTop: 14 }}>
          &ldquo;{plan.coach_notes}&rdquo;
        </div>
      )}

      <p className="empty-note" style={{ marginTop: 18 }}>
        Logging your own meals/macros is coming soon — for now this shows the targets your coach set.
      </p>

      {(supplementRows.length > 0 || vitaminRows.length > 0) && (
        <>
          <h3 style={{ margin: "18px 0 10px" }}>Supplements & vitamins</h3>
          {supplementRows.length > 0 && (
            <div className="supplement-list" style={{ marginBottom: 10 }}>
              {supplementRows.map(({ item, entry }) => (
                <div key={item} className="supplement-row">
                  <div className="supplement-row-name">{item}</div>
                  <div className="supplement-row-detail">
                    {entry!.quantity}
                    {entry!.timing ? ` · ${entry!.timing}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
          {vitaminRows.length > 0 && (
            <div className="supplement-list">
              {vitaminRows.map(({ item, entry }) => (
                <div key={item} className="supplement-row">
                  <div className="supplement-row-name">{item}</div>
                  <div className="supplement-row-detail">
                    {entry!.quantity}
                    {entry!.timing ? ` · ${entry!.timing}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SettingsTab() {
  const client = getClient(CLIENT_ID);
  const profile = getClientProfile(CLIENT_ID);

  return (
    <div>
      <div className="settings-profile-row">
        <div className="settings-avatar">{(client?.name ?? "?").charAt(0)}</div>
        <div>
          <div className="settings-profile-name">{client?.name}</div>
          <div className="settings-profile-sub">
            {profile.coaching_start_date ? `Coaching since ${profile.coaching_start_date}` : "Profile"}
          </div>
        </div>
      </div>

      <h3 style={{ margin: "20px 0 10px" }}>Account</h3>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Notifications</div>
            <div className="settings-row-sub">Reminders and coach messages</div>
          </div>
          <span className="settings-toggle settings-toggle-on" aria-hidden="true">
            <span className="settings-toggle-knob" />
          </span>
        </div>
        <div className="settings-row">
          <div className="settings-row-title">Units</div>
          <span className="settings-row-value">kg, cm ›</span>
        </div>
        <div className="settings-row">
          <div className="settings-row-title">Privacy & data</div>
          <span className="settings-row-value">›</span>
        </div>
      </div>

      <h3 style={{ margin: "20px 0 10px" }}>Connected apps</h3>
      <div className="settings-group">
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Apple Health</div>
            <div className="settings-row-sub">Auto-log steps, weight & workouts</div>
          </div>
          <span className="settings-row-value">Connect</span>
        </div>
        <div className="settings-row">
          <div>
            <div className="settings-row-title">Google Fit / Health Connect</div>
            <div className="settings-row-sub">Auto-log steps, weight & workouts</div>
          </div>
          <span className="settings-row-value">Connect</span>
        </div>
      </div>
      <p className="empty-note" style={{ marginTop: 8 }}>Requires the Ironline mobile app — not available on web.</p>

      <button type="button" className="settings-logout-btn">
        Log out
      </button>
    </div>
  );
}

// Chat sub-view of the Chat and Notifications screen — day-grouped bubble
// thread (coach messages left, client's own right) with a "next call" strip
// and the shared compose form. Read-only scheduling: the call itself is set
// on the coach's side (Meetings tab).
function ChatThread() {
  const messages = listChatMessages(CLIENT_ID);
  const today = localDateStr();

  const upcomingMeeting = listMeetings(CLIENT_ID)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  const nextCallLabel = upcomingMeeting
    ? `${new Date(`${upcomingMeeting.date}T00:00:00`).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}${upcomingMeeting.time ? ` · ${upcomingMeeting.time}` : ""}`
    : null;

  const dayLabel = (iso: string) => {
    const d = new Date(iso);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric",
    });
  };
  const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  let lastDay: string | null = null;

  return (
    <div className="cn-chat">
      {nextCallLabel && (
        <div className="cn-callbar">
          <span className="cn-callbar-label">Next call</span>
          <span className="cn-callbar-value">{nextCallLabel}</span>
        </div>
      )}
      <div className="cn-thread">
        {messages.length === 0 ? (
          <p className="cn-empty">No messages yet — say hello below.</p>
        ) : (
          messages.map((m) => {
            const day = dayLabel(m.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            const mine = m.sender === "client";
            return (
              <div key={m.id}>
                {showDay && <div className="cn-daylabel">{day}</div>}
                <div className={`cn-row ${mine ? "mine" : "theirs"}`}>
                  <div className="cn-bubble">
                    {m.media_path && m.media_type === "image" && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.media_path} alt="" className="cn-bubble-img" />
                    )}
                    {m.media_path && m.media_type === "video" && (
                      <video src={m.media_path} controls className="cn-bubble-video" />
                    )}
                    {m.text && <div className="cn-bubble-text">{m.text}</div>}
                    <div className="cn-bubble-time">{timeLabel(m.created_at)}</div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
      <div className="cn-compose">
        <ChatComposeForm clientId={CLIENT_ID} sender="client" />
      </div>
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

// Notifications sub-view — grouped Today/Earlier, each row a self-submitting
// form (mark-read on tap, same auto-submit pattern used elsewhere in this
// app, e.g. PhotoUploadBox) rather than client-side state.
function NotificationsPanel() {
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
                <form key={n.id} action={markNotificationReadAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button type="submit" className="cn-notif-row">
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
                  </button>
                </form>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="cn-footnote">Turn individual alerts on or off in Settings → Preferences.</div>
    </div>
  );
}

function ProgressTab() {
  const photoSlots = listPhotoSlots(CLIENT_ID);
  const photoUploads = listPhotoUploads(photoSlots.map((s) => s.id));
  const cadence = getPhotoCadence(CLIENT_ID);
  const currentPeriod = photoPeriodFor(localDateStr(), cadence);
  const photoFor = (slotId: number) =>
    photoUploads.find((u) => u.slot_id === slotId && u.period === currentPeriod)?.file_path ?? null;

  const pastPeriods = listPhotoPeriods(photoSlots.map((s) => s.id)).filter((p) => p !== currentPeriod);
  const periodIndex = photoPeriodIndex(photoSlots.map((s) => s.id));

  return (
    <div>
      <p className="app-lead">
        Tap a box to shoot or upload a photo — your coach sees it right away.
      </p>
      {photoSlots.length === 0 ? (
        <p className="empty-note">Your coach hasn&rsquo;t set up any photo slots yet.</p>
      ) : (
        <div className="photo-slot-grid">
          {photoSlots.map((slot) => (
            <PhotoUploadBox
              key={slot.id}
              clientId={CLIENT_ID}
              slotId={slot.id}
              label={slot.label}
              currentSrc={photoFor(slot.id)}
            />
          ))}
        </div>
      )}

      {pastPeriods.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <h3 style={{ margin: "0 0 10px" }}>History</h3>
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
      )}
    </div>
  );
}

export default function ClientPage() {
  const client = getClient(CLIENT_ID);
  const messages = listChatMessages(CLIENT_ID);
  const hasCoachUpdate = [...messages].reverse().find((m) => m.sender === "coach") != null;
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
  const trainingWeekContents = Object.fromEntries(trainingWeeks.map((w) => [w, <TrainingTab key={w} week={w} />]));

  const tabs: AppTab[] = [
    { id: "home", label: "Home", icon: <HomeIcon />, content: <HomeTab /> },
    {
      id: "training",
      label: "Training",
      icon: <DumbbellIcon />,
      content: (
        <ClientWeekSwitcher
          weeks={trainingWeeks}
          currentWeek={currentWeekNum}
          contents={trainingWeekContents}
          weekLabels={trainingWeekLabels}
        />
      ),
    },
    { id: "nutrition", label: "Nutrition", icon: <AppleIcon />, content: <NutritionTab /> },
    { id: "settings", label: "Settings", icon: <GearIcon />, content: <SettingsTab /> },
  ];

  return (
    <AppShell
      clientName={client?.name ?? ""}
      tabs={tabs}
      chatContent={<ChatThread />}
      notificationsContent={<NotificationsPanel />}
      hasCoachUpdate={hasCoachUpdate}
      hasUnreadNotifications={hasUnreadNotifications}
      logoUrl={getBranding().logo_path}
    />
  );
}
