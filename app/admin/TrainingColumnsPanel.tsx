import {
  addTrainingColumnAction,
  removeCustomTrainingColumnAction,
  updateTrainingColumnAction,
} from "../lib/actions";
import { TrainingColumn } from "../lib/queries";
import ColumnVisibilityToggle from "./ColumnVisibilityToggle";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";

export default function TrainingColumnsPanel({
  clientId,
  columns,
}: {
  clientId: number;
  columns: TrainingColumn[];
}) {
  return (
    <details className="training-columns-panel">
      <summary>Customize columns</summary>
      <div className="training-columns-body">
        <p className="empty-note" style={{ marginBottom: 12 }}>
          Hide any column you don&rsquo;t use, rename the ones you keep, or add your own — this
          applies to every day in this client&rsquo;s program.
        </p>
        <div className="training-columns-list">
          {columns.map((col) => (
            <div key={col.id} className="training-column-row">
              <form action={updateTrainingColumnAction} className="training-column-label-form">
                <input type="hidden" name="id" value={col.id} />
                <input name="label" type="text" defaultValue={col.label} />
                <button className="btn secondary" type="submit">
                  Save
                </button>
              </form>
              <ColumnVisibilityToggle id={col.id} visible={col.visible} />
              {col.kind === "custom" ? (
                <ConfirmDeleteButton
                  action={removeCustomTrainingColumnAction}
                  hiddenFields={{ id: col.id }}
                  label={`Delete column: ${col.label}`}
                />
              ) : (
                <span className="exercise-meta">built-in</span>
              )}
            </div>
          ))}
        </div>
        <form action={addTrainingColumnAction} className="add-invoice-form" style={{ marginTop: 12 }}>
          <input type="hidden" name="clientId" value={clientId} />
          <input name="label" type="text" placeholder="New column name" required />
          <button className="btn" type="submit">
            + Add column
          </button>
        </form>
      </div>
    </details>
  );
}
