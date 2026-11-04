import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import type { ReadableStream as WebReadableStream } from "stream/web";
import { DATA_DIR } from "./db";

// One way in for every big file (4 Nov, Alex: memory was 92% of the bill; a 128 MB phone video sent through a server
// action was held three or four times over, half a GB). The file comes first as the raw body to /api/upload, outside
// proxy.ts (its matcher), and is written to the disk as it arrives, as a chat review is (chatReviewUpload.ts); the
// answer is a short-lived handle, and the server action that files it (the chat send, the exercise video, the demo,
// the library clip, a meal or shape-update photo) takes the handle instead of the bytes and moves the file into place.
// The handle is the signed-in user's alone (and the client's it was sent for); one not taken within the hour goes.

/** What the upload is for: a coach's demo or library clip (video), a meal or shape-update photo (photo), a client's
 *  exercise photo or video (media), or anything a chat takes (chat). */
export type UploadKind = "video" | "photo" | "media" | "chat";
export const UPLOAD_KINDS: readonly UploadKind[] = ["video", "photo", "media", "chat"];

const MB = 1024 * 1024;
/** The caps as the actions had them: a video 128 MB (two minutes in 1080p), a photo 20 MB, any other file 25 MB. */
export const UPLOAD_CAPS = { video: 128 * MB, photo: 20 * MB, file: 25 * MB } as const;

/** Beside the uploads, never in them: nothing here is served. The same disk, so a move is a rename. */
const TMP_DIR = path.join(DATA_DIR, "upload-tmp");
/** A handle not taken within the hour goes, its file with it. */
const MAX_AGE_MS = 60 * 60 * 1000;
const SWEEP_EVERY_MS = 10 * 60 * 1000;
const HANDLE = /^[a-f0-9]{32}$/;

type Meta = { userId: number; clientId: number | null; kind: UploadKind; type: string; name: string; size: number; at: number };
/** A staged upload, claimed by its action: the file on the disk, what the browser said it is, its name and size. */
export type StagedUpload = Meta & { handle: string; file: string };

const binOf = (handle: string) => path.join(TMP_DIR, `${handle}.bin`);
const metaOf = (handle: string) => path.join(TMP_DIR, `${handle}.json`);
const rm = (file: string) => {
  try {
    fs.rmSync(file, { force: true });
  } catch {
    /* gone already */
  }
};

/** The cap for a file of this type. */
export function uploadCap(type: string): number {
  return type.startsWith("video/") ? UPLOAD_CAPS.video : type.startsWith("image/") ? UPLOAD_CAPS.photo : UPLOAD_CAPS.file;
}

/** The types each kind takes, as the actions checked them (the browser's word for it, as before). */
function typeOk(kind: UploadKind, type: string): boolean {
  if (kind === "video") return type.startsWith("video/");
  if (kind === "photo") return type.startsWith("image/");
  if (kind === "media") return type.startsWith("video/") || type.startsWith("image/");
  return true;
}

const wrongType: Record<UploadKind, string> = {
  video: "That doesn't look like a video file.",
  photo: "That isn't a picture.",
  media: "That doesn't look like a photo or a video.",
  chat: "That file can't be sent.",
};

/** Over its cap, in the words the actions used for it. */
function tooBigWords(kind: UploadKind, type: string, bytes: number): string {
  const mb = Math.round(bytes / MB);
  if (type.startsWith("video/")) {
    if (kind === "media") return `That video is ${mb} MB. The limit is 128 MB: film in 1080p and keep it under two minutes.`;
    if (kind === "video") return `That file is ${mb}MB. The limit is 128MB. Trim the clip and try again.`;
    return "That video is over 128 MB.";
  }
  if (type.startsWith("image/")) return kind === "media" ? "That photo is over 20 MB. Send a smaller one." : "That picture is over 20 MB.";
  return "That file is over 25 MB.";
}

const g = globalThis as unknown as { __uploadSweptAt?: number; __uploadSweeper?: ReturnType<typeof setInterval> };

/** Takes away whatever was left over an hour: a send that never came, a handle refused. Every ten minutes at most. */
export function sweepUploads(force = false) {
  const now = Date.now();
  if (!force && g.__uploadSweptAt && now - g.__uploadSweptAt < SWEEP_EVERY_MS) return;
  g.__uploadSweptAt = now;
  let names: string[];
  try {
    names = fs.readdirSync(TMP_DIR);
  } catch {
    return;
  }
  for (const name of names) {
    const file = path.join(TMP_DIR, name);
    try {
      if (now - fs.statSync(file).mtimeMs > MAX_AGE_MS) rm(file);
    } catch {
      /* gone meanwhile */
    }
  }
}

