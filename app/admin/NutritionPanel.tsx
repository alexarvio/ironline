import {
  addSupplementRowAction,
  removeSupplementRowAction,
  saveNutritionTargetsAction,
  saveWaterGoalAction,
} from "../lib/actions";
import { getNutritionGoalsSummary, getNutritionPlan, macroKcal } from "../lib/queries";
import SupplementCell from "./SupplementCell";

// The daily targets the client sees on their Nutrition screen.
//
// Two things this deliberately does NOT do, both of them de-scoped in the
// design and easy to add back by mistake:
//   - water is a stated goal, not a tracker
//   - supplements are a reference list, not a checklist
// Neither has any per-day state, and neither should grow a tick box.
export default function NutritionPanel({ clientId }: { clientId: number }) {
  const plan = getNutritionPlan(clientId);

  // A plan built on the older six-meal model has no day targets yet. Rather
  // than showing a coach blank fields for macros they already set, the totals
  // are derived from those meals and pre-filled — saving once makes them
  // explicit and the meal arrays stop being consulted.
  const derived = getNutritionGoalsSummary(clientId);
  const t = plan.day_targets?.training ?? {
    protein: derived.trainingProtein || null,
    carbs: derived.trainingCarbs || null,
    fats: derived.trainingFats || null,
  };
  const r = plan.day_targets?.rest ?? {
    protein: derived.restProtein || null,
    carbs: derived.restCarbs || null,
    fats: derived.restFats || null,
  };
  const rows = plan.supplement_rows ?? [];

  const trainingKcal = macroKcal(t.protein, t.carbs, t.fats);
  const restKcal = macroKcal(r.protein, r.carbs, r.fats);

  return (
    <div className="nt">
      {/* Targets: the two day types side by side, so the difference between
          them — which is the whole point of having two — is one glance. */}
      <form action={saveNutritionTargetsAction} className="nt-targets">
        <input type="hidden" name="clientId" value={clientId} />

        <div className="nt-day">
          <div className="nt-day-head">
            <span className="ad-microlabel">Training day</span>
            <span className="nt-kcal">{trainingKcal ? `${trainingKcal.toLocaleString()} kcal` : "—"}</span>
          </div>
          <div className="nt-macros">
            {(["protein", "carbs", "fats"] as const).map((m) => (
              <label key={m} className="nt-macro">
                <span>{m === "fats" ? "Fat" : m}</span>
                <input name={`t_${m}`} type="number" min={0} defaultValue={t[m] ?? ""} placeholder="g" />
              </label>
            ))}
          </div>
        </div>

        <div className="nt-day">
          <div className="nt-day-head">
            <span className="ad-microlabel">Rest day</span>
            <span className="nt-kcal">{restKcal ? `${restKcal.toLocaleString()} kcal` : "—"}</span>
          </div>
          <div className="nt-macros">
            {(["protein", "carbs", "fats"] as const).map((m) => (
              <label key={m} className="nt-macro">
                <span>{m === "fats" ? "Fat" : m}</span>
                <input name={`r_${m}`} type="number" min={0} defaultValue={r[m] ?? ""} placeholder="g" />
              </label>
            ))}
          </div>
        </div>

        <div className="nt-targets-foot">
          {/* kcal is derived, never typed — a coach entering both macros and
              a calorie figure can only ever disagree with themselves. */}
          <span className="nt-derived-note">Calories are worked out from the macros.</span>
          <button type="submit" className="btn nt-save">
            Save targets
          </button>
        </div>
      </form>

      {/* Water — one number. */}
      <form action={saveWaterGoalAction} className="nt-water">
        <input type="hidden" name="clientId" value={clientId} />
        <span className="ad-microlabel">Water goal</span>
        <div className="nt-water-input">
          <input
            name="water"
            type="number"
            step="0.1"
            min={0}
            defaultValue={plan.water_l ?? ""}
            placeholder="3"
            aria-label="Water goal in litres"
          />
          <span className="nt-water-unit">L a day</span>
        </div>
        <button type="submit" className="btn secondary btn-sm">
          Save
        </button>
      </form>

      {/* Supplements — an editable sheet that starts empty and grows a row at
          a time, rather than a fixed list of everything a coach might use. */}
      <section className="nt-supps">
        <div className="nt-supps-head">
          <span className="ad-microlabel">Supplements</span>
          <form action={addSupplementRowAction}>
            <input type="hidden" name="clientId" value={clientId} />
            <button type="submit" className="btn secondary btn-sm">
              Add supplement
            </button>
          </form>
        </div>

        {rows.length === 0 ? (
          <p className="ad-panel-empty">Nothing set — add a row when {`there's`} something to take.</p>
        ) : (
          <table className="nt-supp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Quantity</th>
                <th>Timing</th>
                <th>Notes</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {(["name", "quantity", "timing", "notes"] as const).map((field) => (
                    <td key={field}>
                      <SupplementCell
                        clientId={clientId}
                        rowId={row.id}
                        field={field}
                        value={row[field]}
                        placeholder={
                          field === "name"
                            ? "Creatine"
                            : field === "quantity"
                            ? "5g"
                            : field === "timing"
                            ? "daily, any time"
                            : "optional"
                        }
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
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
