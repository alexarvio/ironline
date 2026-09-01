import type { MetricHistory } from "../lib/queries";

// One history table.
//
// Three things are frozen while the data scrolls between them: the group band
// row, the column names under it, and the "change" row at the foot. A coach
// reading week 14 of a client's numbers should never have to scroll back up
// to remember which column is which, nor down to see where it started.
//
// Rows are the client's own entries. The coach can delete a bad one but not
// author one — this is a record of what happened, not another place to type.
export default function MetricHistoryTable({
  history,
  emptyNote,
  maxHeight,
  averaged = false,
}: {
  history: MetricHistory;
  emptyNote: string;
  maxHeight: number;
  /** At weekly grain a daily metric is an average, and the header says so. */
  averaged?: boolean;
}) {
  if (history.columns.length === 0) {
    return <p className="ad-panel-empty">{emptyNote}</p>;
  }

  return (
    <div className="mh-wrap" style={{ maxHeight }}>
      <table className="mh-table">
        <thead>
          {/* Consecutive same-group columns collapse into one banded header,
              with a divider at each boundary — the same logic as the coloured
              section headers on the coach's own sheet. */}
          <tr className="mh-band-row">
            <th className="mh-corner" />
            {history.bands.map((b, i) => (
              <th key={`${b.group}-${i}`} colSpan={b.span} className="mh-band" style={{ background: b.tint }}>
                {b.label}
              </th>
            ))}
          </tr>
          <tr className="mh-name-row">
            <th className="mh-corner mh-corner-lower">Date</th>
            {history.columns.map((c) => (
              <th key={c.id} className="mh-name" title={c.unit ? `${c.name} (${c.unit})` : c.name}>
                <span>{c.name}</span>
                {c.unit && <em>{c.unit}</em>}
                {averaged && <em className="mh-avg">avg</em>}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {history.rows.length === 0 ? (
            <tr>
              <td className="mh-empty" colSpan={history.columns.length + 1}>
                Nothing logged yet.
              </td>
            </tr>
          ) : (
            history.rows.map((row) => (
              <tr key={row.period}>
                <td className="mh-date">{row.label}</td>
                {row.values.map((v, i) => (
                  <td key={i} className={`mh-cell${v == null ? " missing" : ""}`}>
                    {v == null ? "·" : v}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>

        <tfoot>
          <tr>
            <th className="mh-corner mh-corner-foot">Change</th>
            {history.change.map((c, i) => (
              <td key={i} className="mh-change">
                {c.label}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
