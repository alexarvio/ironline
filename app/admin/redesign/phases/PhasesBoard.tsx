"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, ToggleGroup, ToggleGroupItem } from "../../../components/ui/basics";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../../components/ui/dialog";
import { phaseChrome, STATE_LABEL, TRACK_LABEL } from "../../phaseChrome";
import type { BoardCategory, BoardClient, BoardEvent, BoardPhase, PhasesBoardData } from "./load";

// Every client's plan on one timeline: a block a client, a row a track
// (training, nutrition, lifestyle) and a row for their events (trips,
// illness, their coach's own categories). Read-only: a bar opens its detail,
// and from there the client's Plan, where things are edited. Phases in their
// last two weeks with nothing to follow are listed on top.

const TRACKS = ["training", "nutrition", "lifestyle"] as const;
const WINDOWS = [
  { weeks: 13, label: "3 months" },
  { weeks: 26, label: "6 months" },
  { weeks: 52, label: "12 months" },
];
const DAY = 86400000;
const dayNum = (s: string) => Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / DAY;
const short = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** The eight colours an event category wears (EventsCard's palette). */
const PALETTE: Record<string, { tint: string; ink: string; line: string }> = {
  blue: { tint: "#e3f0fb", ink: "#1d5a94", line: "#9cc3e6" },
  orange: { tint: "#fdf3ee", ink: "#b3471d", line: "#e5b39a" },
  purple: { tint: "#f1e9fb", ink: "#5a3d9a", line: "#c9b5ea" },
  navy: { tint: "#e6ecf3", ink: "#1e3a6e", line: "#b8c6d9" },
  green: { tint: "#dff3ea", ink: "#1b7a4b", line: "#9fd3bb" },
  amber: { tint: "#fff3dc", ink: "#8a5a12", line: "#e7cf9a" },
  rose: { tint: "#fbe9ee", ink: "#9b2c4a", line: "#e7a9b8" },
  teal: { tint: "#e0f2f2", ink: "#146b6b", line: "#9dd0d0" },
};
const NONE = { tint: "#eceff3", ink: "#5b6474", line: "#c3c9d2" };
const eventChrome = (cats: BoardCategory[], kind: string | null) => {
  const c = kind ? cats.find((x) => x.id === kind) : null;
  return c ? { label: c.label, ...(PALETTE[c.color] ?? PALETTE.blue) } : { label: "Event", ...NONE };
};

type Picked = { client: BoardClient; phase: BoardPhase } | { client: BoardClient; event: BoardEvent } | null;

/** Bars that overlap on a row share it in lanes, one above the other. */
function lanesOf<T extends { start: string; end: string }>(items: T[]): T[][] {
  const lanes: T[][] = [];
  for (const it of [...items].sort((a, b) => (a.start < b.start ? -1 : 1))) {
    let lane = lanes.find((l) => l.every((x) => x.end < it.start || x.start > it.end));
    if (!lane) lanes.push((lane = []));
    lane.push(it);
  }
  return lanes;
}

export default function PhasesBoard({ data }: { data: PhasesBoardData }) {
  const [win, setWin] = useState(13);
  const [picked, setPicked] = useState<Picked>(null);

  // The window: from the Monday a week before this one, `win` weeks on.
  const today = dayNum(data.today);
  const monday = today - ((new Date(data.today + "T00:00:00").getDay() + 6) % 7);
  const first = monday - 7;
  const total = win * 7;
  const last = first + total - 1;
  const pct = (n: number) => `${((n - first) / total) * 100}%`;
  const span = (s: string, e: string) => {
    const a = Math.max(first, dayNum(s));
    const b = Math.min(last, dayNum(e));
    return b < a ? null : { left: pct(a), width: `${((b - a + 1) / total) * 100}%`, clipStart: dayNum(s) < first, clipEnd: dayNum(e) > last };
  };
  // Month labels over the weeks.
  const months: { label: string; left: string }[] = [];
  for (let n = first; n <= last; n++) {
    const d = new Date(n * DAY);
    if (d.getUTCDate() === 1 || n === first) months.push({ label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }), left: pct(n) });
  }
  const gridStyle = { backgroundSize: `${(7 / total) * 100}% 100%` };

  const endingSoon = data.clients
    .flatMap((c) => c.phases.filter((p) => p.soon).map((p) => ({ client: c, phase: p })))
    .sort((a, b) => (a.phase.end < b.phase.end ? -1 : 1));
  const usedKinds = new Set(data.clients.flatMap((c) => c.events.map((e) => e.kind)));

  return (
    <div className="pbd">
      <header className="pbd-head">
        <div>
          <h1 className="pbd-title">Phases</h1>
          <p className="pbd-sub">Every client&rsquo;s plan and events on one timeline. Click a bar for its details.</p>
        </div>
        <ToggleGroup type="single" value={String(win)} onValueChange={(v) => v && setWin(Number(v))} aria-label="Time shown">
          {WINDOWS.map((w) => (
            <ToggleGroupItem key={w.weeks} value={String(w.weeks)}>
              {w.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </header>

      {endingSoon.length > 0 && (
        <Card className="pbd-card">
          <CardHeader>
            <CardTitle>Ending soon</CardTitle>
            <CardDescription>In their last two weeks, with nothing planned to follow</CardDescription>
          </CardHeader>
          <CardContent className="pbd-soon">
            {endingSoon.map(({ client, phase }) => (
              <button key={phase.id} type="button" className="pbd-soon-row" onClick={() => setPicked({ client, phase })}>
                <Badge className={`pbd-track ${phase.track}`}>{TRACK_LABEL[phase.track]}</Badge>
                <span className="pbd-soon-name">
                  <b>{client.name}</b> · {phase.name}
                </span>
                <span className="pbd-soon-left">{phase.weeksLeft === 1 ? "Ends this week" : `${phase.weeksLeft} weeks left`} · last day {short(phase.end)}</span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="pbd-card">
        <CardHeader>
          <CardTitle>All clients</CardTitle>
        </CardHeader>
        <CardContent>
          {data.clients.length === 0 ? (
            <p className="pbd-empty">No clients yet.</p>
          ) : (
            <div className="pbd-board" style={{ "--pbd-now": ((today - first) / total).toString() } as React.CSSProperties}>
              {/* Today's pill on a row of its own above the months, so it never
                  covers a month's name; its line runs unbroken down every client. */}
              <div className="pbd-row pbd-today-row">
                <span />
                <div className="pbd-track-area">
                  <span className="pbd-now-label" style={{ left: pct(today) }}>
                    Today
                  </span>
                </div>
              </div>
              <span className="pbd-now-line" aria-hidden="true" />
              {/* The months along the top, over the same track width as the rows. */}
              <div className="pbd-row pbd-months">
                <span />
                <div className="pbd-track-area">
                  {months.map((m) => (
                    <span key={m.left} className="pbd-month" style={{ left: m.left }}>
                      {m.label}
                    </span>
                  ))}
                </div>
              </div>

              {data.clients.map((c) => (
                <section key={c.id} className="pbd-client">
                  <Link href={`/admin/redesign/plan?client=${c.id}`} className="pbd-client-name" title={`Open ${c.name}'s Plan`}>
                    {c.name}
                    {c.phases.some((p) => p.soon) && <i className="pbd-dot" title="A phase is about to end" />}
                  </Link>
                  {[...TRACKS, "events" as const].map((row) => {
                    const items: { key: string; start: string; end: string; phase?: BoardPhase; event?: BoardEvent }[] =
                      row === "events"
                        ? c.events.map((e) => ({ key: `e${e.id}`, start: e.start, end: e.end, event: e }))
                        : c.phases.filter((p) => p.track === row).map((p) => ({ key: `p${p.id}`, start: p.start, end: p.end, phase: p }));
                    const lanes = lanesOf(items.filter((i) => span(i.start, i.end)));
                    return (
                      <div key={row} className="pbd-row">
                        <span className={`pbd-row-label ${row}`}>{row === "events" ? "Events" : TRACK_LABEL[row]}</span>
                        <div className="pbd-track-area pbd-grid" style={{ ...gridStyle, height: `${Math.max(1, lanes.length) * 26 + 4}px` }}>
                          {lanes.map((lane, li) =>
                            lane.map((it) => {
                              const sp = span(it.start, it.end)!;
                              const top = 2 + li * 26;
                              if (it.phase) {
                                const p = it.phase;
                                const ch = phaseChrome(p.track, p.state);
                                return (
                                  <button
                                    key={it.key}
                                    type="button"
                                    className={`pbd-bar${p.soon ? " soon" : ""}${sp.clipStart ? " clip-start" : ""}${sp.clipEnd ? " clip-end" : ""}`}
                                    style={{ left: sp.left, width: sp.width, top, background: ch.band, color: ch.edge, borderColor: p.soon ? undefined : ch.line, borderStyle: ch.dashed ? "dashed" : "solid" }}
                                    onClick={() => setPicked({ client: c, phase: p })}
                                    title={`${c.name} · ${TRACK_LABEL[p.track]} · ${p.name} · ${short(p.start)} – ${short(p.end)}`}
                                  >
                                    <span>{p.name}</span>
                                    {p.soon && <em>{p.weeksLeft === 1 ? "last wk" : `${p.weeksLeft} wk left`}</em>}
                                  </button>
                                );
                              }
                              const e = it.event!;
                              const ch = eventChrome(data.categories, e.kind);
                              return (
                                <button
                                  key={it.key}
                                  type="button"
                                  className={`pbd-bar event${sp.clipStart ? " clip-start" : ""}${sp.clipEnd ? " clip-end" : ""}`}
                                  style={{ left: sp.left, width: sp.width, top, background: ch.tint, color: ch.ink, borderColor: ch.line }}
                                  onClick={() => setPicked({ client: c, event: e })}
                                  title={`${c.name} · ${ch.label} · ${e.title} · ${short(e.start)}${e.end !== e.start ? ` – ${short(e.end)}` : ""}`}
                                >
                                  <span>{e.title}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>
          )}

          {/* What the colours mean. */}
          <div className="pbd-legend">
            {TRACKS.map((t) => {
              const ch = phaseChrome(t, "live");
              return (
                <span key={t}>
                  <i style={{ background: ch.band, borderColor: ch.line }} /> {TRACK_LABEL[t]} (live)
                </span>
              );
            })}
            <span>
              <i style={{ background: phaseChrome("training", "scheduled").band, borderColor: phaseChrome("training", "scheduled").line }} /> Scheduled
            </span>
            <span>
              <i style={{ background: phaseChrome("training", "draft").band, borderColor: phaseChrome("training", "draft").line, borderStyle: "dashed" }} /> Draft
            </span>
            <span>
              <i className="soon" /> Ending soon
            </span>
            {data.categories
              .filter((cat) => usedKinds.has(cat.id))
              .map((cat) => {
                const ch = eventChrome(data.categories, cat.id);
                return (
                  <span key={cat.id}>
                    <i style={{ background: ch.tint, borderColor: ch.line }} /> {cat.label}
                  </span>
                );
              })}
          </div>
        </CardContent>
      </Card>

      {/* A bar's detail, and the way to the client's Plan. */}
      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        {picked && (
          <DialogContent className="rd-dlg">
            {"phase" in picked ? (
              <>
                <DialogHeader>
                  <DialogTitle>{picked.phase.name}</DialogTitle>
                  <DialogDescription>
                    {picked.client.name} · {TRACK_LABEL[picked.phase.track]} phase
                  </DialogDescription>
                </DialogHeader>
                <dl className="pbd-facts">
                  <div>
                    <dt>State</dt>
                    <dd>{picked.phase.weekOf ?? STATE_LABEL[picked.phase.state]}</dd>
                  </div>
                  <div>
                    <dt>Dates</dt>
                    <dd>
                      {short(picked.phase.start)} – {short(picked.phase.end)} · {picked.phase.weeks} weeks
                    </dd>
                  </div>
                  {picked.phase.weeksLeft != null && (
                    <div>
                      <dt>Left</dt>
                      <dd>{picked.phase.weeksLeft === 1 ? "This is the last week" : `${picked.phase.weeksLeft} weeks`}</dd>
                    </div>
                  )}
                </dl>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>{picked.event.title}</DialogTitle>
                  <DialogDescription>
                    {picked.client.name} · {eventChrome(data.categories, picked.event.kind).label}
                  </DialogDescription>
                </DialogHeader>
                <dl className="pbd-facts">
                  <div>
                    <dt>Dates</dt>
                    <dd>
                      {short(picked.event.start)}
                      {picked.event.end !== picked.event.start && ` – ${short(picked.event.end)}`}
                    </dd>
                  </div>
                  {picked.event.note && (
                    <div>
                      <dt>Note</dt>
                      <dd>{picked.event.note}</dd>
                    </div>
                  )}
                </dl>
              </>
            )}
            <DialogFooter>
              <Link className="rd-btn primary" href={`/admin/redesign/plan?client=${picked.client.id}`}>
                Open {picked.client.name.split(" ")[0]}&rsquo;s Plan
              </Link>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
