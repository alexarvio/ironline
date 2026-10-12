import Link from "next/link";
import Pager from "../Pager";
import ClientFilter from "./ClientFilter";
import { requireCoach, isOwner } from "../../../lib/auth";
import { feedClock, getActivityFeed, getClientHome, listLoginLocks, localDateStr, type FeedCategory, type FeedEvent, type HomeAction } from "../../../lib/queries";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/basics";
import { feedHref, loadRail, type RailClient } from "../loaders";
import RedesignRail from "../RedesignRail";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../rail.css";
import "./feed.css";

// The Feed in the redesign, the rail on its left (replaces /admin?view=feed).
// Two lanes (12 Oct; before, one log of everything):
// - Needs you: what is waiting on the coach, across every client, oldest
//   first so nothing is left. The same list each client's Home spells out
//   (getClientHome), so the rail's dot, Home and this agree. A row leaves
//   once it is dealt with (replied, booked, paid, logged), not once looked at.
// - Activity: everything clients log, newest first, one kind at a time,
//   grouped by day and folded to one row per client per day (three sessions
//   from one client read as one line; open it for each). All clients or one.
// Sign-in lockouts between the two.
//   /admin/redesign/feed?cat=training&client=12&page=2
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
const TONE_LABEL: Record<HomeAction["tone"], string> = { urgent: "Urgent", due: "Due", note: "To read" };
const TAB_LABEL: Record<string, string> = { plan: "Plan", training: "Training", nutrition: "Nutrition", measurements: "Measurements", meetings: "Meetings", photos: "Progress pictures", messages: "Messages", invoices: "Invoices" };
const TAB_ROUTE: Record<string, string> = { photos: "pictures" };
const PAGE = 20;
const DAY_MS = 24 * 60 * 60 * 1000;
const matches = (e: FeedEvent, filter: FilterId) => (FILTERS.find((f) => f.id === filter)!.holds as readonly FeedCategory[]).includes(e.category);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Need = { client: RailClient; action: HomeAction; to: string };
/** One client's doings on one day, newest first inside. */
type Group = { key: string; day: string; clientId: number; clientName: string; events: FeedEvent[] };

