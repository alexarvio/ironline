import { listClientPhases, localDateStr, PHASE_TRACKS, weekStart, type ClientPhase } from "../lib/queries";
import PhaseDialogButton from "./PhaseDialogButton";

// The coach's phase timeline for one client: calendar weeks across, one
// row per track, one bar per phase. It answers the three questions the
// coach's old planning sheet answered at a glance: what block is the client
// in, until when, and what comes after. The current week's column is
// tinted the same way the live week is in the programme rail below.
//
// Server component: the grid is plain HTML; only the add/edit dialog needs
// client JS, and it lives in PhaseDialogButton.

const DAY = 86400000;

function addWeeks(monday: string, n: number): string {
  const d = new Date(`${monday}T00:00:00`);
  d.setDate(d.getDate() + n * 7);
  return localDateStr(d);
}

function weeksBetween(a: string, b: string): number {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / (7 * DAY));
}

// ISO-ish week number for the column header, matching the coach's sheet.
function weekNumber(monday: string): number {
  const d = new Date(`${monday}T00:00:00`);
  const thursday = new Date(d);
  thursday.setDate(d.getDate() + 3);
  const jan1 = new Date(thursday.getFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1.getTime()) / DAY / 7) + 1;
}

function monthLabel(monday: string): string {
  return new Date(`${monday}T00:00:00`).toLocaleDateString("en-US", { month: "long" });
}

function fmtWeek(monday: string): string {
  return new Date(`${monday}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Muted bar colours per track, darker text from the same family.
const TRACK_TONE: Record<string, { bg: string; fg: string }> = {
  nutrition: { bg: "#dff3ea", fg: "#0f5c46" },
  training: { bg: "#e6e4fa", fg: "#3a3390" },
  lifestyle: { bg: "#efede6", fg: "#4a4a45" },
};

export default function PhaseTimeline({ clientId }: { clientId: number }) {
  const phases = listClientPhases(clientId);
  const thisWeek = weekStart(localDateStr());

  // Window: from the earliest phase (or two weeks back) to the latest one
  // (or eight weeks ahead), always including the current week, so an empty
  // timeline still shows where "now" is.
  const starts = phases.map((p) => p.start_week);
  const ends = phases.map((p) => p.end_week);
  let first = starts.length ? starts.reduce((a, b) => (a < b ? a : b)) : addWeeks(thisWeek, -2);
  let last = ends.length ? ends.reduce((a, b) => (a > b ? a : b)) : addWeeks(thisWeek, 8);
  if (first > addWeeks(thisWeek, -1)) first = addWeeks(thisWeek, -1);
  if (last < addWeeks(thisWeek, 2)) last = addWeeks(thisWeek, 2);
  const weekCount = weeksBetween(first, last) + 1;
  const weeks = Array.from({ length: weekCount }, (_, i) => addWeeks(first, i));

  // Month header cells: one per run of weeks in the same month.
  const months: { label: string; span: number }[] = [];
  weeks.forEach((w) => {
    const label = monthLabel(w);
    const prev = months[months.length - 1];
    if (prev && prev.label === label) prev.span += 1;
    else months.push({ label, span: 1 });
  });

  const cols = `120px repeat(${weekCount}, minmax(56px, 1fr))`;

  // Phases on one track can't overlap by the coach's own convention (one
  // block at a time), but if two do, each gets its own lane so nothing is
  // hidden behind another bar.
  const lanesFor = (track: string) => {
    const lanes: ClientPhase[][] = [];
    phases
      .filter((p) => p.track === track)
      .forEach((p) => {
        const lane = lanes.find((l) => l.every((q) => q.end_week < p.start_week || q.start_week > p.end_week));
        if (lane) lane.push(p);
        else lanes.push([p]);
      });
    return lanes.length ? lanes : [[]];
  };

  return (
    <section className="ph">
      <div className="ph-head">
        <div>
          <div className="pb-eyebrow">Phases</div>
          <div className="ph-sub">What block {phases.length === 0 ? "the client" : "they"} are in, until when, and what comes next.</div>
        </div>
        <PhaseDialogButton clientId={clientId} defaultStart={thisWeek} defaultEnd={addWeeks(thisWeek, 3)} />
      </div>

      <div className="ph-scroll">
        <div className="ph-grid" style={{ gridTemplateColumns: cols }}>
          {/* Month row */}
          <div className="ph-corner" />
          {months.map((m, i) => (
            <div key={i} className="ph-month" style={{ gridColumn: `span ${m.span}` }}>
              {m.label}
            </div>
          ))}

          {/* Week-number row */}
          <div className="ph-corner ph-corner-weeks">Week</div>
          {weeks.map((w) => (
            <div key={w} className={`ph-week${w === thisWeek ? " now" : ""}`} title={`Week of ${fmtWeek(w)}`}>
              {weekNumber(w)}
            </div>
          ))}

          {/* One grid row per track (and per lane, if bars overlap). Cells
              and bars are placed on the same explicit row so a bar floats
              over its week cells; rows 1 and 2 are the month and week
              headers. */}
          {(() => {
            let row = 3;
            return PHASE_TRACKS.flatMap((track) =>
              lanesFor(track.id).map((lane, laneIndex) => {
                const r = row++;
                return (
                  <div key={`${track.id}-${laneIndex}`} style={{ display: "contents" }}>
                    <div className="ph-track" style={{ gridRow: r, gridColumn: 1 }}>
                      {laneIndex === 0 ? track.label : ""}
                    </div>
                    {weeks.map((w, i) => (
                      <div
                        key={w}
                        className={`ph-cell${w === thisWeek ? " now" : ""}`}
                        style={{ gridRow: r, gridColumn: i + 2 }}
                      />
                    ))}
                    {lane.map((p) => {
                      const startCol = Math.max(0, weeksBetween(first, p.start_week));
                      const endCol = Math.min(weekCount - 1, weeksBetween(first, p.end_week));
                      const tone = TRACK_TONE[p.track];
                      const weeksLong = weeksBetween(p.start_week, p.end_week) + 1;
                      return (
                        <div
                          key={p.id}
                          className="ph-bar-slot"
                          style={{ gridRow: r, gridColumn: `${startCol + 2} / span ${endCol - startCol + 1}` }}
                        >
                          <PhaseDialogButton
                            clientId={clientId}
                            phase={p}
                            bar
                            tone={tone}
                            label={`${p.name} · ${weeksLong} wk${weeksLong === 1 ? "" : "s"} · ${fmtWeek(p.start_week)} to ${fmtWeek(addWeeks(p.end_week, 1))}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })
            );
          })()}
        </div>
      </div>
    </section>
  );
}