/** The sweep runs by itself too, so an hour-old file goes even when nothing more is sent (one timer a process). */
function keepSweeping() {
  if (g.__uploadSweeper) return;
  g.__uploadSweeper = setInterval(() => sweepUploads(true), SWEEP_EVERY_MS);
  g.__uploadSweeper.unref?.();
}

const fail = (error: string, status: number) => Response.json({ error }, { status });

/**
 * The raw body of POST /api/upload written to the disk as it arrives (never held whole), up to the cap for its type.
 * The caller has checked who is sending it and for which client. Answers { handle, bytes }, or { error }.
 */
export async function receiveUpload(request: Request, o: { userId: number; clientId: number | null; kind: UploadKind; type: string; name: string }): Promise<Response> {
  keepSweeping();
  sweepUploads();
  const type = o.type.split(";")[0].trim().toLowerCase();
  if (!typeOk(o.kind, type)) return fail(wrongType[o.kind], 415);
  const cap = uploadCap(type);
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > cap) return fail(tooBigWords(o.kind, type, declared), 413);
  if (!request.body) return fail("Nothing came through. Try again.", 400);

  fs.mkdirSync(TMP_DIR, { recursive: true });
  const handle = crypto.randomBytes(16).toString("hex");
  const file = binOf(handle);
  let total = 0;
  const capped = new Transform({
    transform(chunk: Buffer, _enc, done) {
      total += chunk.length;
      if (total > cap) done(new Error("too big"));
      else done(null, chunk);
    },
  });
  try {
    await pipeline(Readable.fromWeb(request.body as unknown as WebReadableStream<Uint8Array>), capped, fs.createWriteStream(file));
  } catch {
    rm(file);
    return total > cap ? fail(tooBigWords(o.kind, type, total), 413) : fail("The upload broke off. Try again.", 400);
  }
  if (total === 0) {
    rm(file);
    return fail("Nothing came through. Try again.", 400);
  }
  // The handle's facts last, so a file still coming in can never be claimed.
  const meta: Meta = { userId: o.userId, clientId: o.clientId, kind: o.kind, type: o.type, name: o.name.slice(0, 200), size: total, at: Date.now() };
  fs.writeFileSync(metaOf(handle), JSON.stringify(meta));
  return Response.json({ handle, bytes: total });
}

/**
 * The upload a form names (its "upload" field), taken once: only by the user who sent it, only for the client it was
 * sent for, and only of a kind the action takes. Null when it isn't theirs, is gone, or is past the hour. The caller
 * then puts it in place (placeUpload) or lets it go (discardUpload).
 */
export function claimUpload(handle: unknown, who: { userId: number; clientId?: number | null; kinds?: readonly UploadKind[] }): StagedUpload | null {
  const h = typeof handle === "string" ? handle.trim() : "";
  if (!HANDLE.test(h)) return null;
  let meta: Meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaOf(h), "utf8")) as Meta;
  } catch {
    return null;
  }
  if (meta.userId !== who.userId) return null;
  if (who.clientId != null && meta.clientId != null && meta.clientId !== who.clientId) return null;
  if (who.kinds && !who.kinds.includes(meta.kind)) return null;
  const file = binOf(h);
  // Taken: the facts go now, so the same handle never files twice.
  rm(metaOf(h));
  if (Date.now() - meta.at > MAX_AGE_MS || !fs.existsSync(file)) {
    rm(file);
    return null;
  }
  return { ...meta, handle: h, file };
}

/** The upload moved to where a public path (/uploads/…) lives on the disk; back with that file. Over whatever the
 *  saving query wrote there (an empty placeholder: the queries write bytes, and these never come into memory now). */
export function placeUpload(up: StagedUpload, publicPath: string): string {
  const rel = publicPath.split("?")[0].replace(/^\/+/, "");
  const dest = path.join(DATA_DIR, rel);
  if (!dest.startsWith(path.join(DATA_DIR, "uploads") + path.sep)) throw new Error("Not an upload path");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  try {
    fs.renameSync(up.file, dest);
  } catch (error) {
    // Another disk (DATA_DIR split across volumes): a copy, then the staged file goes.
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") throw error;
    fs.copyFileSync(up.file, dest);
    rm(up.file);
  }
  return dest;
}

/** An upload not used after all (the action refused, or the send was a repeat): its file goes now. */
export function discardUpload(up: StagedUpload | null | undefined) {
  if (up) rm(up.file);
}
