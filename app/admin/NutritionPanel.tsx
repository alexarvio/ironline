import { saveNutritionPlanAction } from "../lib/actions";
import {
  getNutritionPlan,
  getTrainingDaysBuiltCount,
  OTHER_ITEMS,
  slugify,
  SUPPLEMENT_ITEMS,
  VITAMIN_ITEMS,
} from "../lib/queries";
import NutritionMacrosLive from "./NutritionMacrosLive";

function KeyedTable({
  title,
  items,
  values,
  prefix,
  col1Label,
  col1Field,
}: {
  title: string;
  items: string[];
  values: Record<string, Record<string, string>>;
  prefix: string;
  col1Label: string;
  col1Field: "quantity" | "amount";
}) {
  const nameFrag = col1Field === "amount" ? "amt" : "qty";
  return (
    <div className="nutrition-table-wrap">
      <h3>{title}</h3>
      <div className="exercise-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>{col1Label}</th>
              <th>Timing</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const key = slugify(item);
              const entry = values[key] ?? {};
              return (
                <tr key={key}>
                  <td className="exercise-name-cell">{item}</td>
                  <td>
                    <input
                      name={`${prefix}_${nameFrag}_${key}`}
                      type="text"
                      defaultValue={entry[col1Field] ?? ""}
                    />
                  </td>
                  <td>
                    <input
                      name={`${prefix}_time_${key}`}
                      type="text"
                      defaultValue={entry.timing ?? ""}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function NutritionPanel({ clientId }: { clientId: number }) {
  const plan = getNutritionPlan(clientId);
  const trainingDaysBuilt = getTrainingDaysBuiltCount(clientId);

  return (
    <form action={saveNutritionPlanAction} className="nutrition-panel">
      <input type="hidden" name="clientId" value={clientId} />

      <p className="empty-note" style={{ marginBottom: 18 }}>
        These are the coach&rsquo;s nutrition targets for this client — kcal recalculate live as
        you type (protein/carbs = 4 kcal/g, fat = 9 kcal/g), and the weekly total uses the
        training days actually built in the Training tab ({trainingDaysBuilt} right now).
        Meal-by-meal food logging (what the client actually ate day to day) is a separate
        feature, not built yet.
      </p>

      <NutritionMacrosLive
        trainingMeals={plan.training_day_meals}
        restMeals={plan.rest_day_meals}
        trainingDaysBuilt={trainingDaysBuilt}
        maintenanceKcal={plan.maintenance_kcal}
        ebf={plan.ebf}
      />

      <KeyedTable
        title="Vitamins & minerals"
        items={VITAMIN_ITEMS}
        values={plan.vitamins}
        prefix="vit"
        col1Label="Quantity"
        col1Field="quantity"
      />
      <KeyedTable
        title="Other"
        items={OTHER_ITEMS}
        values={plan.other}
        prefix="other"
        col1Label="Amount"
        col1Field="amount"
      />
      <KeyedTable
        title="Supplements"
        items={SUPPLEMENT_ITEMS}
        values={plan.supplements}
        prefix="supp"
        col1Label="Quantity"
        col1Field="quantity"
      />

      <div className="nutrition-table-wrap">
        <h3>Coach notes</h3>
        <textarea
          name="coach_notes"
          defaultValue={plan.coach_notes}
          rows={3}
          className="coach-notes-textarea"
          placeholder="e.g. Keep average kcal intake steady"
        />
      </div>

      <button className="btn" type="submit" style={{ marginTop: 4 }}>
        Save nutrition plan
      </button>
    </form>
  );
}
