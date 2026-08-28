import Link from "next/link";
import { getActivityFeed } from "../lib/queries";

function describe(event: ReturnType<typeof getActivityFeed>[number]) {
  if (event.type === "set_logged") {
    const weight = event.weightKg ? `${event.weightKg}kg` : "–";
    const reps = event.reps ?? "–";
    return (
      <>
        <strong>{event.clientName}</strong> logged a set on {event.exerciseName} — {weight} ×{" "}
        {reps}
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
        Live activity across all clients — set logs and invoice updates right now. As
        bodyweight, nutrition, and daily check-ins get built on the client side, they&rsquo;ll
        show up here too.
      </p>

      {events.length === 0 ? (
        <p className="empty-note">
          Nothing yet — once a client logs a set or an invoice status changes, it&rsquo;ll show up
          here immediately.
        </p>
      ) : (
        <div className="log-list">
          {events.map((event) => (
            <div key={event.id} className="log-item">
              <span>
                <Link href={`/admin?client=${event.clientId}`}>{describe(event)}</Link>
              </span>
              <span className="when">{event.at}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
