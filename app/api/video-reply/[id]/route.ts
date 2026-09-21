import { getSessionUser } from "../../../lib/auth";
import { coachOwnsClient } from "../../../lib/tenancy";
import { getClientIdForVideoRequest } from "../../../lib/queries";
import { receiveReplyVideo } from "../../../lib/videoReplyUpload";

// A coach's reply video to a client's video — often a screen recording of
// theirs, drawn over and talked through, and so often minutes long and
// hundreds of MB. Server actions take 64MB and hold the whole body in
// memory, so this one comes as the raw file to its own route, outside
// proxy.ts (see its matcher), and is written to the disk as it arrives
// (receiveReplyVideo). The comment and the notification follow with
// sendVideoReplyAction.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = await params;
  const id = Number(raw);
  const clientId = Number.isInteger(id) && id > 0 ? getClientIdForVideoRequest(id) : null;
  const user = await getSessionUser();
  if (clientId == null || !user || user.role !== "coach" || !coachOwnsClient(user.id, clientId)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  return receiveReplyVideo(request, id);
}
