import {
  getAssignmentsForDay,
  getClient,
  getClientProfile,
  getLatestWeight,
  getLogsForAssignment,
  getCurrentWeekNumber,
  getLatestCoachActivity,
  getLatestSentReport,
  getPinnedMetricsSummary,
  listWeekNumbers,
  getMeasurementValues,
  getNutritionGoalsSummary,
  getNutritionPlan,
  getPhotoCadence,
  getPhotoPeriodNote,
  getPublishedWeek,
  getTimeToGoal,
  listChatMessages,
  listClientGoals,
  listMeasurementDates,
  listMeasurementFields,
  listMeetings,
  listMetricDefinitions,
  listMetricPeriods,
  listPhotoPeriods,
  listPhotoSlots,
  listPhotoUploads,
  localDateStr,
  photoPeriodFor,
  photoPeriodIndex,
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
import HomeHub, { CoachActivityPreview, DueItem, HubSubTab, MessagePreview, UpcomingMeeting } from "./HomeHub";
import ClientWeekSwitcher from "./ClientWeekSwitcher";
import ChatPanel from "../components/ChatPanel";
import AppShell, { AppTab } from "./AppShell";
import { AppleIcon, DumbbellIcon, GearIcon, HomeIcon } from "../components/icons";

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

const CLIENT_ID = 1;

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
  const weight = getLatestWeight(CLIENT_ID);
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
      }
    : null;

  // ---- "Today" due items (was the Check-ins tab; folded into Home) ----
  const dailyDefs = listMetricDefinitions(CLIENT_ID, "daily");
  const weeklyDefs = listMetricDefinitions(CLIENT_ID, "weekly");
  const dailyLoggedToday = listMetricPeriods(dailyDefs.map((d) => d.id), 1)[0] === today;
  const weeklyLoggedThisWeek = listMetricPeriods(weeklyDefs.map((d) => d.id), 1)[0] === currentWeekStart;

  const measurementFields = listMeasurementFields(CLIENT_ID);
  const measurementLoggedToday = listMeasurementDates(CLIENT_ID).includes(today);

  const photoSlots = listPhotoSlots(CLIENT_ID);
  const cadence = getPhotoCadence(CLIENT_ID);
  const currentPeriod = photoPeriodFor(today, cadence);
  const photoUploads = listPhotoUploads(photoSlots.map((s) => s.id));
  const uploadedThisPeriod = photoUploads.filter((u) => u.period === currentPeriod).length;

  const dueItems: DueItem[] = [];
  if (dailyDefs.length > 0 && !dailyLoggedToday) {
    dueItems.push({
      id: "daily",
      label: "Daily check-in",
      detail: `${dailyDefs.length} metric${dailyDefs.length === 1 ? "" : "s"} to log for today`,
      targetTab: "tracker",
    });
  }
  if (weeklyDefs.length > 0 && !weeklyLoggedThisWeek) {
    dueItems.push({
      id: "weekly",
      label: "Weekly check-in",
      detail: `${weeklyDefs.length} metric${weeklyDefs.length === 1 ? "" : "s"} to log for this week`,
      targetTab: "tracker",
    });
  }
  if (measurementFields.length > 0 && !measurementLoggedToday) {
    dueItems.push({
      id: "measurements",
      label: "Check-in measurements",
      detail: `Log ${measurementFields.map((f) => f.name).join(", ")}`,
      targetTab: "measurements",
    });
  }
  if (photoSlots.length > 0 && uploadedThisPeriod < photoSlots.length) {
    dueItems.push({
      id: "photos",
      label: "Progress pictures",
      detail: `${uploadedThisPeriod}/${photoSlots.length} uploaded for this ${PERIOD_UNIT[cadence].toLowerCase()}`,
      targetTab: "photos",
    });
  }

  // ---- Weight trend: most recent logged value vs. the one before it ----
  let weightTrendLabel: string | null = null;
  const weightField = measurementFields.find((f) => f.name.toLowerCase().includes("weight"));
  if (weightField) {
    const values = getMeasurementValues([weightField.id])
      .filter((v) => v.value != null)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
    if (values.length >= 2) {
      const latest = values[values.length - 1];
      const prior = values[values.length - 2];
      const delta = Math.round(((latest.value ?? 0) - (prior.value ?? 0)) * 10) / 10;
      weightTrendLabel = `${delta > 0 ? "+" : ""}${delta}kg`;
    }
  }

  // ---- Recent conversation, previewed on Home as a small feed (not just
  // the single latest coach message — the last few messages either way, so
  // it reads like an activity feed rather than a one-off notification) ----
  const messages = listChatMessages(CLIENT_ID);
  const messageTimeLabel = (createdAt: string) => {
    const d = new Date(createdAt);
    const sameDay = d.toDateString() === new Date().toDateString();
    const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    return sameDay ? `Today, ${time}` : `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
  };
  const recentMessages: MessagePreview[] = [...messages]
    .slice(-3)
    .reverse()
    .map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text || (m.media_type === "video" ? "Sent a video" : m.media_type === "image" ? "Sent a photo" : ""),
      timeLabel: messageTimeLabel(m.created_at),
    }));

  // ---- Last coach-side change worth flagging (nutrition update, training
  // published, meeting scheduled, ...) — always shows a container, empty
  // state when nothing's happened yet ----
  const latestActivity = getLatestCoachActivity(CLIENT_ID);
  const lastCoachActivity: CoachActivityPreview = latestActivity
    ? { message: latestActivity.message, timeLabel: messageTimeLabel(latestActivity.created_at) }
    : null;

  // Coach-controlled — the client only ever sees these, never edits which
  // metrics are pinned (that toggle lives in the admin Tracker tabs only).
  const pinnedMetrics = getPinnedMetricsSummary(CLIENT_ID).map(({ def, latest, average }) => ({
    id: def.id,
    name: def.name,
    unit: def.unit,
    latest,
    average,
  }));

  const sentReport = getLatestSentReport(CLIENT_ID);
  const latestReport = sentReport
    ? { periodStart: sentReport.period_start, periodEnd: sentReport.period_end, summary: sentReport.summary }
    : null;

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
      weightLabel={weight != null ? `${weight} kg current weight` : null}
      daysTrained={daysTrained}
      totalDays={totalDaysBuilt}
      setsThisWeek={setsThisWeek}
      weightTrendLabel={weightTrendLabel}
      goals={goals}
      upcoming={upcoming}
      lastCoachActivity={lastCoachActivity}
      recentMessages={recentMessages}
      dueItems={dueItems}
      pinnedMetrics={pinnedMetrics}
      latestReport={latestReport}
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
                        </div>
                        {a.exercise_video_url && (
                          <a href={a.exercise_video_url} target="_blank" rel="noreferrer" className="video-link">
                            ▶ how to
                          </a>
                        )}

                        {/* The coach's target for this exercise — sets/reps always
                            shown, weight/RPE/tempo only when the coach set them.
                            This is the whole point of the request: the client
                            should see exactly what to aim for without hunting
                            through the admin panel's mental model. */}
                        <div className="exercise-target-badges">
                          <span className="target-badge target-badge-primary">
                            {a.sets} × {a.reps}
                          </span>
                          {a.target_weight_kg != null && (
                            <span className="target-badge">{a.target_weight_kg}kg</span>
                          )}
                          {a.rpe_target != null && <span className="target-badge">RPE {a.rpe_target}</span>}
                          {a.tempo && <span className="target-badge">Tempo {a.tempo}</span>}
                        </div>
                        {a.notes && <p className="exercise-coach-note">“{a.notes}”</p>}

                        <table className="training-set-table">
                          <thead>
                            <tr>
                              <th>Set</th>
                              <th>Weight</th>
                              <th>Reps</th>
                              <th>RPE</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {logs.map((l) => (
                              <tr key={l.id} className="training-set-row">
                                <td className="training-set-cell-num">{l.set_number}</td>
                                <td>{l.weight_kg}kg</td>
                                <td>{l.reps}</td>
                                <td>{l.rpe_actual ?? "—"}</td>
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
                              />
                            )}
                          </tbody>
                        </table>
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

function ChatTab() {
  const messages = listChatMessages(CLIENT_ID);
  return <ChatPanel clientId={CLIENT_ID} viewer="client" messages={messages} />;
}

// Read-only — scheduling itself happens on the coach's side (Meetings tab).
// A plain function (not a component) so a "no upcoming call" result is a
// real `null` the caller can branch on, rather than an always-truthy JSX
// element whose own render happens to return nothing.
function nextCallBanner() {
  const today = localDateStr();
  const upcomingMeeting = listMeetings(CLIENT_ID)
    .filter((m) => m.status === "scheduled" && m.date >= today)
    .sort((a, b) => (a.date === b.date ? (a.time < b.time ? -1 : 1) : a.date < b.date ? -1 : 1))[0];
  if (!upcomingMeeting) return null;
  const d = new Date(`${upcomingMeeting.date}T00:00:00`);
  const dateLabel = d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeLabel = upcomingMeeting.time ? ` at ${upcomingMeeting.time}` : "";
  return (
    <>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="app-chat-banner-icon">
        <rect x="2.5" y="4" width="15" height="14" rx="1.8" stroke="currentColor" strokeWidth="1.3" />
        <path d="M2.5 8h15M6.5 2v3M13.5 2v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <span>
        Next call: <strong>{dateLabel}{timeLabel}</strong> — set by your coach
      </span>
    </>
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

  const currentWeekNum = getCurrentWeekNumber(CLIENT_ID);
  const weekNumbers = listWeekNumbers(CLIENT_ID);
  const trainingWeeks = weekNumbers.length > 0 ? weekNumbers : [currentWeekNum];
  const trainingWeekContents = Object.fromEntries(trainingWeeks.map((w) => [w, <TrainingTab key={w} week={w} />]));

  const tabs: AppTab[] = [
    { id: "home", label: "Home", icon: <HomeIcon />, content: <HomeTab /> },
    {
      id: "training",
      label: "Training",
      icon: <DumbbellIcon />,
      content: (
        <ClientWeekSwitcher weeks={trainingWeeks} currentWeek={currentWeekNum} contents={trainingWeekContents} />
      ),
    },
    { id: "nutrition", label: "Nutrition", icon: <AppleIcon />, content: <NutritionTab /> },
    { id: "settings", label: "Settings", icon: <GearIcon />, content: <SettingsTab /> },
  ];

  return (
    <AppShell
      clientName={client?.name ?? ""}
      tabs={tabs}
      chatContent={<ChatTab />}
      chatBanner={nextCallBanner()}
      hasCoachUpdate={hasCoachUpdate}
    />
  );
}
