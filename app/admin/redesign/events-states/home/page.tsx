import { requireCoach } from "../../../../lib/auth";
import HomeStateScreen from "../../home-states/HomeStateScreen";
import { homeProps } from "../../home-states/states";
import { eventsProps } from "../states";
import "../../home-states/home-states.css";

// The same events as the board's "In one now" frame, as the client's Home
// shows them: the "Coming up" card with the running one and the next (9 Oct).
//   /admin/redesign/events-states/home
export const dynamic = "force-dynamic";

export default async function EventsOnHomePage() {
  await requireCoach();
  return (
    <div className="hs-full">
      <HomeStateScreen props={{ ...homeProps("full"), events: eventsProps("now") }} />
    </div>
  );
}
