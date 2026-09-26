import Link from "next/link";
import Pager from "../Pager";
import ClientFilter from "./ClientFilter";
import { requireCoach, isOwner } from "../../../lib/auth";
import { feedClock, getActivityFeed, listLoginLocks, localDateStr, type FeedCategory, type FeedEvent } from "../../../lib/queries";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../components/ui/basics";
import { feedHref, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../rail.css";
import "./feed.css";

// Everything clients log, newest first, one kind at a time, fifteen to a
// page: the Feed in the redesign, the rail on its left (replaces
// /admin?view=feed). One table whatever the kind, so every page has the same
// shape: who, what, when (26 Sep; it used to be a card a day, which made
// each kind a different length). All clients or one. Sign-in lockouts on top.
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
const PAGE = 15;
const DAY_MS = 24 * 60 * 60 * 1000;
const matches = (e: FeedEvent, filter: FilterId) => (FILTERS.find((f) => f.id === filter)!.holds as readonly FeedCategory[]).includes(e.category);


export default async function FeedPage({ searchParams }: { searchParams: Promise<{ cat?: string; client?: string; page?: string }> }) {
  const coach = await requireCoach();
  const params = await searchParams;
  const rail = loadRail(coach);
  const clientId = rail.clients.some((c) => String(c.id) === params.client) ? Number(params.client) : null;
  const all = getActivityFeed(coach.id).filter((e) => clientId == null || e.clientId === clientId);
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
  const href = (f: FilterId, n = 1, client: number | null = clientId) => `/admin/redesign/feed?cat=${f}${client != null ? `&client=${client}` : ""}${n > 1 ? `&page=${n}` : ""}`;
  const avatar = new Map(rail.clients.map((c) => [c.id, c.avatarPath]));
  const today = localDateStr();
  const when = (e: FeedEvent) => {
    const date = new Date(e.at);
    const day = localDateStr(date) === today ? "Today" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    return e.timeKnown ? `${day} · ${feedClock(e.at)}` : day;
  };

  return (
    <div className="rd-frame">
      <RedesignRail rail={rail} clientId={0} />
      <div className="rd-page">
        <div className="rfd">
          <header className="rfd-head">
            <h1 className="rfd-title">Feed</h1>
            {/* The kinds, each with how much came in over the last 7 days. */}
            <div className="rfd-tools">
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
            <ClientFilter value={clientId == null ? "" : String(clientId)} clients={rail.clients} hrefFor={Object.fromEntries([["", href(filter, 1, null)], ...rail.clients.map((c) => [String(c.id), href(filter, 1, c.id)])])} />
            </div>
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
            <p className="rfd-empty">
              Nothing under {FILTERS.find((f) => f.id === filter)!.label.toLowerCase()}
              {clientId != null ? ` from ${rail.clients.find((c) => c.id === clientId)?.name}` : ""} yet.
            </p>
          ) : (
            <Card className="rfd-card">
              <CardContent className="rfd-rows">
                {visible.map((e) => {
                  const to = feedHref(e);
                  const row = (
                  <>
                    <span className="rfd-who">
                      <span className="rfd-avatar" aria-hidden="true">
                        {avatar.get(e.clientId) ? (
                          // eslint-disable-next-line @next/next/no-img-element -- the client's own upload, served by the app
                          <img src={avatar.get(e.clientId)!} alt="" />
                        ) : (
                          e.clientName.charAt(0).toUpperCase()
                        )}
                      </span>
                      <b>{e.clientName}</b>
                    </span>
                    <Badge className={`rfd-cat ${e.category}`}>{CATEGORY_LABEL[e.category]}</Badge>
                    <span className="rfd-main">
                      <span className="rfd-text">{e.text.charAt(0).toUpperCase() + e.text.slice(1)}</span>
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
                    <span className="rfd-when">{when(e)}</span>
                  </>
                  );
                  // Nothing to open for a client who deleted their account: the row just reads.
                  return to ? (
                    <Link key={e.id} href={to} className="rfd-row">
                      {row}
                    </Link>
                  ) : (
                    <div key={e.id} className="rfd-row still">
                      {row}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          <Pager page={page} pages={pages} from={from} shown={visible.length} total={events.length} label="Feed pages" href={(n) => href(filter, n)} />
        </div>
      </div>
    </div>
  );
}
