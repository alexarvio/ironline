import {
  addClientGoalAction,
  removeClientGoalAction,
  saveClientProfileAction,
  toggleClientGoalAction,
} from "../lib/actions";
import {
  CHECK_IN_DAYS,
  ClientGoal,
  ClientSnapshot,
  getClientProfile,
  getClientSnapshot,
  getLatestWeight,
  getNutritionGoalsSummary,
  getPinnedMetricsSummary,
  getStrengthSeries,
  getTimeToGoal,
  getWeightSeries,
  listClientGoals,
} from "../lib/queries";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import MetricGraph from "./MetricGraph";

function money(n: number) {
  return `€${n.toFixed(2)}`;
}

function PinnedMetricsGrid({ clientId }: { clientId: number }) {
  const pinned = getPinnedMetricsSummary(clientId);
  if (pinned.length === 0) return null;

  return (
    <div className="nutrition-table-wrap">
      <h3>Pinned metrics</h3>
      <p className="empty-note" style={{ marginBottom: 14 }}>
        Pin up to 5 tracker metrics (from the pin icon in Daily or Weekly Tracker) to see them
        here first, without opening the full tracker.
      </p>
      <div className="pinned-metrics-grid">
        {pinned.map(({ def, latest, latestPeriod, average, entryCount }) => (
          <div key={def.id} className="pinned-metric-card">
            <div className="pinned-metric-label">{def.name}</div>
            <div className="pinned-metric-value">
              {latest != null ? `${latest}${def.unit ? ` ${def.unit}` : ""}` : "No entries"}
            </div>
            <div className="pinned-metric-sub">
              {average != null ? `avg ${average.toFixed(1)} · ${entryCount} logged` : latestPeriod ?? "Not logged yet"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SnapshotGrid({ snapshot }: { snapshot: ClientSnapshot }) {
  const { training, nutrition, measurements, photos, dailyTracker, weeklyTracker, meetings, invoices } = snapshot;

  return (
    <div className="nutrition-table-wrap">
      <h3>Snapshot</h3>
      <p className="empty-note" style={{ marginBottom: 14 }}>
        A live pulse of every tab — nothing here is entered manually, it all pulls from the tab
        itself.
      </p>
      <div className="snapshot-grid">
        <div className="snapshot-card">
          <h4>Training</h4>
          <div className="snapshot-main">
            {training.daysBuilt}/7 days built
            <span className={`status-pill ${training.published ? "published" : "draft"}`} style={{ marginLeft: 8, verticalAlign: "middle" }}>
              {training.published ? "published" : "draft"}
            </span>
          </div>
          <div className="snapshot-sub">
            {training.totalSetsLogged} sets logged
            <br />
            Last active: {training.lastActive ?? "never"}
          </div>
        </div>

        <div className="snapshot-card">
          <h4>Nutrition</h4>
          <div className="snapshot-main">
            {nutrition.trainingKcal || nutrition.restKcal ? `${nutrition.trainingKcal} / ${nutrition.restKcal} kcal` : "Not set"}
          </div>
          <div className="snapshot-sub">
            Training / rest day
            <br />
            Maintenance: {nutrition.maintenanceKcal ?? "–"} kcal
          </div>
        </div>

        <div className="snapshot-card">
          <h4>Measurements</h4>
          <div className="snapshot-main">
            {measurements.currentWeight != null ? `${measurements.currentWeight} kg` : "No check-ins"}
          </div>
          <div className="snapshot-sub">
            {measurements.weightChange ? (
              <span className={measurements.weightChange.delta > 0 ? "change-up" : measurements.weightChange.delta < 0 ? "change-down" : ""}>
                {measurements.weightChange.delta > 0 ? "+" : ""}
                {measurements.weightChange.delta} kg
                {measurements.weightChange.pct != null ? ` (${measurements.weightChange.pct > 0 ? "+" : ""}${measurements.weightChange.pct}%)` : ""}
                {" "}since {measurements.weightChange.firstDate}
              </span>
            ) : (
              "Not enough data for a trend yet"
            )}
          </div>
        </div>

        <div className="snapshot-card">
          <h4>Progress pictures</h4>
          <div className="snapshot-main">
            {photos.uploadedThisWeek}/{photos.totalSlots} this week
          </div>
          <div className="snapshot-sub">{photos.totalSlots} slot{photos.totalSlots === 1 ? "" : "s"} configured</div>
        </div>

        <div className="snapshot-card">
          <h4>Daily tracker</h4>
          <div className="snapshot-main">{dailyTracker.metricCount} metric{dailyTracker.metricCount === 1 ? "" : "s"}</div>
          <div className="snapshot-sub">Last logged: {dailyTracker.lastLogged ?? "never"}</div>
        </div>

        <div className="snapshot-card">
          <h4>Weekly tracker</h4>
          <div className="snapshot-main">{weeklyTracker.metricCount} metric{weeklyTracker.metricCount === 1 ? "" : "s"}</div>
          <div className="snapshot-sub">Last logged: {weeklyTracker.lastLogged ?? "never"}</div>
        </div>

        <div className="snapshot-card">
          <h4>Meetings</h4>
          <div className="snapshot-main">
            {meetings.next ? `${meetings.next.date}${meetings.next.time ? ` · ${meetings.next.time}` : ""}` : "None scheduled"}
          </div>
          <div className="snapshot-sub">{meetings.next?.topic || (meetings.next ? "No topic set" : "Schedule one in the Meetings tab")}</div>
        </div>

        <div className="snapshot-card">
          <h4>Invoices</h4>
          <div className="snapshot-main">{money(invoices.outstanding)} outstanding</div>
          <div className="snapshot-sub">
            {invoices.openCount} open invoice{invoices.openCount === 1 ? "" : "s"}
          </div>
        </div>
      </div>
    </div>
  );
}

function GoalList({
  clientId,
  term,
  title,
  goals,
}: {
  clientId: number;
  term: "short" | "long";
  title: string;
  goals: ClientGoal[];
}) {
  return (
    <div className="nutrition-table-wrap">
      <h3>{title}</h3>
      {goals.length > 0 && (
        <div className="invoice-list" style={{ marginBottom: 14 }}>
          {goals.map((g) => (
            <div key={g.id} className="invoice-row">
              <form action={toggleClientGoalAction} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
                <input type="hidden" name="id" value={g.id} />
                <input type="hidden" name="done" value={(!g.done).toString()} />
                <button
                  type="submit"
                  aria-label={g.done ? "Mark not done" : "Mark done"}
                  className="goal-checkbox"
                  style={{ background: g.done ? "var(--ink)" : "transparent" }}
                >
                  {g.done ? "✓" : ""}
                </button>
                <span style={{ textDecoration: g.done ? "line-through" : "none" }}>{g.text}</span>
              </form>
              <ConfirmDeleteButton action={removeClientGoalAction} hiddenFields={{ id: g.id }} label={`Delete goal: ${g.text}`} />
            </div>
          ))}
        </div>
      )}
      <form action={addClientGoalAction} className="add-invoice-form">
        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="term" value={term} />
        <input name="text" type="text" placeholder="Add a goal…" required />
        <button className="btn" type="submit">
          Add goal
        </button>
      </form>
    </div>
  );
}

export default function StartPagePanel({ clientId, name }: { clientId: number; name: string }) {
  const profile = getClientProfile(clientId);
  const timeToGoal = getTimeToGoal(profile);
  const currentWeight = getLatestWeight(clientId);
  const nutrition = getNutritionGoalsSummary(clientId);
  const shortGoals = listClientGoals(clientId, "short");
  const longGoals = listClientGoals(clientId, "long");
  const snapshot = getClientSnapshot(clientId);

  return (
    <div>
      {/* The range-toggle trend chart used to sit above the tabs. The redesign
          gives the header to identity + read-outs instead, and the rail carries
          a fixed strength trend — so the version with the day/week/month and
          weight/calories switches lives here, on the tab that is already a
          snapshot of everything. */}
      <MetricGraph
        strengthSeries={getStrengthSeries(clientId, 3650)}
        weightSeries={getWeightSeries(clientId, 3650)}
      />
      <PinnedMetricsGrid clientId={clientId} />
      <SnapshotGrid snapshot={snapshot} />

      <form action={saveClientProfileAction}>
        <input type="hidden" name="clientId" value={clientId} />

        <div className="nutrition-table-wrap">
          <h3>Member info</h3>
          <div className="start-form-grid">
            <label>
              Name
              <input type="text" value={name} disabled />
            </label>
            <label>
              Birthdate
              <input name="birthdate" type="date" defaultValue={profile.birthdate ?? ""} />
            </label>
            <label>
              Height (cm)
              <input name="height_cm" type="number" step="0.1" defaultValue={profile.height_cm ?? ""} />
            </label>
            <label>
              Starting weight (kg)
              <input
                name="starting_weight_kg"
                type="number"
                step="0.1"
                defaultValue={profile.starting_weight_kg ?? ""}
              />
            </label>
            <label>
              Current weight
              <input type="text" value={currentWeight != null ? `${currentWeight} kg` : "No check-ins yet"} disabled />
            </label>
          </div>
        </div>

        <div className="nutrition-table-wrap">
          <h3>Coaching info</h3>
          <div className="start-form-grid">
            <label>
              Start date
              <input name="coaching_start_date" type="date" defaultValue={profile.coaching_start_date ?? ""} />
            </label>
            <label>
              Current week
              <input name="current_week" type="text" placeholder="e.g. Week 6" defaultValue={profile.current_week} />
            </label>
            <label>
              Goal / phase
              <input name="goal_phase" type="text" placeholder="e.g. Body recomposition" defaultValue={profile.goal_phase} />
            </label>
            <label>
              Phase started
              <input
                name="goal_phase_start_date"
                type="date"
                defaultValue={profile.goal_phase_start_date ?? ""}
              />
            </label>
            <label>
              Goal date
              <input name="goal_date" type="date" defaultValue={profile.goal_date ?? ""} />
            </label>
            <label>
              Time to goal
              <input type="text" value={timeToGoal ?? "No goal date set"} disabled />
            </label>
            <label>
              Check-in day
              <select name="check_in_day" defaultValue={profile.check_in_day ?? ""}>
                <option value="">–</option>
                {CHECK_IN_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="nutrition-table-wrap">
          <h3>Nutrition goals</h3>
          <p className="empty-note" style={{ marginBottom: 14 }}>
            Pulled live from the Nutrition tab — edit macros there, it updates here automatically.
          </p>
          <div className="exercise-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Kcal</th>
                  <th>Protein</th>
                  <th>Carbs</th>
                  <th>Fat</th>
                  <th>Water</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="exercise-name-cell">Training</td>
                  <td>{nutrition.trainingKcal || "–"}</td>
                  <td>{nutrition.trainingProtein || "–"}g</td>
                  <td>{nutrition.trainingCarbs || "–"}g</td>
                  <td>{nutrition.trainingFats || "–"}g</td>
                  <td rowSpan={2} style={{ verticalAlign: "middle" }}>
                    <input
                      name="water_goal"
                      type="text"
                      placeholder="e.g. 2 liter"
                      defaultValue={profile.water_goal}
                      className="inline-number-input"
                    />
                  </td>
                </tr>
                <tr>
                  <td className="exercise-name-cell">Rest</td>
                  <td>{nutrition.restKcal || "–"}</td>
                  <td>{nutrition.restProtein || "–"}g</td>
                  <td>{nutrition.restCarbs || "–"}g</td>
                  <td>{nutrition.restFats || "–"}g</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="nutrition-table-wrap">
          <h3>Activity goals</h3>
          <div className="start-form-grid">
            <label>
              Steps
              <input name="steps_goal" type="text" placeholder="e.g. 8,000/day" defaultValue={profile.steps_goal} />
            </label>
            <label>
              Cardio
              <input name="cardio_goal" type="text" placeholder="e.g. 2x/week, 20min" defaultValue={profile.cardio_goal} />
            </label>
            <label>
              Training
              <input name="training_goal" type="text" placeholder="e.g. 4x/week" defaultValue={profile.training_goal} />
            </label>
          </div>
        </div>

        <button className="btn" type="submit" style={{ marginTop: 4 }}>
          Save
        </button>
      </form>

      <GoalList clientId={clientId} term="short" title="Short-term goals — 3 months" goals={shortGoals} />
      <GoalList clientId={clientId} term="long" title="Long-term goals — 6-12 months" goals={longGoals} />
    </div>
  );
}
