import { saveMeasurementCheckInAction } from "../lib/actions";
import { getMeasurementValues, listMeasurementDates, listMeasurementFields, localDateStr } from "../lib/queries";

// The client can only fill in values against columns the coach defines —
// they can't rename, add, or remove a column, same boundary as Training
// (log sets, can't edit the prescribed exercise/reps). What they CAN see is
// everything: their full check-in history, not just a recent-entries
// preview, so this mirrors the coach's own Check-ins table exactly. The
// running "since your first check-in" trend lives in CheckInSummaryFooter,
// pinned above the nav bar instead of buried at the bottom of this table.
export default function CheckInForm({ clientId }: { clientId: number }) {
  const fields = listMeasurementFields(clientId);
  const values = getMeasurementValues(fields.map((f) => f.id));
  const dates = listMeasurementDates(clientId);

  const valueFor = (fieldId: number, date: string) =>
    values.find((v) => v.field_id === fieldId && v.date === date)?.value ?? null;

  return (
    <div>
      <div className="checkin-card">
        <form action={saveMeasurementCheckInAction}>
          <input type="hidden" name="clientId" value={clientId} />

          <label className="checkin-field checkin-date-field">
            <span className="checkin-field-label">Date</span>
            <input name="date" type="date" required defaultValue={localDateStr()} />
          </label>

          {fields.length > 0 && (
            <div className="checkin-fields-grid">
              {fields.map((f) => (
                <label key={f.id} className="checkin-field">
                  <span className="checkin-field-label">
                    {f.name}
                    {f.unit ? ` (${f.unit})` : ""}
                  </span>
                  <input name={`field_${f.id}`} type="number" step="0.1" placeholder="–" />
                </label>
              ))}
            </div>
          )}

          <button className="btn checkin-save-btn" type="submit">
            Save check-in
          </button>
        </form>
      </div>

      <h3 style={{ marginTop: 20 }}>Your history</h3>
      {fields.length === 0 ? (
        <p className="empty-note">Your coach hasn&rsquo;t set up any check-in columns yet.</p>
      ) : dates.length === 0 ? (
        <p className="empty-note">No check-ins yet — log your first one above.</p>
      ) : (
        <div className="exercise-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                {fields.map((f) => (
                  <th key={f.id}>
                    {f.name}
                    {f.unit ? ` (${f.unit})` : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((date) => (
                <tr key={date}>
                  <td className="exercise-name-cell">{date}</td>
                  {fields.map((f) => {
                    const v = valueFor(f.id, date);
                    return <td key={f.id}>{v != null ? `${v}${f.unit ? ` ${f.unit}` : ""}` : "–"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
