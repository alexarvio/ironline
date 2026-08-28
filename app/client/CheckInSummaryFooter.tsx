import { getMeasurementChangeSummary, listMeasurementFields } from "../lib/queries";

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

// Pinned above the bottom nav so the client's overall trend stays visible no
// matter how long their check-in history grows — it never gets buried under
// a scrolling table.
export default function CheckInSummaryFooter({ clientId }: { clientId: number }) {
  const fields = listMeasurementFields(clientId);
  const change = getMeasurementChangeSummary(clientId);
  const withChange = fields.filter((f) => change[f.id]);

  if (withChange.length === 0) return null;

  return (
    <div className="checkin-summary-footer">
      <span className="checkin-summary-label">Since your first check-in</span>
      <div className="checkin-summary-stats">
        {withChange.map((f) => {
          const c = change[f.id]!;
          return (
            <div key={f.id} className="checkin-summary-stat">
              <span className="checkin-summary-stat-name">{f.name}</span>
              <span className={`checkin-summary-stat-value ${changeClass(c.delta)}`}>
                {changeLabel(c.delta, c.pct, f.unit)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
