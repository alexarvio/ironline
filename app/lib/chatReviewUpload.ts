import fs from "fs";
import path from "path";
import { once } from "events";
import { after as afterResponse } from "next/server";
import { DATA_DIR } from "./db";
import { allocChatMediaName, sendChatMessage } from "./queries";
import { prepareChatMedia, putUploadFromDisk } from "./storage";
import { toMp4 } from "./transcode";
import { MAX_REPLY_BYTES } from "./videoReplyUpload";

// A coach's review of a video or photo a client sent in the chat (25 Oct, Alex: "from here… to be able to review… it
// goes to that screen where I have the toolbar and I can record"; app/api/chat-review/[clientId]/route.ts). The
// recording comes as the raw file, as an exercise's review does (videoReplyUpload.ts: a few minutes run past what a
// server action takes), is written to the disk as it arrives, a browser's WebM made an MP4 the phone plays, and goes
// into the chat as the coach's message, a reply to the client's, with the coach's note as its words.
const EXT: Record<string, string> = { "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm", "video/x-m4v": "m4v" };
const fail = (error: string, status: number) => Response.json({ error }, { status });

export async function receiveChatReview(request: Request, clientId: number, replyTo: number | null, note: string): Promise<Response> {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (!type.startsWith("video/")) return fail("That doesn't look like a video.", 415);
  const tooBig = "That review is over 500 MB. Record a shorter one and try again.";
  if (Number(request.headers.get("content-length") || 0) > MAX_REPLY_BYTES) return fail(tooBig, 413);
  if (!request.body) return fail("Nothing came through. Try again.", 400);

  const ext = EXT[type] ?? ((type.split("/")[1] || "").replace(/[^a-z0-9]/g, "") || "mp4");
  const dir = path.join(DATA_DIR, "uploads", "chat", String(clientId));
  fs.mkdirSync(dir, { recursive: true });
  const base = allocChatMediaName("review");
  let file = path.join(dir, `${base}.${ext}`);
  const out = fs.createWriteStream(file);
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
    fs.rmSync(file, { force: true });
    return total > MAX_REPLY_BYTES ? fail(tooBig, 413) : fail("The upload broke off. Try again.", 400);
  }
  if (total === 0) {
    fs.rmSync(file, { force: true });
    return fail("Nothing came through. Try again.", 400);
  }
  // A browser recording (WebM) becomes an MP4 every phone plays.
  let filedType = type;
  let filedExt = ext;
  if (ext === "webm") {
    const mp4 = path.join(dir, `${base}.mp4`);
    if (await toMp4(file, mp4)) {
      fs.rmSync(file, { force: true });
      file = mp4;
      filedType = "video/mp4";
      filedExt = "mp4";
    }
  }
  const publicPath = `/uploads/chat/${clientId}/${base}.${filedExt}`;
  await putUploadFromDisk(publicPath, file, filedType);
  sendChatMessage(clientId, "coach", note.trim().slice(0, 4000), { path: publicPath, type: "video", name: null }, null, replyTo);
  afterResponse(() => prepareChatMedia(publicPath, "video"));
  return Response.json({ path: publicPath, bytes: total });
}
