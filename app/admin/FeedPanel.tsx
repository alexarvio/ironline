import Link from "next/link";
import { feedClock, getActivityFeed, localDateStr, type FeedCategory, type FeedEvent } from "../lib/queries";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "training", label: "Training" },
  { id: "nutrition", label: "Nutrition" },
  { id: "measurements", label: "Measurements" },
  { id: "notes", label: "Notes" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const CATEGORY_LABEL: Record<FeedCategory, string> = {
  training: "Training",
  nutrition: "Nutrition",
  measurements: "Measurements",
  notes: "Note",
  billing: "Billing",
};

const PAGE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

// The page renders per request, so reading the clock here is the point.
const now = () => Date.now();

// Notes is every row with the client's own words on it, wherever they wrote
// them: a check-in, a calorie day, a programme, an exercise.
const matches = (e: FeedEvent, filter: FilterId) =>
  filter === "all" || (filter === "notes" ? e.category === "notes" || !!e.note : e.category === filter);

function dayHeading(day: string, today: string, yesterday: string) {
  if (day === today) return "Today";
  if (day === yesterday) return "Yesterday";
  return new Date(`${day}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// Everything clients log, across all clients, newest first and grouped by
// day. The filters narrow it to one kind; Notes gathers the client's words
// from anywhere so none sit unread.
export default function FeedPanel({ category, show }: { category?: string; show?: string }) {
  const all = getActivityFeed();
  const filter: FilterId = FILTERS.some((f) => f.id === category) ? (category as FilterId) : "all";
  const events = all.filter((e) => matches(e, filter));
  const limit = Math.max(PAGE, Math.floor(Number(show)) || PAGE);
  const visible = events.slice(0, limit);

  const weekAgo = now() - 7 * DAY_MS;
  const recentNotes = all.filter((e) => matches(e, "notes") && e.at >= weekAgo).length;

  const href = (f: FilterId, n?: number) =>
    `/admin?view=feed${f === "all" ? "" : `&cat=${f}`}${n ? `&show=${n}` : ""}`;

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
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              href={href(f.id)}
              className={`fd-filter${filter === f.id ? " active" : ""}`}
              aria-current={filter === f.id ? "page" : undefined}
            >
              {f.label}
              {f.id === "notes" && recentNotes > 0 && (
                <span className="fd-filter-count" title="Notes in the last 7 days">
                  {recentNotes}
                </span>
              )}
            </Link>
          ))}
        </nav>
      </div>

      {visible.length === 0 ? (
        <p className="fd-empty">
          {filter === "all" ? "Nothing logged yet." : `No ${FILTERS.find((f) => f.id === filter)!.label.toLowerCase()} yet.`}
        </p>
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

      {events.length > visible.length && (
        <div className="fd-more-row">
          <Link href={href(filter, limit + PAGE)} className="fd-more" scroll={false}>
            Show more
          </Link>
          <span className="fd-more-count">
            {visible.length} of {events.length}
          </span>
        </div>
      )}
    </div>
  );
}
