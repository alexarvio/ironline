import { getRequestUser } from "../../lib/auth";
import { coachOwnsClient } from "../../lib/tenancy";
import { receiveUpload, UPLOAD_KINDS, type UploadKind } from "../../lib/streamUpload";

// Every big file comes here first, as the raw body (4 Nov, Alex: memory; lib/streamUpload.ts), outside proxy.ts (its
// matcher), so Next never copies the body into memory, and is written to the disk as it arrives. The answer is a handle
// the server action then takes instead of the bytes. ?kind= what it is for, ?type= the file's own type (the browser's
// word, as the actions read it), ?name= its name, ?clientId= the client it is for.
// Who may send: a client for themselves alone (the id asked is ignored, as requireClientAccess does); a coach for their
// own clients, or with no client for their own library and demos. The handle is the sender's alone, and the action
// checks the thing it files on as before.
export async function POST(request: Request) {
  const notFound = () => Response.json({ error: "Not found" }, { status: 404 });
  // From the request: the proxy does not run here, so Clerk's auth() cannot.
  const user = await getRequestUser(request);
  if (!user || user.must_change_password || user.pending) return notFound();
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as UploadKind | null;
  if (!kind || !UPLOAD_KINDS.includes(kind)) return Response.json({ error: "Not a kind of upload." }, { status: 400 });
  const asked = Number(url.searchParams.get("clientId"));

  let clientId: number | null = null;
  if (user.role === "coach") {
    if (Number.isInteger(asked) && asked > 0) {
      if (!coachOwnsClient(user.id, asked)) return notFound();
      clientId = asked;
    } else if (kind === "chat" || kind === "photo") {
      // A chat's file or a meal or shape-update photo is always some client's, and its sender knows whose. (An
      // exercise's media from the client's app, tried by their coach, names only the exercise: its action checks it.)
      return notFound();
    }
  } else {
    // A demo or library clip is the coach's alone.
    if (user.client_id == null || kind === "video") return notFound();
    clientId = user.client_id;
  }

  return receiveUpload(request, {
    userId: user.id,
    clientId,
    kind,
    type: url.searchParams.get("type") ?? "",
    name: url.searchParams.get("name") ?? "",
  });
}
