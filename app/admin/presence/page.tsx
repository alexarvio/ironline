import { requireOwner } from "../../lib/auth";
import PresenceBoard from "./PresenceBoard";
import "./presence.css";

// Who is in the app right now (9 Oct): a page to keep open while working
// on the app, so a push lands on nobody mid-workout.
//   /admin/presence
// The owner's alone since 4 Nov (Alex: "something for dev now, coaches won't need it"): it lists everyone on NorCoach.
export const dynamic = "force-dynamic";

export default async function PresencePage() {
  await requireOwner();
  return (
    <main className="pr-page">
      <h1>Who&rsquo;s in the app</h1>
      <PresenceBoard />
    </main>
  );
}
