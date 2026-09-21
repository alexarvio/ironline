import Link from "next/link";
import { listClientPhases, listClients, listPrograms, localDateStr, weekStart } from "../lib/queries";
import { phaseChrome } from "./phaseChrome";

// Every client's phases on one week grid: the Plan tab's timeline, a row per
// client. Read-only, and built to answer "whose phase is about to end?" at a
// glance: a phase in its last two weeks is outlined in amber and listed at
// the top. A bar, or a client's name, opens that client's Plan tab, where the
// phases are edited.

const DAY = 86400000;
const parse = (iso: string) => new Date(`${iso}T00:00:00`);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const addWeeks = (monday: string, n: number) => {
  const d = parse(monday);
  d.setDate(d.getDate() + n * 7);
  return iso(d);
};
const weeksBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / (7 * DAY));
const shortDate = (d: string) => parse(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });
const monthName = (d: string) => parse(d).toLocaleDateString("en-US", { month: "short" });
function isoWeek(monday: string): number {
  const d = parse(monday);
  d.setDate(d.getDate() + 3);
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

const TRACKS = ["nutrition", "training", "lifestyle"] as const;
const TRACK_LABEL = { nutrition: "Nutrition", training: "Training", lifestyle: "Lifestyle" } as const;
const WINDOWS = [
  { months: 3, weeks: 13 },
  { months: 6, weeks: 26 },
  { months: 12, weeks: 52 },
];
/** A running phase with this many weeks left, or fewer, is "ending soon". */
const SOON_WEEKS = 2;

export default function PhasesOverviewPanel({ coachId, win }: { coachId: number; win?: string }) {
  // As on the Plan tab: "now" is one fixed line a week and a half in, and the
  // weeks slide under it, so the grid is two weeks wider than what shows.
  const shown = WINDOWS.find((w) => String(w.weeks) === win)?.weeks ?? 13;
  const count = shown + 2;
  const thisWeek = weekStart(localDateStr());
  const first = addWeeks(thisWeek, -2);
  const last = addWeeks(first, count - 1);
  const weeks = Array.from({ length: count }, (_, i) => addWeeks(first, i));
  const nowIdx = 2;
  // How far through this week it is: Monday morning 0, Thursday past a half.
  const now = new Date();
  const intoWeek = (((now.getDay() + 6) % 7) + (now.getHours() + now.getMinutes() / 60) / 24) / 7;
  const nowFrac = 1.5 / shown;
  const months: { label: string; start: number; span: number }[] = [];
  weeks.forEach((w, i) => {
    const label = monthName(w);
    const prev = months[months.length - 1];
    if (prev && prev.label === label) prev.span += 1;
    else months.push({ label, start: i, span: 1 });
  });
  const cols = {
    gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`,
    width: `${(count / shown) * 100}%`,
    transform: `translateX(${-((0.5 + intoWeek) / count) * 100}%)`,
  };

  const clients = listClients(coachId).map((c) => {
    const draftPrograms = new Set(listPrograms(c.id).filter((p) => p.status === "draft").map((p) => p.id));
    const phases = listClientPhases(c.id).map((p) => {
      const running = p.start_week <= thisWeek && p.end_week >= thisWeek;
      const weeksLeft = running ? weeksBetween(thisWeek, p.end_week) + 1 : null;
      // Something already planned to follow it on the same track takes the worry away.
      const followed = listClientPhases(c.id).some((q) => q.track === p.track && q.id !== p.id && q.start_week > p.start_week && q.start_week <= addWeeks(p.end_week, 1));
      return {
        ...p,
        isDraft: !!p.draft || (p.program_id != null && draftPrograms.has(p.program_id)),
        running,
        weeksLeft,
        soon: running && weeksLeft != null && weeksLeft <= SOON_WEEKS && !followed,
      };
    });
    return { id: c.id, name: c.name, phases };
  });

  const endingSoon = clients
    .flatMap((c) => c.phases.filter((p) => p.soon).map((p) => ({ client: c, phase: p })))
    .sort((a, b) => (a.phase.end_week < b.phase.end_week ? -1 : 1));

  return (
    <>
      <div className="fd-head">
        <h1 className="fd-title">Phases</h1>
        <p className="fd-sub">Every client&rsquo;s plan on one timeline. Click a phase to open that client&rsquo;s Plan.</p>
      </div>

      {endingSoon.length > 0 && (
        <section className="pl-card">
          <div className="pl-card-head">
            <div className="pl-card-titles">
              <span className="pl-eyebrow">Ending soon</span>
              <span className="pl-helper">In their last {SOON_WEEKS} weeks, with nothing planned to follow</span>
            </div>
          </div>
          <ul className="ch-list">
            {endingSoon.map(({ client, phase }) => (
              <li key={phase.id}>
                <Link href={`/admin?client=${client.id}&tab=plan`} className="ch-row pho-soon-row">
                  <span className={`pl-track-tag ${phase.track}`}>{TRACK_LABEL[phase.track]}</span>
                  <span className="ch-main">
                    <span className="ch-title">
                      {client.name} · {phase.name}
                    </span>
                    <span className="ch-detail">
                      {phase.weeksLeft === 1 ? "Ends this week" : `${phase.weeksLeft} weeks left`} · last day {shortDate(addWeeks(phase.end_week, 1))}
                    </span>
                  </span>
                  <span className="ch-go">Plan →</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pl-card">
        <div className="pl-card-head">
          <div className="pl-card-titles">
            <span className="pl-eyebrow">All clients</span>
            <span className="pl-helper">
              {shortDate(addWeeks(first, 1))} → {shortDate(last)}
            </span>
          </div>
          <div className="pl-card-tools">
            <div className="pl-seg" role="radiogroup" aria-label="Time shown">
              {WINDOWS.map((w) => (
                <Link
                  key={w.weeks}
                  href={`/admin?view=phases&win=${w.weeks}`}
                  role="radio"
                  aria-checked={shown === w.weeks}
                  className={`pl-seg-btn${shown === w.weeks ? " active" : ""}`}
                  scroll={false}
                >
                  {w.months} months
                </Link>
              ))}
            </div>
          </div>
        </div>

        {clients.length === 0 ? (
          <p className="ch-empty">No clients yet.</p>
        ) : (
          <div className="pl-timeline-scroll">
            <div className="pl-timeline" style={{ minWidth: Math.round(shown * 46) + 230, "--pho-labels": "230px" } as React.CSSProperties}>
              <div className="pho-row">
                <span />
                <div className="pl-tl-clip">
                <div className="pl-tl-grid" style={cols}>
                  {months.map((m) => (
                    <span key={m.start} className="pl-month" style={{ gridColumn: `${m.start + 1} / span ${m.span}` }}>
                      {m.label}
                    </span>
                  ))}
                </div>
                </div>
              </div>
              <div className="pho-row pl-tl-weeks">
                <span />
                <div className="pl-tl-clip">
                <div className="pl-tl-grid" style={cols}>
                  {weeks.map((w, i) => (
                    <span key={w} className={`pl-week${i === nowIdx ? " now" : ""}`}>
                      <b>{isoWeek(w)}</b>
                      {shown <= 26 && <small>{shortDate(w)}</small>}
                    </span>
                  ))}
                </div>
                </div>
              </div>

              {/* Below the week numbers: the clients, and over all of them one
                  unbroken line for now, placed by the day of the week it is. */}
              <div className="pho-body">
                <span className="pho-now" style={{ left: `calc(var(--pho-labels) + (100% - var(--pho-labels)) * ${nowFrac})` }} title="Now" />
                {clients.map((c) => (
                  <div key={c.id} className="pho-client">
                    <Link href={`/admin?client=${c.id}&tab=plan`} className="pho-name" title={`Open ${c.name}'s Plan`}>
                      {c.name}
                      {c.phases.some((p) => p.soon) && <span className="ad-new-dot" title="A phase is about to end" />}
                    </Link>
                    <div className="pho-tracks">
                      {/* Always the same three rows, in the same order, filled or not. */}
                      {TRACKS.map((t) => {
                        const mine = c.phases.filter((p) => p.track === t && p.end_week >= first && p.start_week <= last);
                        // Two phases on one track over the same weeks share the row's height.
                        const lanes: (typeof c.phases)[] = [];
                        for (const p of mine) {
                          let lane = lanes.find((r) => r.every((q) => q.end_week < p.start_week || q.start_week > p.end_week));
                          if (!lane) lanes.push((lane = []));
                          lane.push(p);
                        }
                        const laneCount = Math.max(1, lanes.length);
                        return (
                          <div key={t} className="pho-track">
                            <span className={`pho-track-label ${t}`}>{TRACK_LABEL[t]}</span>
                            <div className="pl-tl-clip">
                            <div className="pl-tl-grid pho-lanes" style={{ ...cols, gridTemplateRows: `repeat(${laneCount}, 22px)` }}>
                              {weeks.map((w, i) => (
                                <span key={w} className="pl-cell" style={{ gridColumn: i + 1, gridRow: `1 / span ${laneCount}` }} />
                              ))}
                              {lanes.map((lane, li) =>
                                lane.map((p) => {
                                  const from = Math.max(0, weeksBetween(first, p.start_week));
                                  const to = Math.min(count - 1, weeksBetween(first, p.end_week));
                                  const total = weeksBetween(p.start_week, p.end_week) + 1;
                                  // Coloured by state, as on the client's Plan tab (phaseChrome).
                                  const chrome = phaseChrome(p.track, p.isDraft ? "draft" : p.running ? "live" : p.start_week > thisWeek ? "scheduled" : "past");
                                  const state = p.isDraft ? "draft" : p.running ? `week ${weeksBetween(p.start_week, thisWeek) + 1} of ${total}` : p.start_week > thisWeek ? `starts ${shortDate(p.start_week)}` : "done";
                                  return (
                                    <Link
                                      key={p.id}
                                      href={`/admin?client=${c.id}&tab=plan`}
                                      className={`pl-bar pho-bar ${p.track}${p.isDraft ? " draft" : ""}${p.soon ? " soon" : ""}${weeksBetween(first, p.start_week) < 0 ? " clip-start" : ""}${weeksBetween(first, p.end_week) > count - 1 ? " clip-end" : ""}`}
                                      // A bar that starts under the clipped left edge keeps its name in view.
                                      // An ending-soon bar keeps its orange outline; every other bar takes its state's.
                                      style={{ gridColumn: `${from + 1} / span ${to - from + 1}`, gridRow: li + 1, paddingLeft: `calc(8px + ${(Math.max(0, 0.5 + intoWeek - from) / (to - from + 1)) * 100}%)`, background: chrome.band, color: chrome.edge, ...(p.soon ? {} : { borderColor: chrome.line, borderStyle: chrome.dashed ? "dashed" : "solid" }) }}
                                      title={`${c.name} · ${TRACK_LABEL[p.track]} · ${p.name} · ${total} wk, ${shortDate(p.start_week)} → ${shortDate(addWeeks(p.end_week, 1))} · ${state}`}
                                    >
                                      <span className="pl-bar-name">{p.name}</span>
                                      {p.soon && <span className="pho-left">{p.weeksLeft === 1 ? "last wk" : `${p.weeksLeft} wk left`}</span>}
                                    </Link>
                                  );
                                })
                              )}
                            </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="pl-legend">
          {TRACKS.map((t) => (
            <span key={t}>
              <i className={`pho-swatch ${t}`} /> {TRACK_LABEL[t].toLowerCase()}
            </span>
          ))}
          <span>
            <i className="pl-legend-swatch draft" /> draft not deployed
          </span>
          <span>
            <i className="pho-swatch soon" /> ending soon
          </span>
          <span>
            <i className="pl-legend-swatch now" /> this week
          </span>
        </div>
      </section>
    </>
  );
}
