import {
  addSupplementRowAction,
  removeSupplementRowAction,
  saveCoachNutritionNoteAction,
} from "../lib/actions";
import { getNutritionGoalsSummary, getNutritionPlan } from "../lib/queries";
import NutritionTargets from "./NutritionTargets";
import SupplementCell from "./SupplementCell";

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

  return (
    <div className="nt">
      <div className="nt-top">
        <NutritionTargets
          clientId={clientId}
          training={training}
          rest={rest}
          waterL={plan.water_l ?? null}
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
                      placeholder={
                        field === "name"
                          ? "Creatine monohydrate"
                          : field === "quantity"
                          ? "5g"
                          : field === "timing"
                          ? "any time"
                          : "-"
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
