import Link from "next/link";
import { ChevronLeftIcon } from "../components/icons";
import { feedClock, getActivityFeed, listLoginLocks, localDateStr, type FeedCategory, type FeedEvent } from "../lib/queries";
import { pageWindow } from "../lib/pager";

// Four kinds of thing happen to a client, and the feed is read one kind at a
// time. There is no "All": a single stream of everything was a list nobody
// finished, and the day headings made it look shorter than it was.
//
// Every source category has a home here, so nothing becomes unreachable — a
// note the client wrote on their programme is training, and an invoice is
// what a coach calls billing.
const FILTERS = [
  { id: "training", label: "Training", holds: ["training", "notes"] },
  { id: "nutrition", label: "Nutrition", holds: ["nutrition"] },
  { id: "measurements", label: "Measurements", holds: ["measurements"] },
  { id: "invoices", label: "Invoices", holds: ["billing"] },
] as const satisfies readonly { id: string; label: string; holds: readonly FeedCategory[] }[];
type FilterId = (typeof FILTERS)[number]["id"];

const CATEGORY_LABEL: Record<FeedCategory, string> = {
  training: "Training",
  nutrition: "Nutrition",
  measurements: "Measurements",
  notes: "Note",
  billing: "Invoice",
};

// One screenful. Fifteen rows across two or three day headings is what fits
// without scrolling past the point of reading.
const PAGE = 15;
const DAY_MS = 24 * 60 * 60 * 1000;

// The page renders per request, so reading the clock here is the point.
const now = () => Date.now();

const matches = (e: FeedEvent, filter: FilterId) =>
  (FILTERS.find((f) => f.id === filter)!.holds as readonly FeedCategory[]).includes(e.category);

