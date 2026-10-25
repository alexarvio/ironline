import { getRequestUser } from "../../../lib/auth";
import { coachOwnsClient } from "../../../lib/tenancy";
import { receiveChatReview } from "../../../lib/chatReviewUpload";

// A coach's recorded review of a video or photo a client sent in the chat (25 Oct, Alex), as the raw file: outside
// proxy.ts (its matcher), as /api/video-reply is, since a few minutes of video run past what a server action takes.
// ?replyTo= the client's message it answers, ?note= the coach's words with it.
export async function POST(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const { clientId: raw } = await params;
  const clientId = Number(raw);
  // From the request: the proxy does not run here, so Clerk's auth() cannot.
  const user = await getRequestUser(request);
  if (!Number.isInteger(clientId) || clientId <= 0 || !user || user.role !== "coach" || !coachOwnsClient(user.id, clientId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const url = new URL(request.url);
  const replyTo = Number(url.searchParams.get("replyTo")) || null;
  const note = url.searchParams.get("note") ?? "";
  return receiveChatReview(request, clientId, replyTo, note);
}
