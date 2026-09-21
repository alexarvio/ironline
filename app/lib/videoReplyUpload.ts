import fs from "fs";
import path from "path";
import { once } from "events";
import { DATA_DIR } from "./db";
import { setVideoReplyFile, videoReplyTarget } from "./queries";
import { deleteUpload, putUploadFromDisk } from "./storage";

// Receiving a coach's reply video (see app/api/video-reply/[id]/route.ts):
// the raw file, written to the disk as it arrives rather than held in
// memory, up to 500MB, then streamed to the bucket and filed on the
// request. The caller has already checked who is sending it.
export const MAX_REPLY_BYTES = 500 * 1024 * 1024;
const EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };

const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function receiveReplyVideo(request: Request, id: number): Promise<Response> {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("video/")) return fail("That doesn't look like a video.", 415);
  const tooBig = "That video is over 500 MB. Export it at 1080p, or trim it, and try again.";
  if (Number(request.headers.get("content-length") || 0) > MAX_REPLY_BYTES) return fail(tooBig, 413);
  if (!request.body) return fail("Nothing came through. Try again.", 400);

  const ext = EXT[type] ?? ((type.split("/")[1] || "").replace(/[^a-z0-9]/g, "") || "mp4");
  const target = videoReplyTarget(id, ext);
  if (!target) return fail("Not found", 404);
  fs.mkdirSync(target.dir, { recursive: true });

  const out = fs.createWriteStream(target.filePath);
  const reader = request.body.getReader();
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_REPLY_BYTES) throw new Error("too big");
      if (!out.write(value)) await once(out, "drain");
    }
    await new Promise<void>((resolve, reject) => out.end((err?: Error | null) => (err ? reject(err) : resolve())));
  } catch {
    out.destroy();
    fs.rmSync(target.filePath, { force: true });
    return total > MAX_REPLY_BYTES ? fail(tooBig, 413) : fail("The upload broke off. Try again.", 400);
  }
  if (total === 0) {
    fs.rmSync(target.filePath, { force: true });
    return fail("Nothing came through. Try again.", 400);
  }

  await putUploadFromDisk(target.publicPath, target.filePath, type);
  const previous = setVideoReplyFile(id, target.publicPath);
  if (previous) {
    await deleteUpload(previous);
    const old = path.join(DATA_DIR, previous.replace(/^\//, ""));
    if (old.startsWith(path.join(DATA_DIR, "uploads"))) fs.rmSync(old, { force: true });
  }
  return Response.json({ path: target.publicPath, bytes: total });
}
