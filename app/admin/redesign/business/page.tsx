import { requireCoach } from "../../../lib/auth";
import { getBusinessBoard, noteBusinessLooked } from "../../../lib/businessBoard";
import { startTiming } from "../../../lib/timing";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import BusinessDraft from "./BusinessDraft";
import "../messages/messages.css";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../training/trn.css";
import "../measurements/measurements.css";
import "../home/home.css";
import "../rail.css";
import "./business.css";

// The coach's Business (21 Oct, Alex: built from the Business mockup): the business in numbers, nothing about the
// clients' bodies. What changed since the last visit, three figures, money and clients by month, who owes, the plans
// ending and who isn't billed by itself. One read (app/lib/businessBoard.ts), the rail on the left.
//   /admin/redesign/business
export const dynamic = "force-dynamic";

export default async function BusinessPage() {
  // Each loader timed (app/lib/timing.ts, /api/timing): measuring only, the props are what they were.
  const t = startTiming("business");
  const coach = await t.time("auth", () => requireCoach());
  // The visit is noted first, so Since reads from the visit before this one.
  t.time("noteBusinessLooked", () => noteBusinessLooked(coach.id));
  const board = t.time("businessBoard", () => getBusinessBoard(coach.id));
  return t.end(
    <div className="rd-frame">
      <RedesignRail rail={t.time("rail", () => loadRail(coach))} clientId={0} />
      <ChatDock chats={t.time("chatDock", () => loadChatDock(coach))} />
      <div className="rd-page">
        <BusinessDraft board={board} />
      </div>
    </div>
  );
}