function dayHeading(day: string, today: string, yesterday: string) {
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// Everything clients log, across all clients, newest first and grouped by
// day — one category at a time, fifteen rows to a page.
export default function FeedPanel({
  coachId,
  coachEmail,
  owner = false,
  category,
  page: pageParam,
}: {
  coachId: number;
  coachEmail: string;
  /** The owner sees every sign-in lock, not only their own clients'. */
  owner?: boolean;
  category?: string;
  page?: string;
}) {
  const all = getActivityFeed(coachId);
  const locks = listLoginLocks({ id: coachId, email: coachEmail }, owner);
  const filter: FilterId = FILTERS.some((f) => f.id === category) ? (category as FilterId) : FILTERS[0].id;
  const events = all.filter((e) => matches(e, filter));

  const pages = Math.max(1, Math.ceil(events.length / PAGE));
  // A page number from an old link, or one typed by hand, lands on the
  // nearest real page rather than on nothing.
  const page = Math.min(Math.max(1, Math.floor(Number(pageParam)) || 1), pages);
  const from = (page - 1) * PAGE;
  const visible = events.slice(from, from + PAGE);

  // How much has happened in each kind this week, so the categories say where
  // to look rather than making the coach try all four.
  const weekAgo = now() - 7 * DAY_MS;
  const recent = (f: FilterId) => all.filter((e) => matches(e, f) && e.at >= weekAgo).length;

  const href = (f: FilterId, n = 1) => `/admin?view=feed&cat=${f}${n > 1 ? `&page=${n}` : ""}`;

  const today = localDateStr();
  const yesterday = localDateStr(new Date(now() - DAY_MS));
  const days: { day: string; events: FeedEvent[] }[] = [];
  for (const e of visible) {
    const day = localDateStr(new Date(e.at));
    const last = days[days.length - 1];
    if (last?.day === day) last.events.push(e);
    else days.push({ day, events: [e] });
  }

  return (
    <div className="fd">
      <div className="fd-head">
        <h1 className="fd-title">Feed</h1>
        <nav className="fd-filters" aria-label="Filter the feed">
          {FILTERS.map((f) => {
            const n = recent(f.id);
            return (
              <Link
                key={f.id}
                href={href(f.id)}
                className={`fd-filter${filter === f.id ? " active" : ""}`}
                aria-current={filter === f.id ? "page" : undefined}
              >
                {f.label}
                {n > 0 && (
                  <span className="fd-filter-count" title={`${f.label} in the last 7 days`}>
                    {n}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sign-in locks sit above everything: someone can't get into the app,
          or someone was guessing a password. */}
      {locks.length > 0 && (
        <section className="fd-locks" aria-label="Sign-in lockouts">
          <div className="fd-locks-head">
            Sign-in lockouts <span>last 7 days</span>
          </div>
          {locks.map((l) => (
            <div key={l.id} className="fd-lock-row">
              <span className={`fd-lock-dot${l.active ? " active" : ""}`} aria-hidden="true" />
              <div>
                <div className="fd-lock-text">
                  {l.clientId != null ? <Link href={`/admin?client=${l.clientId}`}>{l.who}</Link> : <strong>{l.who}</strong>} was locked
                  out for 15 minutes after {l.scope === "device" ? "3 wrong passwords from one device" : "10 wrong passwords from different devices"}.
                </div>
                <div className="fd-lock-meta">
                  {new Date(l.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · {feedClock(new Date(l.at).getTime())} ·{" "}
                  {l.email} · IP {l.ip}
                  {l.active ? " · still locked" : l.cleared ? " · unlocked" : ""}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {visible.length === 0 ? (
        <p className="fd-empty">Nothing under {FILTERS.find((f) => f.id === filter)!.label.toLowerCase()} yet.</p>
      ) : (
        days.map(({ day, events: rows }) => (
          <section key={day} className="fd-day">
            <h2 className="fd-day-label">{dayHeading(day, today, yesterday)}</h2>
            <div className="fd-card">
              {rows.map((e) => (
                <Link key={e.id} href={`/admin?client=${e.clientId}&tab=${e.tab}`} className="fd-row">
                  <span className={`fd-cat fd-cat-${e.category}`}>{CATEGORY_LABEL[e.category]}</span>
                  <span className="fd-main">
                    <span className="fd-text">
                      <strong>{e.clientName}</strong> {e.text}
                    </span>
                    {e.note && <span className="fd-note">“{e.note}”</span>}
                    {e.thumbs.length > 0 && (
                      <span className="fd-thumbs" aria-hidden="true">
                        {e.thumbs.slice(0, 5).map((src) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={src} src={src} alt="" className="fd-thumb" />
                        ))}
                      </span>
                    )}
                  </span>
                  <span className="fd-when">{e.timeKnown ? feedClock(e.at) : ""}</span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}

      {pages > 1 && (
        <nav className="fd-pager pg" aria-label="Feed pages">
          {page > 1 ? (
            <Link href={href(filter, page - 1)} className="pg-step chev" aria-label="Newer">
              <ChevronLeftIcon />
            </Link>
          ) : (
            <span className="pg-step chev off" aria-hidden="true">
              <ChevronLeftIcon />
            </span>
          )}

          <span className="pg-nums">
            {pageWindow(page, pages).map((n, i) =>
              n === "gap" ? (
                <span key={`gap${i}`} className="pg-gap" aria-hidden="true">
                  …
                </span>
              ) : n === page ? (
                <span key={n} className="pg-num on" aria-current="page">
                  {n}
                </span>
              ) : (
                <Link key={n} href={href(filter, n)} className="pg-num">
                  {n}
                </Link>
              )
            )}
          </span>

          {page < pages ? (
            <Link href={href(filter, page + 1)} className="pg-step chev next" aria-label="Older">
              <ChevronLeftIcon />
            </Link>
          ) : (
            <span className="pg-step chev next off" aria-hidden="true">
              <ChevronLeftIcon />
            </span>
          )}

          <span className="pg-count">
            {from + 1}–{from + visible.length} of {events.length}
          </span>
        </nav>
      )}
    </div>
  );
}
