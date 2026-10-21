import { requireCoach } from "../../../lib/auth";
import { getBusinessBoard, noteBusinessLooked } from "../../../lib/businessBoard";
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
  const coach = await requireCoach();
  // The visit is noted first, so Since reads from the visit before this one.
  noteBusinessLooked(coach.id);
  const board = getBusinessBoard(coach.id);
  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <ChatDock chats={loadChatDock(coach)} />
      <div className="rd-page">
        <BusinessDraft board={board} />
      </div>
    </div>
  );
}