/** "just now", "3 hours", "4 days": how long something has been waiting. */
function waiting(at: number | undefined, now: number): string | null {
  if (at == null) return null;
  const ms = now - at;
  if (ms < 60 * 60 * 1000) return "just now";
  if (ms < DAY_MS) {
    const h = Math.floor(ms / (60 * 60 * 1000));
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.floor(ms / DAY_MS);
  return `${d} day${d === 1 ? "" : "s"}`;
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ cat?: string; client?: string; page?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const rail = loadRail(coach);
  const clientId = rail.clients.some((c) => String(c.id) === params.client) ? Number(params.client) : null;
  const everything = getActivityFeed(coach.id);
  const all = everything.filter((e) => clientId == null || e.clientId === clientId);
  const locks = listLoginLocks({ id: coach.id, email: coach.email }, isOwner(coach));
  const filter: FilterId = FILTERS.some((f) => f.id === params.cat) ? (params.cat as FilterId) : FILTERS[0].id;
  // eslint-disable-next-line react-hooks/purity -- a server render reads the clock once, on purpose
  const now = Date.now();
  const today = localDateStr();
  const yesterday = localDateStr(new Date(now - DAY_MS));

  // ---- Needs you: every client's open items, urgent first, then the one
  // waiting longest. A row opens on exactly what it is about when an event
  // carries it, else on the tab that deals with it.
  const byId = new Map(everything.map((e) => [e.id, e] as const));
  const needHref = (c: RailClient, a: HomeAction): string => {
    if (a.href) return a.href;
    const ev = a.eventId ? byId.get(a.eventId) : undefined;
    const exact = ev ? feedHref(ev) : null;
    if (exact) return exact;
    return `/admin/redesign/${a.tab ? TAB_ROUTE[a.tab] ?? a.tab : "home"}?client=${c.id}`;
  };
  const needs: Need[] = rail.clients
    .filter((c) => clientId == null || c.id === clientId)
    .flatMap((c) => getClientHome(c.id, everything).actions.map((action) => ({ client: c, action, to: needHref(c, action) })))
    .sort((x, y) => (x.action.tone === "urgent" ? 0 : 1) - (y.action.tone === "urgent" ? 0 : 1) || (x.action.at ?? now) - (y.action.at ?? now));
  const needClients = new Set(needs.map((n) => n.client.id)).size;

  // ---- Activity: the kind on, by day, one row per client per day.
  const events = all.filter((e) => matches(e, filter));
  const groups: Group[] = [];
  const groupAt = new Map<string, Group>();
  for (const e of events) {
    const day = localDateStr(new Date(e.at));
    const key = `${day}|${e.clientId}`;
    let g = groupAt.get(key);
    if (!g) {
      g = { key, day, clientId: e.clientId, clientName: e.clientName, events: [] };
      groupAt.set(key, g);
      groups.push(g);
    }
    g.events.push(e);
  }
  const pages = Math.max(1, Math.ceil(groups.length / PAGE));
  const page = Math.min(Math.max(1, Math.floor(Number(params.page)) || 1), pages);
  const from = (page - 1) * PAGE;
  const visible = groups.slice(from, from + PAGE);
  // The page's groups under their days, in order.
  const days: { day: string; groups: Group[] }[] = [];
  for (const g of visible) {
    const last = days[days.length - 1];
    if (last && last.day === g.day) last.groups.push(g);
    else days.push({ day: g.day, groups: [g] });
  }
  const dayLabel = (day: string) => {
    if (day === today) return "Today";
    if (day === yesterday) return "Yesterday";
    const [y, m, d] = day.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };
  const weekAgo = now - 7 * DAY_MS;
  const recent = (f: FilterId) => all.filter((e) => matches(e, f) && e.at >= weekAgo).length;
  const href = (f: FilterId, n = 1, client: number | null = clientId) => `/admin/redesign/feed?cat=${f}${client != null ? `&client=${client}` : ""}${n > 1 ? `&page=${n}` : ""}`;
  const avatar = new Map(rail.clients.map((c) => [c.id, c.avatarPath]));
  const clock = (e: FeedEvent) => (e.timeKnown ? feedClock(e.at) : "");

  const who = (id: number, name: string) => (
    <span className="rfd-who">
      <span className="rfd-avatar" aria-hidden="true">
        {avatar.get(id) ? (
          // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
          <img src={avatar.get(id)!} alt="" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <b>{name}</b>
    </span>
  );

  // One event: who (blank inside a fold), what kind, what, when.
  const eventRow = (e: FeedEvent, inFold: boolean) => {
    const to = feedHref(e);
    const body = (
      <>
        {inFold ? <span /> : who(e.clientId, e.clientName)}
        <Badge className={`rfd-cat ${e.category}`}>{CATEGORY_LABEL[e.category]}</Badge>
        <span className="rfd-main">
          <span className="rfd-text">{cap(e.text)}</span>
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
        <span className="rfd-when">{clock(e)}</span>
      </>
    );
    // Nothing to open for a client who deleted their account: the row just reads.
    return to ? (
      <Link key={e.id} href={to} className={`rfd-row${inFold ? " in-fold" : ""}`}>
        {body}
      </Link>
    ) : (
      <div key={e.id} className={`rfd-row still${inFold ? " in-fold" : ""}`}>
        {body}
      </div>
    );
  };

  return (
    <div className="rd-frame">
      <RedesignRail rail={rail} clientId={0} />
      <div className="rd-page">
        <div className="rfd">
          <header className="rfd-head">
            <h1 className="rfd-title">Feed</h1>
            <ClientFilter value={clientId == null ? "" : String(clientId)} clients={rail.clients} hrefFor={Object.fromEntries([["", href(filter, 1, null)], ...rail.clients.map((c) => [String(c.id), href(filter, 1, c.id)])])} />
          </header>

          {/* ---- Needs you */}
          <section className="rfd-lane">
            <h2 className="rfd-lane-title">
              Needs you
              <span>
                {needs.length === 0
                  ? " · nothing is waiting on you"
                  : ` · ${needs.length} open item${needs.length === 1 ? "" : "s"}${clientId == null ? ` across ${needClients} client${needClients === 1 ? "" : "s"}` : ""}`}
              </span>
            </h2>
            {needs.length > 0 && (
              <Card className="rfd-card">
                <CardContent className="rfd-rows">
                  {needs.map(({ client, action, to }) => {
                    const since = waiting(action.at, now);
                    return (
                      <Link key={`${client.id}-${action.id}`} href={to} className="rfd-row rfd-need">
                        {who(client.id, client.name)}
                        <span className={`rfd-tone ${action.tone}`}>{TONE_LABEL[action.tone]}</span>
                        <span className="rfd-main">
                          <span className="rfd-text">
                            <b>{action.title}</b>
                          </span>
                          {action.detail && <span className={`rfd-detail${action.tone === "note" ? " quote" : ""}`}>{action.tone === "note" ? <>&ldquo;{action.detail}&rdquo;</> : action.detail}</span>}
                        </span>
                        {action.tab && <span className="rfd-tab">{TAB_LABEL[action.tab] ?? action.tab}</span>}
                        <span className="rfd-when">{since ? (since === "just now" ? since : `${since} waiting`) : ""}</span>
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </section>

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

          {/* ---- Activity */}
          <section className="rfd-lane">
            <div className="rfd-lane-head">
              <h2 className="rfd-lane-title">Activity</h2>
              {/* The kinds, each with how much came in over the last 7 days. */}
              <nav className="rfd-filters" aria-label="Filter the activity">
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
            </div>

            {visible.length === 0 ? (
              <p className="rfd-empty">
                Nothing under {FILTERS.find((f) => f.id === filter)!.label.toLowerCase()}
                {clientId != null ? ` from ${rail.clients.find((c) => c.id === clientId)?.name}` : ""} yet.
              </p>
            ) : (
              days.map(({ day, groups: dayGroups }) => (
                <div key={day} className="rfd-day">
                  <h3 className="rfd-day-label">{dayLabel(day)}</h3>
                  <Card className="rfd-card">
                    <CardContent className="rfd-rows">
                      {dayGroups.map((g) => {
                        if (g.events.length === 1) return eventRow(g.events[0], false);
                        // Several from one client in a day: one line, the
                        // things in order, each opening inside.
                        const kinds = [...new Set(g.events.map((e) => e.category))];
                        const texts = g.events.map((e) => cap(e.text));
                        const shown = texts.slice(0, 3);
                        const more = texts.length - shown.length;
                        return (
                          <details key={g.key} className="rfd-fold">
                            <summary className="rfd-row rfd-fold-sum">
                              {who(g.clientId, g.clientName)}
                              <span className="rfd-kinds">
                                {kinds.map((k) => (
                                  <Badge key={k} className={`rfd-cat ${k}`}>
                                    {CATEGORY_LABEL[k]}
                                  </Badge>
                                ))}
                              </span>
                              <span className="rfd-main">
                                <span className="rfd-text">
                                  <b>{g.events.length} things</b> · {shown.join(" · ")}
                                  {more > 0 && ` · and ${more} more`}
                                </span>
                              </span>
                              <span className="rfd-when">{clock(g.events[0])}</span>
                            </summary>
                            <div className="rfd-fold-body">{g.events.map((e) => eventRow(e, true))}</div>
                          </details>
                        );
                      })}
                    </CardContent>
                  </Card>
                </div>
              ))
            )}

            <Pager page={page} pages={pages} from={from} shown={visible.length} total={groups.length} label="Activity pages" href={(n) => href(filter, n)} />
          </section>
        </div>
      </div>
    </div>
  );
}
