import { setTrainingColumnVisibleAction } from "../lib/actions";
import type { TrainingColumn } from "../lib/queries";

// Show/hide a column across every day of this client's program. Unlike the
// prototype's ephemeral toggle this persists — a coach who doesn't use
// tempo shouldn't have to hide it again every visit. Renaming, adding and
// deleting columns still live in the fuller panel below the day cards.
export default function ColumnPills({ columns }: { columns: TrainingColumn[] }) {
  return (
    <div className="pb-column-pills">
      {columns.map((col) => (
        <form key={col.id} action={setTrainingColumnVisibleAction}>
          <input type="hidden" name="id" value={col.id} />
          <input type="hidden" name="visible" value={col.visible ? "false" : "true"} />
          <button type="submit" className={`pb-column-pill${col.visible ? " on" : ""}`}>
            {col.label}
          </button>
        </form>
      ))}
    </div>
  );
}
