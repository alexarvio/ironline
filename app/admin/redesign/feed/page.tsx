import { requireCoach } from "../../../lib/auth";
import { getFeedBoard, noteFeedLooked } from "../../../lib/feedBoard";
import { startTiming } from "../../../lib/timing";
import { loadChatDock, loadRail } from "../loaders";
import RedesignRail from "../RedesignRail";
import ChatDock from "../ChatDock";
import FeedDraft from "./FeedDraft";
import "../messages/messages.css";
import "../../../components/ui/ui.css";
import "../training/draft.css";
import "../training/trn.css";
import "../measurements/measurements.css";
import "../home/home.css";
import "../rail.css";
import "./feed.css";

// The coach's Feed (21 Oct, Alex: built from the Feed mockup): every client at once. What happened since the last
// visit, Needs you (a task a row, each with its action), Clients (a row a client: their last 14 days, this week's
// sessions, when they were last active, at most two state pills) and Activity (a log, New over Earlier). Money lives
// on Business. One read (app/lib/feedBoard.ts), the rail on the left.
//   /admin/redesign/feed            ?cat=training|nutrition|lifestyle|meetings|messages opens Activity on that kind
export const dynamic = "force-dynamic";

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  // Each loader timed (app/lib/timing.ts, /api/timing): measuring only, the props are what they were.
  const t = startTiming("feed");
  const coach = await t.time("auth", () => requireCoach());
  const params = await searchParams;
  // The visit is noted first, so Since and New read from the visit before this one.
  await t.time("noteFeedLooked", () => noteFeedLooked(coach.id));
  const board = await t.time("feedBoard", () => getFeedBoard(coach.id));
  // eslint-disable-next-line react-hooks/purity -- a server render reads the clock once, on purpose: the waits in Needs you count from it, the same on the server and in the browser
  const now = Date.now();
  return t.end(
    <div className="rd-frame">
      <RedesignRail rail={t.time("rail", () => loadRail(coach))} clientId={0} />
      <ChatDock chats={t.time("chatDock", () => loadChatDock(coach))} />
      <div className="rd-page">
        <FeedDraft board={board} now={now} kind={params.cat ?? null} />
      </div>
    </div>
  );
}
