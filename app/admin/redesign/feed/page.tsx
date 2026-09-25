import Link from "next/link";
import { requireCoach, isOwner } from "../../../lib/auth";
import { feedClock, getActivityFeed, listLoginLocks, localDateStr, type FeedCategory, type FeedEvent } from "../../../lib/queries";
import { pageWindow } from "../../../lib/pager";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/basics";
import { loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../rail.css";
import "./feed.css";

// Everything clients log, across all clients, newest first and grouped by
// day, one kind at a time, fifteen to a page: the Feed in the redesign, the
// rail on its left (replaces /admin?view=feed). Sign-in lockouts sit on top.
//   /admin/redesign/feed?cat=training&page=2
export const dynamic = "force-dynamic";

// No "All": a single stream of everything was a list nobody finished. Every
// source category has a home: a note on the programme is training, an
// invoice is billing.
const FILTERS = [
  { id: "training", label: "Training", holds: ["training", "notes"] },
  { id: "nutrition", label: "Nutrition", holds: ["nutrition"] },
  { id: "measurements", label: "Measurements", holds: ["measurements"] },
  { id: "invoices", label: "Invoices", holds: ["billing"] },
  { id: "messages", label: "Messages", holds: ["messages"] },
] as const satisfies readonly { id: string; label: string; holds: readonly FeedCategory[] }[];
type FilterId = (typeof FILTERS)[number]["id"];
const CATEGORY_LABEL: Record<FeedCategory, string> = { training: "Training", nutrition: "Nutrition", measurements: "Measurements", notes: "Note", billing: "Invoice", messages: "Message" };
const PAGE = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const matches = (e: FeedEvent, filter: FilterId) => (FILTERS.find((f) => f.id === filter)!.holds as readonly FeedCategory[]).includes(e.category);

function dayHeading(day: string, today: string, yesterday: string) {
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ cat?: string; page?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const all = getActivityFeed(coach.id);
  const locks = listLoginLocks({ id: coach.id, email: coach.email }, isOwner(coach));
  const filter: FilterId = FILTERS.some((f) => f.id === params.cat) ? (params.cat as FilterId) : FILTERS[0].id;
  const events = all.filter((e) => matches(e, filter));
  const pages = Math.max(1, Math.ceil(events.length / PAGE));
  const page = Math.min(Math.max(1, Math.floor(Number(params.page)) || 1), pages);
  const from = (page - 1) * PAGE;
  const visible = events.slice(from, from + PAGE);
  // eslint-disable-next-line react-hooks/purity -- a server render reads the clock once, on purpose
  const now = Date.now();
  const weekAgo = now - 7 * DAY_MS;
  const recent = (f: FilterId) => all.filter((e) => matches(e, f) && e.at >= weekAgo).length;
  const href = (f: FilterId, n = 1) => `/admin/redesign/feed?cat=${f}${n > 1 ? `&page=${n}` : ""}`;
  const today = localDateStr();
  const yesterday = localDateStr(new Date(now - DAY_MS));
  const days: { day: string; events: FeedEvent[] }[] = [];
  for (const e of visible) {
    const day = localDateStr(new Date(e.at));
    const last = days[days.length - 1];
    if (last?.day === day) last.events.push(e);
    else days.push({ day, events: [e] });
  }

  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <div className="rd-page">
        <div className="rfd">
          <header className="rfd-head">
            <h1 className="rfd-title">Feed</h1>
            {/* The kinds, each with how much came in over the last 7 days. */}
            <nav className="rfd-filters" aria-label="Filter the feed">
              {FILTERS.map((f) => {
                const n = recent(f.id);
                return (
                  <Link key={f.id} href={href(f.id)} scroll={false} className={`rfd-filter${filter === f.id ? " on" : ""}`} aria-current={filter === f.id ? "page" : undefined}>
                    {f.label}
                    {n > 0 && (
                      <Badge className="rfd-count" title={`${f.label} in the last 7 days`}>
                        {n}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </header>

          {/* Someone can't get in, or someone was guessing a password. */}
          {locks.length > 0 && (
            <Card className="rfd-locks">
              <CardHeader>
                <CardTitle>Sign-in lockouts</CardTitle>
                <CardDescription>Last 7 days</CardDescription>
              </CardHeader>
              <CardContent className="rfd-lock-list">
                {locks.map((l) => (
                  <div key={l.id} className="rfd-lock">
                    <span className={`rfd-lock-dot${l.active ? " on" : ""}`} aria-hidden="true" />
                    <div>
                      <div className="rfd-lock-text">
                        {l.clientId != null ? <Link href={`/admin/redesign/home?client=${l.clientId}`}>{l.who}</Link> : <b>{l.who}</b>} was locked out for 15 minutes after{" "}
                        {l.scope === "device" ? "3 wrong passwords from one device" : "10 wrong passwords from different devices"}.
                      </div>
                      <div className="rfd-lock-meta">
                        {new Date(l.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {feedClock(new Date(l.at).getTime())} · {l.email} · IP {l.ip}
                        {l.active ? " · still locked" : l.cleared ? " · unlocked" : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {visible.length === 0 ? (
            <p className="rfd-empty">Nothing under {FILTERS.find((f) => f.id === filter)!.label.toLowerCase()} yet.</p>
          ) : (
            days.map(({ day, events: rows }) => (
              <section key={day} className="rfd-day">
                <h2 className="rfd-day-label">{dayHeading(day, today, yesterday)}</h2>
                <Card className="rfd-card">
                  <CardContent className="rfd-rows">
                    {rows.map((e) => (
                      <Link key={e.id} href={`/admin?client=${e.clientId}&tab=${e.tab}`} className="rfd-row">
                        <Badge className={`rfd-cat ${e.category}`}>{CATEGORY_LABEL[e.category]}</Badge>
                        <span className="rfd-main">
                          <span className="rfd-text">
                            <b>{e.clientName}</b> {e.text}
                          </span>
                          {e.note && <span className="rfd-note">&ldquo;{e.note}&rdquo;</span>}
                          {e.thumbs.length > 0 && (
                            <span className="rfd-thumbs" aria-hidden="true">
                              {e.thumbs.slice(0, 5).map((src) => (
                                // eslint-disable-next-line @next/next/no-img-element -- uploads served by the app's own route
                                <img key={src} src={src} alt="" className="rfd-thumb" />
                              ))}
                            </span>
                          )}
                        </span>
                        <span className="rfd-when">{e.timeKnown ? feedClock(e.at) : ""}</span>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              </section>
            ))
          )}

          {pages > 1 && (
            <nav className="rfd-pager" aria-label="Feed pages">
              {page > 1 ? (
                <Link href={href(filter, page - 1)} scroll={false} className="rfd-page" aria-label="Newer">
                  ‹
                </Link>
              ) : (
                <span className="rfd-page off" aria-hidden="true">
                  ‹
                </span>
              )}
              {pageWindow(page, pages).map((n, i) =>
                n === "gap" ? (
                  <span key={`gap${i}`} className="rfd-gap" aria-hidden="true">
                    …
                  </span>
                ) : (
                  <Link key={n} href={href(filter, n)} scroll={false} className={`rfd-page${n === page ? " on" : ""}`} aria-current={n === page ? "page" : undefined}>
                    {n}
                  </Link>
                )
              )}
              {page < pages ? (
                <Link href={href(filter, page + 1)} scroll={false} className="rfd-page" aria-label="Older">
                  ›
                </Link>
              ) : (
                <span className="rfd-page off" aria-hidden="true">
                  ›
                </span>
              )}
              <span className="rfd-pager-count">
                {from + 1}–{from + visible.length} of {events.length}
              </span>
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
