import { requireCoach } from "../../../lib/auth";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import "../messages/messages.css";
import LibraryDraft from "./LibraryDraft";
import { loadLibrary } from "./load";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../training/trn.css";
import "../measurements/measurements.css";
import "../rail.css";
import "./library.css";

// The coach's Library (5 Oct; 21 Oct, Alex: just the exercises and their demos): every exercise of theirs by muscle
// group, each with a video or a link. Training's header and the shared hairline cards (trn.css, measurements.css).
//   /admin/redesign/library
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const coach = await requireCoach();
  return (
    <div className="rd-frame">
      <RedesignRail rail={loadRail(coach)} clientId={0} />
      <ChatDock chats={loadChatDock(coach)} />
      <div className="rd-page">
        <LibraryDraft data={loadLibrary(coach.id)} />
      </div>
    </div>
  );
}
