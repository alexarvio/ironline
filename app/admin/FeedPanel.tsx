import Link from "next/link";
import { feedTimeLabel, getActivityFeed } from "../lib/queries";

function describe(event: ReturnType<typeof getActivityFeed>[number]) {
  if (event.type === "workout_completed") {
    return (
      <>
        <strong>{event.clientName}</strong> completed {event.dayName}
        {event.dayLabel ? ` · ${event.dayLabel}` : ""} ({event.weekLabel}) · {event.exerciseCount}{" "}
        exercise{event.exerciseCount === 1 ? "" : "s"}, {event.setCount} set{event.setCount === 1 ? "" : "s"}
      </>
    );
  }
  return (
    <>
      <strong>{event.clientName}</strong>&rsquo;s invoice &ldquo;{event.description}&rdquo; marked{" "}
      <span className={`status-select status-${event.status}`} style={{ marginLeft: 4 }}>
        {event.status}
      </span>
    </>
  );
}

export default function FeedPanel() {
  const events = getActivityFeed(40);

  return (
    <div>
      <h1>Feed</h1>
      <p className="subtitle">
        Live activity across all clients: completed workouts and invoice updates, newest first.
      </p>

      {events.length === 0 ? (
        <p className="empty-note">
          Nothing yet. Once a client finishes a workout or an invoice status changes, it&rsquo;ll
          show up here immediately.
        </p>
      ) : (
        <div className="log-list">
          {events.map((event) => (
            <div key={event.id} className="log-item">
              <span>
                <Link href={`/admin?client=${event.clientId}`}>{describe(event)}</Link>
              </span>
              <span className="when">{feedTimeLabel(event.at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
