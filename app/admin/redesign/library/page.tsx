import { requireCoach } from "../../../lib/auth";
import { startTiming } from "../../../lib/timing";
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
  // Each loader timed (app/lib/timing.ts, /api/timing): measuring only, the props are what they were.
  const t = startTiming("library");
  const coach = await t.time("auth", () => requireCoach());
  return t.end(
    <div className="rd-frame">
      <RedesignRail rail={t.time("rail", () => loadRail(coach))} clientId={0} />
      <ChatDock chats={t.time("chatDock", () => loadChatDock(coach))} />
      <div className="rd-page">
        <LibraryDraft data={t.time("library", () => loadLibrary(coach.id))} />
      </div>
    </div>
  );
}
