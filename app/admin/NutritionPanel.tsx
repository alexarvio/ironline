import {
  addSupplementRowAction,
  removeSupplementRowAction,
  saveCoachNutritionNoteAction,
} from "../lib/actions";
import {
  getAssignmentsForDay,
  getClient,
  getCurrentWeekNumber,
  getNutritionGoalsSummary,
  getNutritionPlan,
  getWeek,
  listCalorieLogs,
} from "../lib/queries";
import NutritionTargets from "./NutritionTargets";
import SupplementCell from "./SupplementCell";
import AutosaveNote from "./AutosaveNote";

// The daily targets the client sees on their Nutrition screen, the note that
// explains them, and the supplement sheet.
//
// Two things this deliberately does NOT do, both de-scoped in the design and
// easy to add back by mistake: water is a stated goal rather than a tracker,
// and supplements are a reference list rather than a checklist. Neither has
// any per-day state, and neither should grow a tick box.
export default function NutritionPanel({ clientId }: { clientId: number }) {
  const plan = getNutritionPlan(clientId);

  // A plan built on the older six-meal model has no day targets yet. Rather
  // than showing a coach blank fields for macros they already set, the totals
  // are derived from those meals and pre-filled.
  const derived = getNutritionGoalsSummary(clientId);
  const training = plan.day_targets?.training ?? {
    protein: derived.trainingProtein || null,
    carbs: derived.trainingCarbs || null,
    fats: derived.trainingFats || null,
  };
  const rest = plan.day_targets?.rest ?? {
    protein: derived.restProtein || null,
    carbs: derived.restCarbs || null,
    fats: derived.restFats || null,
  };
  const rows = plan.supplement_rows ?? [];
  const clientName = getClient(clientId)?.name ?? "the client";
  // The client's reported calories, most recent first, and which weekdays
  // are training days this week so each row can be read against the right
  // target.
  const calorieLogs = listCalorieLogs(clientId, 30);
  const trainingDows = new Set(
    getWeek(clientId, getCurrentWeekNumber(clientId))
      .filter((d) => getAssignmentsForDay(d.id).length > 0)
      .map((d) => d.day_of_week)
  );
  // Server-stamped per render; the note flips to "Saved" only once an action
  // (Save targets, a supplement cell, the note) has actually run. Same
  // status bar as the Measurements tab, for the same reason: everything on
  // this tab is live for the client the moment it saves, and the coach
  // could not tell.
  // eslint-disable-next-line react-hooks/purity -- a server component render is the intended clock here
  const renderedAt = Date.now();

  return (
    <div className="nt">
      <div className="ms-topbar">
        <span className="ms-topbar-live">
          <span className="ms-live-dot" aria-hidden="true" />
          Live in {clientName}&rsquo;s app
        </span>
        <AutosaveNote renderedAt={renderedAt} savedText="Up to date" idleText="Up to date" idleAsSaved />
      </div>

      <div className="nt-top">
        <NutritionTargets
          clientId={clientId}
          training={training}
          rest={rest}
          waterL={plan.water_l ?? null}
          renderedAt={renderedAt}
        />

        <form action={saveCoachNutritionNoteAction} className="nt-note-card">
          <input type="hidden" name="clientId" value={clientId} />
          <span className="ad-microlabel">Note on the targets</span>
          <textarea
            name="note"
            defaultValue={plan.coach_notes ?? ""}
            placeholder="Why these numbers: the client reads this under their kcal figure."
            aria-label="Note on the targets"
          />
          <div className="nt-note-foot">
            <button type="submit" className="ad-btn-secondary">
              Save note
            </button>
          </div>
        </form>
      </div>

      {/* What the client reported eating, day by day. A sheet, not a chart:
          the coach reads it against the targets above. */}
      <section className="nt-supps nt-cal">
        <div className="nt-supps-head">
          <span className="ad-microlabel">Calories logged</span>
          <span className="nt-supps-count">
            {calorieLogs.length === 0 ? "nothing yet" : `last ${calorieLogs.length} day${calorieLogs.length === 1 ? "" : "s"} logged`}
          </span>
        </div>
        {calorieLogs.length === 0 ? (
          <p className="ad-panel-empty">Nothing logged yet. The client enters this under their targets on the Nutrition tab.</p>
        ) : (
          <table className="nt-supp-table nt-cal-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Calories</th>
                <th>Day</th>
              </tr>
            </thead>
            <tbody>
              {calorieLogs.map((c) => {
                const isTraining = trainingDows.has(new Date(`${c.date}T00:00:00`).getDay() || 7);
                const target = isTraining ? derived.trainingKcal : derived.restKcal;
                const diff = target ? c.kcal - target : null;
                return (
                  <tr key={c.id}>
                    <td>{new Date(`${c.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</td>
                    <td className="nt-cal-kcal">
                      {c.kcal.toLocaleString("en-US")} kcal
                      {diff != null && (
                        <span className={`nt-cal-diff${diff > 0 ? " over" : diff < 0 ? " under" : ""}`}>
                          {diff === 0 ? "on target" : `${diff > 0 ? "+" : ""}${diff.toLocaleString("en-US")}`}
                        </span>
                      )}
                    </td>
                    <td className="nt-cal-day">{isTraining ? "Training" : "Rest"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="nt-supps">
        <div className="nt-supps-head">
          <span className="ad-microlabel">Supplements</span>
          <span className="nt-supps-count">
            {rows.length} item{rows.length === 1 ? "" : "s"}
          </span>
        </div>

        <table className="nt-supp-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Quantity</th>
              <th>Timing</th>
              <th>Notes</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              // The empty state lives inside the table, so the sheet's shape
              // is visible before there's anything in it.
              <tr>
                <td className="nt-supp-empty" colSpan={5}>
                  Nothing set yet. Add the first item below.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                {(["name", "quantity", "timing", "notes"] as const).map((field) => (
                  <td key={field}>
                    <SupplementCell
                      clientId={clientId}
                      rowId={row.id}
                      field={field}
                      value={row[field]}
                      // No example text in empty cells: "Creatine monohydrate /
                      // 5g / any time" read as values already filled in, so a
                      // new row looked like it had defaulted to creatine.
                      placeholder=""
                    />
                  </td>
                ))}
                <td className="nt-supp-remove">
                  <form action={removeSupplementRowAction}>
                    <input type="hidden" name="clientId" value={clientId} />
                    <input type="hidden" name="rowId" value={row.id} />
                    <button type="submit" aria-label={`Remove ${row.name || "supplement"}`}>
                      ×
                    </button>
                  </form>
                </td>
              </tr>
            ))}

            {/* A persistent add row, so adding the fifth supplement is the
                same gesture as adding the first. */}
            <tr className="nt-supp-add">
              <td colSpan={4}>
                <form action={addSupplementRowAction} id={`add-supp-${clientId}`}>
                  <input type="hidden" name="clientId" value={clientId} />
                </form>
                <span className="nt-supp-add-hint">Add an item, e.g. Magnesium</span>
              </td>
              <td className="nt-supp-remove">
                <button type="submit" form={`add-supp-${clientId}`} className="ad-btn-primary nt-supp-add-btn">
                  Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
