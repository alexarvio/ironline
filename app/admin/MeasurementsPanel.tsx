import {
  addMeasurementFieldAction,
  addSkinfoldEntryAction,
  removeMeasurementCheckInAction,
  removeSkinfoldEntryAction,
} from "../lib/actions";
import {
  getMeasurementChangeSummary,
  getMeasurementValues,
  getWeeklyMeasurementSummary,
  listDistinctMeasurementFieldNames,
  listMeasurementDates,
  listMeasurementFields,
  listSkinfoldEntries,
  localDateStr,
  SKINFOLD_SITES,
} from "../lib/queries";
import ComboBoxInput from "../components/ComboBoxInput";
import ConfirmDeleteButton from "../components/ConfirmDeleteButton";
import MeasurementFieldRow from "./MeasurementFieldRow";

function changeLabel(delta: number, pct: number | null, unit: string) {
  const sign = delta > 0 ? "+" : "";
  const pctPart = pct != null ? ` (${sign}${pct}%)` : "";
  return `${sign}${delta}${unit ? ` ${unit}` : ""}${pctPart}`;
}

function changeClass(delta: number) {
  if (delta > 0) return "change-up";
  if (delta < 0) return "change-down";
  return "";
}

export default function MeasurementsPanel({ clientId }: { clientId: number }) {
  const fields = listMeasurementFields(clientId);
  const values = getMeasurementValues(fields.map((f) => f.id));
  const dates = listMeasurementDates(clientId);
  const weekly = getWeeklyMeasurementSummary(clientId);
  const skinfolds = listSkinfoldEntries(clientId);
  const change = getMeasurementChangeSummary(clientId);
  const hasChange = fields.some((f) => change[f.id]);
  const knownFieldNames = listDistinctMeasurementFieldNames().map((f) => f.name);

  const valueFor = (fieldId: number, date: string) =>
    values.find((v) => v.field_id === fieldId && v.date === date)?.value ?? null;

  // A long program (say, daily check-ins over 3 months) can produce dozens of
  // rows — nobody wants to scroll the whole page to compare the first entry
  // against the latest. So the first and most-recent check-ins (plus the
  // change row) always stay pinned in view, and anything in between sits in
  // its own short scrollable window instead of stretching the table.
  const firstDate = dates[0];
  const lastDate = dates[dates.length - 1];
  const hasDistinctLast = dates.length > 1;
  const middleDates = dates.length > 2 ? dates.slice(1, -1) : [];

  const DATE_W = "22%";
  const REMOVE_W = "10%";
  const fieldW = fields.length > 0 ? `${(100 - 22 - 10) / fields.length}%` : "0%";

  const renderCheckInRow = (date: string) => (
    <tr key={date}>
      <td className="exercise-name-cell" style={{ width: DATE_W }}>
        {date}
      </td>
      {fields.map((f) => {
        const v = valueFor(f.id, date);
        return (
          <td key={f.id} style={{ width: fieldW }}>
            {v != null ? `${v}${f.unit ? ` ${f.unit}` : ""}` : "–"}
          </td>
        );
      })}
      <td style={{ width: REMOVE_W }}>
        <ConfirmDeleteButton
          action={removeMeasurementCheckInAction}
          hiddenFields={{ clientId, date }}
          label={`Delete check-in for ${date}`}
        />
      </td>
    </tr>
  );

  return (
    <div>
      <p className="empty-note" style={{ marginBottom: 18 }}>
        Set up the columns you want the client checking in on — logged by the client from their
        own app, not entered here. You can remove a bad row, but check-ins themselves come from
        the client. The last row always tracks the change from the first to the most recent
        entry, and moves down automatically as new check-ins are added.
      </p>

      <div className="nutrition-table-wrap builder-card">
        <h3 className="builder-pill-heading">Check-in columns</h3>
        <p className="empty-note" style={{ marginBottom: 14 }}>
          Whatever you add here is what shows up on the client&rsquo;s check-in form. Rename or
          remove a column any time — historical values for the others aren&rsquo;t affected.
        </p>

        <form action={addMeasurementFieldAction} className="add-invoice-form add-metric-form">
          <input type="hidden" name="clientId" value={clientId} />
          <ComboBoxInput name="name" options={knownFieldNames} placeholder="Column name (e.g. Weight)" required />
          <input name="unit" type="text" placeholder="Unit (e.g. kg)" />
          <button className="btn" type="submit">
            Add column
          </button>
        </form>

        {fields.length > 0 && (
          <div className="invoice-list" style={{ marginTop: 14 }}>
            {fields.map((f) => (
              <MeasurementFieldRow key={f.id} field={f} />
            ))}
          </div>
        )}
      </div>

      <div className="nutrition-table-wrap">
        <h3>Check-ins</h3>
        {fields.length === 0 ? (
          <p className="empty-note">No columns set up yet — add one below.</p>
        ) : dates.length === 0 ? (
          <p className="empty-note">No check-ins logged yet.</p>
        ) : (
          <div className="exercise-table-wrap">
            <table className="data-table checkins-table">
              <thead>
                <tr>
                  <th style={{ width: DATE_W }}>Date</th>
                  {fields.map((f) => (
                    <th key={f.id} style={{ width: fieldW }}>
                      {f.name}
                      {f.unit ? ` (${f.unit})` : ""}
                    </th>
                  ))}
                  <th style={{ width: REMOVE_W }}></th>
                </tr>
              </thead>

              <tbody>{renderCheckInRow(firstDate)}</tbody>

              {middleDates.length > 0 && (
                <>
                  <tbody>
                    <tr className="checkins-scroll-hint-row">
                      <td colSpan={fields.length + 2} className="checkins-scroll-hint">
                        {middleDates.length} check-in{middleDates.length === 1 ? "" : "s"} in between — scroll to
                        see them
                      </td>
                    </tr>
                  </tbody>
                  <tbody className="checkins-scroll-body">{middleDates.map((date) => renderCheckInRow(date))}</tbody>
                </>
              )}

              {hasDistinctLast && <tbody>{renderCheckInRow(lastDate)}</tbody>}

              {hasChange && (
                <tbody>
                  <tr className="measurement-summary-row">
                    <td className="exercise-name-cell" style={{ width: DATE_W }}>
                      Change (first → latest)
                    </td>
                    {fields.map((f) => {
                      const c = change[f.id];
                      return (
                        <td
                          key={f.id}
                          style={{ width: fieldW }}
                          className={c ? `computed-cell ${changeClass(c.delta)}` : "computed-cell"}
                        >
                          {c ? changeLabel(c.delta, c.pct, f.unit) : "–"}
                        </td>
                      );
                    })}
                    <td style={{ width: REMOVE_W }}></td>
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        )}
      </div>

      <div className="nutrition-table-wrap">
        <h3>Weekly averages</h3>
        {fields.length === 0 || weekly.length === 0 ? (
          <p className="empty-note">No entries yet.</p>
        ) : (
          <div className="exercise-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Week of</th>
                  {fields.map((f) => (
                    <th key={f.id}>
                      Avg {f.name}
                      {f.unit ? ` (${f.unit})` : ""}
                    </th>
                  ))}
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {weekly.map((w) => (
                  <tr key={w.weekStart}>
                    <td className="exercise-name-cell">{w.weekStart}</td>
                    {fields.map((f) => (
                      <td key={f.id}>
                        {w.averages[f.id] != null ? `${w.averages[f.id]}${f.unit ? ` ${f.unit}` : ""}` : "–"}
                      </td>
                    ))}
                    <td className="computed-cell">{w.entryCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="nutrition-table-wrap">
        <h3>Skinfolds</h3>
        <form action={addSkinfoldEntryAction} className="add-invoice-form add-metric-form">
          <input type="hidden" name="clientId" value={clientId} />
          <input name="date" type="date" required defaultValue={localDateStr()} />
          <select name="site" required defaultValue="">
            <option value="" disabled>
              Site…
            </option>
            {SKINFOLD_SITES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input name="readingMm" type="number" step="0.1" placeholder="Reading (mm)" />
          <button className="btn" type="submit">
            Add reading
          </button>
        </form>

        {skinfolds.length === 0 ? (
          <p className="empty-note" style={{ marginTop: 14 }}>
            No skinfold readings logged yet.
          </p>
        ) : (
          <div className="invoice-list" style={{ marginTop: 14 }}>
            {skinfolds.map((s) => (
              <div key={s.id} className="invoice-row">
                <div>
                  <div className="invoice-desc">
                    {s.date} — {s.site}
                  </div>
                  <div className="exercise-meta">
                    {s.reading_mm != null ? `${s.reading_mm}mm` : "– mm"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <ConfirmDeleteButton
                    action={removeSkinfoldEntryAction}
                    hiddenFields={{ id: s.id }}
                    label={`Delete ${s.date} ${s.site} skinfold reading`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
