import { notFound } from "next/navigation";
import { isOwner, requireCoach } from "../../../lib/auth";
import { getData } from "../../../lib/db";
import { getCoachProfileView, listCoachAccounts } from "../../../lib/queries";
import { listSupportThreads } from "../../../lib/support";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import CoachesDraft, { type CoachRow, type SignUpRow } from "./CoachesDraft";
import "../messages/messages.css";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../training/trn.css";
import "../measurements/measurements.css";
import "../rail.css";
import "./coaches.css";

// The owner's Coaches in the redesign (22 Oct, Alex: the old /admin?view=coaches in the new style): every coach
// account, how many clients each has and when one last logged something, the sign-ups waiting to be let in, the
// coaches' Support threads (23 Oct, SupportInbox, lib/support.ts), and the owner's account actions (CoachesPanel's
// own, see ./actions.ts). Never any client's name or data. Owner only.
//   /admin/redesign/coaches
export const dynamic = "force-dynamic";

export default async function CoachesPage() {
  const coach = await requireCoach();
  if (!isOwner(coach)) notFound();
  // Coaches who signed up themselves and wait for the owner (sign-in through Clerk): their own list, once.
  const waiting: SignUpRow[] = getData()
    .users.filter((u) => u.role === "coach" && u.pending)
    .map((u) => ({ id: u.id, email: u.email, name: u.pending!.name, business: u.pending!.business, at: u.pending!.at }));
  const wait = new Set(waiting.map((w) => w.id));
  const accounts: CoachRow[] = listCoachAccounts()
    .filter((c) => !wait.has(c.id))
    .map((c) => ({ ...c, name: getCoachProfileView(c.id)?.displayName ?? c.email, owner: c.id === coach.id }));
  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <ChatDock chats={loadChatDock(coach)} />
      <div className="rd-page">
        <CoachesDraft accounts={accounts} waiting={waiting} support={listSupportThreads()} />
      </div>
    </div>
  );
}
