import { requireCoach } from "../../lib/auth";
import PresenceBoard from "./PresenceBoard";
import "./presence.css";

// Who is in the app right now (9 Oct): a page to keep open while working
// on the app, so a push lands on nobody mid-workout.
//   /admin/presence
export const dynamic = "force-dynamic";

export default async function PresencePage() {
  await requireCoach();
  return (
    <main className="pr-page">
      <h1>Who&rsquo;s in the app</h1>
      <PresenceBoard />
    </main>
  );
}
