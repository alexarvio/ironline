import Link from "next/link";
import { createClientAction } from "../lib/actions";
import { listClients } from "../lib/queries";

// Every client the coach manages, and a box to add another. Nothing else —
// this is the only navigation the admin has.
export default function AdminSidebar({ selectedId }: { selectedId: number | null }) {
  const clients = listClients();

  return (
    <>
      <div className="ad-brand">
        <span className="ad-brand-mark">FP</span>
        <div className="ad-brand-text">
          <div className="ad-brand-name">Full Potential</div>
          <div className="ad-brand-sub">Coach workstation</div>
        </div>
      </div>

      <div className="ad-clients-head">
        <span className="ad-microlabel">Clients</span>
        <span className="ad-clients-count">{clients.length}</span>
      </div>

      <div className="ad-clients">
        {clients.length === 0 ? (
          <p className="ad-empty">No clients yet — add your first one below.</p>
        ) : (
          clients.map((c) => (
            <Link
              key={c.id}
              href={`/admin?client=${c.id}`}
              className={`ad-client-row${c.id === selectedId ? " active" : ""}`}
            >
              <span className="ad-client-avatar" aria-hidden="true">
                {c.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="ad-client-name">{c.name}</span>
            </Link>
          ))
        )}
      </div>

      <form action={createClientAction} className="ad-new-client">
        <input name="name" type="text" placeholder="New client" required className="ad-input" />
        <button className="ad-icon-btn" type="submit" aria-label="Add client">
          +
        </button>
      </form>

      {/* Opens the app as whoever is selected, so what the coach just built
          is what they see — there's no login yet to do that for them. */}
      <Link
        href={selectedId ? `/client?client=${selectedId}` : "/client"}
        className="ad-client-app-link"
      >
        View client app →
      </Link>
    </>
  );
}
