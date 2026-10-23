import fs from "fs";
import path from "path";
import { DATA_DIR } from "../../../lib/db";
import { getRequestUser, isOwner } from "../../../lib/auth";
import { bucketLink, keyOf, LINK_CACHE_SECONDS, mimeFor, smallCopy } from "../../../lib/storage";
import { getSupportMessage } from "../../../lib/support";

// A support screenshot (23 Oct; lib/support.ts): to the coach whose thread it is in and to the owner, no one else.
// Stored as the app's other uploads are ("/uploads/support/<coachId>/<file>", in the bucket when it is on), served
// here rather than by /uploads, which knows clients, not coaches' threads. "?w=480" is the thumbnail (storage.ts).
// 404 for anyone else, so a guess never learns a screenshot exists.
//   /api/support/<messageId>
const notFound = () => new Response("Not found", { status: 404 });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  const { id } = await params;
  const m = getSupportMessage(Number(id));
  if (!user || user.role !== "coach" || user.pending || !m?.image_path) return notFound();
  if (user.id !== m.coach_id && !isOwner(user)) return notFound();
  const key = keyOf(m.image_path);
  if (!key) return notFound();

  const w = Number(new URL(request.url).searchParams.get("w"));
  if (w) {
    const small = await smallCopy(key, w);
    if (small) return small;
  }
  const link = await bucketLink(key);
  if (link) return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": `private, max-age=${LINK_CACHE_SECONDS}` } });

  const root = path.join(DATA_DIR, "uploads");
  const file = path.join(root, ...key.split("/"));
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound();
  const bytes = fs.readFileSync(file);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": mimeFor(key), "Content-Length": String(bytes.length), "Cache-Control": "private, max-age=3600" },
  });
}
