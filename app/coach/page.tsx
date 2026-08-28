import Link from "next/link";
import ProgramBuilder from "../components/ProgramBuilder";
import { getClient } from "../lib/queries";

const CLIENT_ID = 1;

// See app/client/page.tsx — same reasoning, without this the page freezes
// whatever data existed at build time instead of reading it per request.
export const dynamic = "force-dynamic";

export default function CoachPage() {
  const client = getClient(CLIENT_ID);

  return (
    <div className="shell">
      <div className="top-nav">
        <Link className="brand" href="/">
          Ironline
        </Link>
        <div className="nav-links">
          <Link className="active" href="/coach">
            Coach
          </Link>
          <Link href="/client">Client</Link>
          <Link href="/admin">Admin panel</Link>
        </div>
      </div>

      <h1>{client?.name}&rsquo;s week — coach view</h1>
      <p className="subtitle">
        A blank 7-day canvas. Add exercises to whichever days make sense, leave the
        rest empty (they&rsquo;re rest days by default), then deploy when ready.
      </p>

      <ProgramBuilder clientId={CLIENT_ID} />
    </div>
  );
}
