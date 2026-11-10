import fs from "fs";
import path from "path";
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DATA_DIR, getData, persist } from "./db";
import { loadSharp } from "./sharpSetup";

// Uploaded files (progress photos, avatars, chat media, demo videos) in the
// Railway storage bucket, off the server's disk.
//
// On when UPLOADS_STORE=bucket and the UPLOADS_* credentials are set; remove
// UPLOADS_STORE and everything reads from the disk again, as before. While
// it is on, an upload is written to the disk only until its copy is in the
// bucket (15 Oct: the volume had filled with copies), and a file not yet there is
// served from the disk. The stored paths stay "/uploads/<key>", so nothing in
// the data changes; the /uploads route checks access, then redirects to a
// link into the bucket that expires after a week (4 Nov; was a few minutes, see bucketLink).

// A link lives 7 days, the most a SigV4 link can (4 Nov, Alex: Railway bills every byte the app sends, a download
// straight from the bucket is free, and a phone can only reuse what it downloaded while the link is the same).
const LINK_SECONDS = 7 * 24 * 60 * 60;
// Links are signed for 6-day windows: every link of a window is signed as at its first moment, so the same file has the
// same link the whole window, across requests and restarts alike, and stays good a day past the window's end.
const LINK_WINDOW_MS = 6 * 24 * 60 * 60 * 1000;
// Every link is signed this long before its window starts (and a "?v=" stamp's up to an hour more), never after now.
const SIGN_EARLY_SECONDS = 5 * 60;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

export const mimeFor = (key: string) => MIME[path.extname(key).slice(1).toLowerCase()] ?? "application/octet-stream";

type Bucket = { s3: S3Client; bucket: string };

function bucket(): Bucket | null {
  const { UPLOADS_STORE, UPLOADS_BUCKET, UPLOADS_ENDPOINT, UPLOADS_REGION, UPLOADS_ACCESS_KEY_ID, UPLOADS_SECRET_ACCESS_KEY } = process.env;
  if (UPLOADS_STORE !== "bucket" || !UPLOADS_BUCKET || !UPLOADS_ENDPOINT || !UPLOADS_ACCESS_KEY_ID || !UPLOADS_SECRET_ACCESS_KEY) return null;
  const g = globalThis as unknown as { _uploadsBucket?: Bucket };
  g._uploadsBucket ??= {
    bucket: UPLOADS_BUCKET,
    s3: new S3Client({
      region: UPLOADS_REGION || "auto",
      endpoint: UPLOADS_ENDPOINT,
      credentials: { accessKeyId: UPLOADS_ACCESS_KEY_ID, secretAccessKey: UPLOADS_SECRET_ACCESS_KEY },
    }),
  };
  return g._uploadsBucket;
}

export const bucketEnabled = () => bucket() != null;

/** "/uploads/progress/9/10/2026-09-12.jpg?v=1" -> "progress/9/10/2026-09-12.jpg" */
export function keyOf(publicPath: string): string | null {
  const clean = publicPath.split("?")[0];
  if (!clean.startsWith("/uploads/")) return null;
  const key = clean.slice("/uploads/".length);
  return key && !key.split("/").some((s) => !s || s === "." || s === "..") ? key : null;
}

// Keys known to be in the bucket, so a photo is checked once per server start.
const inBucket = new Set<string>();

async function exists(b: Bucket, key: string): Promise<boolean> {
  if (inBucket.has(key)) return true;
  try {
    await b.s3.send(new HeadObjectCommand({ Bucket: b.bucket, Key: key }));
    inBucket.add(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * The disk copy goes once the bucket has the file (15 Oct): the 500 MB
 * volume had filled with videos that were already in the bucket, and every
 * upload failed with ENOSPC. The disk now only holds a file between its
 * upload and its copy, so the volume stays small whatever comes in.
 */
function dropDiskCopy(key: string) {
  try {
    fs.rmSync(path.join(DATA_DIR, "uploads", key), { force: true });
  } catch {
    /* a copy that is not there is fine */
  }
}

/** Copies a just-saved upload into the bucket, then lets the disk copy go. Does nothing when the bucket is off. */
export async function putUpload(publicPath: string | null | undefined, body: Buffer, contentType?: string) {
  const b = bucket();
  const key = publicPath ? keyOf(publicPath) : null;
  if (!b || !key) return;
  try {
    await b.s3.send(new PutObjectCommand({ Bucket: b.bucket, Key: key, Body: body, ContentType: contentType || mimeFor(key) }));
    stats.puts++;
    inBucket.add(key);
    linkCache.delete(key);
    dropDiskCopy(key);
  } catch (error) {
    // The file is on the disk and is served from there; the startup copy
    // puts it in the bucket next time. Worth knowing about, not worth
    // failing the client's upload over.
    stats.putFails++;
    stats.lastPutError = `${key}: ${error instanceof Error ? `${error.name} ${error.message}` : String(error)}`.slice(0, 300);
    console.error(`[uploads] could not copy ${key} to the bucket:`, error instanceof Error ? error.message : error);
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }
}

/** Removes an upload from the bucket (the disk copy is handled by the caller). */
/** The same as putUpload for a file already on the disk, streamed rather
    than read into memory: a coach's screen recording can be hundreds of MB. */
export async function putUploadFromDisk(publicPath: string, filePath: string, contentType?: string) {
  const b = bucket();
  const key = keyOf(publicPath);
  if (!b || !key) return;
  try {
    const size = fs.statSync(filePath).size;
    await b.s3.send(
      new PutObjectCommand({ Bucket: b.bucket, Key: key, Body: fs.createReadStream(filePath), ContentLength: size, ContentType: contentType || mimeFor(key) })
    );
    // As putUpload keeps them (4 Nov, review: the demos, library clips and chat files come this way now): counted, and
    // a link signed for a file replaced under the same key forgotten.
    stats.puts++;
    inBucket.add(key);
    linkCache.delete(key);
    dropDiskCopy(key);
  } catch (error) {
    stats.putFails++;
    stats.lastPutError = `${key}: ${error instanceof Error ? `${error.name} ${error.message}` : String(error)}`.slice(0, 300);
    console.error("[uploads] could not copy to the bucket:", key, error);
    import("@sentry/nextjs").then((Sentry) => Sentry.captureException(error)).catch(() => {});
  }
}

export async function deleteUpload(publicPath: string | null | undefined) {
  const b = bucket();
  const key = publicPath ? keyOf(publicPath) : null;
  if (!key) return;
  // Its small copies go with it (19 Oct), wherever they were made, and a video's poster (21 Oct);
  // the ones of this version too (23 Oct: a stamped path's copies carry its stamp).
  const v = versionOf(publicPath);
  const smalls = [...SMALL_WIDTHS.flatMap((w) => [smallKey(key, w), v ? smallKey(key, w, v) : null]), posterKey(key)].filter(
    (k): k is string => !!k
  );
  for (const k of smalls) dropDiskCopy(k);
  // And from the server's memory (4 Nov: a meal's photo replaced under the same name showed the old one's copy).
  for (const k of smalls) forget(k);
  if (!b) return;
  for (const k of [key, ...smalls]) {
    inBucket.delete(k);
    linkCache.delete(k);
    try {
      await b.s3.send(new DeleteObjectCommand({ Bucket: b.bucket, Key: k }));
    } catch {
      /* already gone */
    }
  }
}

// ---- Small copies of pictures (19 Oct, Alex: the chat's photos were slow on
// the phone). A phone photo is several MB; the chat draws it about 260 px
// wide. "/uploads/<key>?w=1080" answers with a WebP that wide, made once with
// sharp and kept beside the original in the same client folder (so erasing a
// client takes them too): "chat/9/abc.jpg" -> "chat/9/_w1080/abc.webp".
// 96 (23 Oct, Alex: "the profile pics load by chunks"): the faces, drawn at
// 48 px at most, were each the whole phone photo. A path stamped with its
// version ("avatars/9/avatar.jpg?v=1729…", a replaced photo keeps its name)
// keeps that stamp in its copy's name, "avatars/9/_w96/avatar-v1729….webp",
// so a new photo never shows the old one's copy.
export const SMALL_WIDTHS = [96, 480, 1080];
/** What the chat draws (prepareChatMedia makes these at the send); faces are not chat pictures. */
const CHAT_WIDTHS = SMALL_WIDTHS.filter((w) => w >= 480);

/** The "?v=" stamp of a stored path or a request's query, when it is one we wrote (Date.now()). */
export function versionOf(pathOrStamp: string | null | undefined): string | null {
  if (!pathOrStamp) return null;
  const at = pathOrStamp.indexOf("?");
  const v = pathOrStamp.startsWith("/") ? (at < 0 ? null : new URLSearchParams(pathOrStamp.slice(at + 1)).get("v")) : pathOrStamp;
  return v && /^\d{1,16}$/.test(v) ? v : null;
}

export function smallKey(key: string, w: number, v?: string | null): string | null {
  if (!/\.(jpe?g|png|webp)$/i.test(key)) return null;
  const parts = key.split("/");
  if (parts.length < 3) return null;
  const [kind, owner, ...rest] = parts;
  const stamp = versionOf(v);
  return `${kind}/${owner}/_w${w}/${rest.join("/").replace(/\.[^.]+$/, "")}${stamp ? `-v${stamp}` : ""}.webp`;
}

// ---- The small copies and posters lately made or served, kept in the server's memory (25 Oct, Alex: "the media sent
// in chats takes a few seconds to load"): the coach, the client and the coach's phone each ask for a picture just sent,
// and every ask went to the bucket and back. Most recently used kept, 32 MB at most (4 Nov, Alex: was 96 MB; Railway
// bills the memory held, and the posters and chat copies of a few threads fit in 32); a restart empties it. On
// globalThis, so the uploads route and the server actions (built into different bundles) share one.
const MEMO_BYTES = 32 * 1024 * 1024;
const shared = globalThis as unknown as { _uploadsMemo?: { map: Map<string, Buffer>; size: number }; _uploadsMaking?: Map<string, Promise<Buffer | null>> };
const memo = (shared._uploadsMemo ??= { map: new Map(), size: 0 });
const isCopy = (key: string) => /\/(_w\d+|_poster)\//.test(key);
function remember(key: string, bytes: Buffer) {
  if (bytes.length > 4 * 1024 * 1024) return;
  const old = memo.map.get(key);
  if (old) {
    memo.map.delete(key);
    memo.size -= old.length;
  }
  memo.map.set(key, bytes);
  memo.size += bytes.length;
  for (const [k, v] of memo.map) {
    if (memo.size <= MEMO_BYTES) break;
    memo.map.delete(k);
    memo.size -= v.length;
  }
}
function forget(key: string) {
  const old = memo.map.get(key);
  if (!old) return;
  memo.map.delete(key);
  memo.size -= old.length;
}
function recall(key: string): Buffer | null {
  const hit = memo.map.get(key);
  if (!hit) return null;
  memo.map.delete(key);
  memo.map.set(key, hit);
  return hit;
}

/** How the copies fare, for /api/timing (25 Oct): what memory holds, the bucket's saves and reads, the last error. */
const stats = ((globalThis as unknown as { _uploadsStats?: { puts: number; putFails: number; lastPutError: string | null; getFails: number; lastGetError: string | null; made: string[] } })._uploadsStats ??= {
  puts: 0,
  putFails: 0,
  lastPutError: null,
  getFails: 0,
  lastGetError: null,
  made: [],
});
export const storageStats = async () => ({ ffmpeg: (await import("./transcode")).ffmpegInfo(), lastFrameError: (await import("./transcode")).lastFrameError, memoCount: memo.map.size, memoMB: Math.round((memo.size / 1048576) * 10) / 10, ...stats, made: stats.made.slice(-12) });

/** Where each file was last read from, for the uploads route's timing (25 Oct): memory, disk, bucket, made. */
const lastSource = new Map<string, string>();
export const sourceOf = (key: string) => {
  const s = lastSource.get(key) ?? null;
  lastSource.delete(key);
  return s;
};

/** How far the bucket is (25 Oct, Alex: "media still takes a decent amount of seconds to load"): its host and three
    smallest asks timed, for /api/timing. Null with the bucket off. */
export async function bucketProbe(): Promise<{ host: string; region: string; ms: number[] } | null> {
  const b = bucket();
  if (!b) return null;
  const ms: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      await b.s3.send(new ListObjectsV2Command({ Bucket: b.bucket, MaxKeys: 1 }));
    } catch {}
    ms.push(Math.round(performance.now() - t0));
  }
  let host = "";
  try {
    host = new URL(process.env.UPLOADS_ENDPOINT ?? "").host;
  } catch {}
  return { host, region: process.env.UPLOADS_REGION || "auto", ms };
}

/** The bucket said there is no such file. */
const missing = (error: unknown) => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return e?.name === "NoSuchKey" || e?.name === "NotFound" || e?.$metadata?.httpStatusCode === 404;
};

/** A file's bytes: from memory, the disk (a file not copied to the bucket yet) or the bucket; null when it is nowhere.
    One trip to the bucket, a read that answers "not there" itself (25 Oct: a check first made it two). */
async function readUpload(key: string): Promise<Buffer | null> {
  const hit = recall(key);
  if (hit) {
    lastSource.set(key, "memory");
    return hit;
  }
  const file = path.join(DATA_DIR, "uploads", key);
  if (fs.existsSync(file)) {
    lastSource.set(key, "disk");
    return fs.readFileSync(file);
  }
  lastSource.set(key, "bucket");
  const b = bucket();
  if (!b) return null;
  try {
    const r = await b.s3.send(new GetObjectCommand({ Bucket: b.bucket, Key: key }));
    const bytes = await (r.Body as { transformToByteArray: () => Promise<Uint8Array> } | undefined)?.transformToByteArray();
    if (!bytes) return null;
    inBucket.add(key);
    const buf = Buffer.from(bytes);
    if (isCopy(key)) remember(key, buf);
    return buf;
  } catch (error) {
    if (missing(error)) return null;
    stats.getFails++;
    stats.lastGetError = `${key}: ${error instanceof Error ? `${error.name} ${error.message}` : String(error)}`.slice(0, 300);
    throw error;
  }
}

// ---- Made once, kept in the browser (21 Oct, Alex: the chat's pictures and
// videos were slow). A chat upload's name (and a client's exercise video's) is
// a stamp that is never used again, so its small copies and poster can stay
// in the browser for good. They are sent by the app rather than through a
// link into the bucket: that link is signed afresh every few minutes and on
// every restart, and each new one was downloaded again, every picture of the
// thread on every open.
const keptForGood = (key: string) => /^(chat|videos)\//.test(key);
const FOR_GOOD = "private, max-age=31536000, immutable";
const A_DAY = "private, max-age=86400";
const smallCache = (key: string) => (keptForGood(key) ? FOR_GOOD : A_DAY);
// A small copy is for good too when its name is never used again (23 Oct): a
// card picture's and a support screenshot's are a stamp each, and a stamped
// path ("?v=") names one version of a photo that keeps its file name.
// A meal's picture since 9 Nov: a stamp in its name (saveMealPhoto), so the phone keeps it for good.
const namedOnce = (key: string) => keptForGood(key) || /^(covers|support)\//.test(key) || /^meals\/.+-\d{13}\.[a-z]+$/i.test(key);
const webp = (bytes: Buffer, cache: string) =>
  new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Cache-Control": cache } });

// Two asks for one copy at once (the panel and the send's own) make it once; shared across bundles as the memory is.
const making = (shared._uploadsMaking ??= new Map<string, Promise<Buffer | null>>());
function once(key: string, make: () => Promise<Buffer | null>): Promise<Buffer | null> {
  let p = making.get(key);
  if (!p) {
    p = make().finally(() => making.delete(key));
    making.set(key, p);
  }
  return p;
}

/** A made copy, beside its original: in the bucket when it is on, else on the disk. */
async function keepCopy(copy: string, bytes: Buffer) {
  if (bucket()) return putUpload(`/uploads/${copy}`, bytes, "image/webp");
  const onDisk = path.join(DATA_DIR, "uploads", copy);
  fs.mkdirSync(path.dirname(onDisk), { recursive: true });
  fs.writeFileSync(onDisk, bytes);
}

/** The longest side a photo is kept at (4 Nov, Alex, fix 2: storage). A bit more than shape updates' 1600 (fitJpeg in
    the browser), since a chat photo opens on the whole screen; the 1080 copy is what the viewer shows first anyway. */
export const PHOTO_MAX = 2048;

/**
 * A photo as it is kept (4 Nov, Alex, fix 2: "shrink photos"): a phone's original is 2–4 MB at ~4000 px, and it was
 * kept whole, for the chat, a meal, an exercise and the faces. Now its longest side 2048 at most, turned upright by its
 * EXIF, a JPEG at 82; a PNG with see-through parts (a screenshot with alpha) stays a PNG. Re-encoded either way, so the
 * camera's block (the location with it) goes, as fitJpeg drops it. Null, and the caller keeps what came as before,
 * when sharp can't read it (an iPhone HEIC: sharp has no HEVC; iOS hands a picked photo over as a JPEG) or it moves (a
 * GIF, an animated WebP). Never throws.
 */
export async function fitPhoto(input: Buffer): Promise<{ bytes: Buffer; type: "image/jpeg" | "image/png" } | null> {
  try {
    const sharp = await loadSharp();
    const meta = await sharp(input, { failOn: "none" }).metadata();
    if (!meta.width || !meta.height || meta.format === "gif" || (meta.pages ?? 1) > 1) return null;
    const alpha = meta.format === "png" && !!meta.hasAlpha && !(await sharp(input, { failOn: "none" }).stats()).isOpaque;
    const fitted = sharp(input, { failOn: "none" }).rotate().resize({ width: PHOTO_MAX, height: PHOTO_MAX, fit: "inside", withoutEnlargement: true });
    if (alpha) return { bytes: await fitted.png({ compressionLevel: 9 }).toBuffer(), type: "image/png" };
    return { bytes: await fitted.flatten({ background: "#ffffff" }).jpeg({ quality: 82, progressive: true }).toBuffer(), type: "image/jpeg" };
  } catch (error) {
    console.warn("[uploads] photo kept as it came:", error instanceof Error ? error.message : error);
    return null;
  }
}

/** A file name's extension made the fitted photo's ("IMG_1234.HEIC" -> "IMG_1234.jpg"), for saveChatMedia, which takes
    a picture's extension from its name first. */
export const photoName = (name: string | null | undefined, type: string) => `${(name || "photo").replace(/\.[^./]*$/, "") || "photo"}.${type === "image/png" ? "png" : "jpg"}`;

async function shrink(original: Buffer, w: number): Promise<Buffer> {
  const sharp = await loadSharp();
  return sharp(original, { failOn: "none" }).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
}

async function makeSmall(key: string, small: string, w: number, original?: Buffer | null): Promise<Buffer | null> {
  const from = original ?? (await readUpload(key));
  if (!from) return null;
  const out = await shrink(from, w);
  // Shown at once; its copy goes to the bucket behind the answer (25 Oct: the upload was waited for first).
  remember(small, out);
  void keepCopy(small, out).catch(() => {});
  return out;
}

/**
 * A picture's small copies made now from the bytes just uploaded (27 Oct, Alex: shape update photos "take a little bit
 * to load"): the grid's 480 and the deck's, the viewer's and Compare's 1080, so the first look is never the one that
 * waits for the bucket and the resize. As the chat's are made at the send (prepareChatMedia). Never throws.
 */
export async function warmSmallCopies(publicPath: string, original: Buffer, widths: number[] = [480, 1080]): Promise<void> {
  const at = publicPath.indexOf("?");
  const key = (at < 0 ? publicPath : publicPath.slice(0, at)).replace(/^\/uploads\//, "");
  const v = versionOf(publicPath);
  for (const w of widths) {
    const small = smallKey(key, w, v);
    if (!small) continue;
    try {
      await once(small, () => makeSmall(key, small, w, original));
    } catch (error) {
      console.error(`[uploads] no small copy of ${key} at ${w}:`, error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Every shape update photo of a client with its small copies, made now where one is missing (27 Oct, Alex: Compare
 * "loading a bit slowly"): photos from before copies were made at the upload had theirs made on the first look, which
 * waited. Called as the coach or the client opens Shape update; once per client while the server runs, one photo after
 * another, behind the page. Never throws.
 */
const warmedClients = new Set<number>();
export function warmClientPhotos(clientId: number): void {
  if (warmedClients.has(clientId)) return;
  warmedClients.add(clientId);
  void (async () => {
    try {
      const data = getData();
      const slots = new Set(data.photo_slots.filter((s) => s.client_id === clientId).map((s) => s.id));
      const paths = data.photo_uploads.filter((u) => slots.has(u.slot_id) && u.file_path).map((u) => u.file_path);
      const b = bucket();
      for (const p of paths) {
        const key = keyOf(p);
        if (!key) continue;
        for (const w of [480, 1080]) {
          const small = smallKey(key, w, versionOf(p));
          if (!small || memo.map.has(small)) continue;
          const there = b ? await exists(b, small) : fs.existsSync(path.join(DATA_DIR, "uploads", small));
          if (there) continue;
          await once(small, () => makeSmall(key, small, w)).catch(() => null);
        }
      }
    } catch (error) {
      console.error(`[uploads] warming client ${clientId}'s photos:`, error instanceof Error ? error.message : error);
    }
  })();
}

/**
 * The small copy as a response, always its bytes through the app (23 Oct: a
 * link into the bucket is signed afresh every few minutes and on every
 * restart, and the browser fetched each face again with every new one). For
 * good when the copy's name is never used again (a stamped "?v=" or a name
 * made once), else for a day. Made at the send for the chat
 * (prepareChatMedia), else on the first ask. Null (serve the original) when
 * the file is not a picture, cannot be read, or sharp is missing.
 */
export async function smallCopy(key: string, w: number, v?: string | null): Promise<Response | null> {
  const stamp = versionOf(v);
  const small = smallKey(key, w, stamp);
  if (!small || !SMALL_WIDTHS.includes(w)) return null;
  try {
    let bytes = await readUpload(small);
    if (!bytes) {
      bytes = await once(small, () => makeSmall(key, small, w));
      lastSource.set(small, "made");
    }
    lookLater(key, bytes);
    return bytes ? webp(bytes, stamp || namedOnce(key) ? FOR_GOOD : A_DAY) : null;
  } catch (error) {
    console.error(`[uploads] no small copy of ${key}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ---- A video's poster (21 Oct): its first frame as a small WebP, so a chat
// shows every video at once without fetching any of it. Before, the phone was
// asked for a time (#t=0.001) to draw a frame at all, and fetched megabytes of
// each video to do it. "chat/9/abc.mp4" -> "chat/9/_poster/abc.webp".
export function posterKey(key: string): string | null {
  if (!/\.(mp4|mov|m4v|webm)$/i.test(key)) return null;
  const parts = key.split("/");
  if (parts.length < 3) return null;
  const [kind, owner, ...rest] = parts;
  return `${kind}/${owner}/_poster/${rest.join("/").replace(/\.[^.]+$/, "")}.webp`;
}

// Videos ffmpeg couldn't read (or no ffmpeg): not tried again until the server restarts.
const noPoster = new Map<string, number>();

async function makePoster(key: string, poster: string): Promise<Buffer | null> {
  // A failure is tried again after ten minutes (25 Oct: a slow bucket once kept a video frameless until a restart).
  const failed = noPoster.get(key);
  if (failed && Date.now() - failed < 10 * 60 * 1000) {
    lastSource.set(poster, "missing:failed-before");
    return null;
  }
  const onDisk = path.join(DATA_DIR, "uploads", key);
  const source = fs.existsSync(onDisk) ? onDisk : await bucketLink(key);
  if (!source) {
    lastSource.set(poster, "missing:no-file");
    return null;
  }
  const { firstFrame } = await import("./transcode");
  let frame = await firstFrame(source);
  if (!frame) {
    noPoster.set(key, Date.now());
    lastSource.set(poster, "missing:no-frame");
    stats.made.push(`FAILED ${new Date().toISOString().slice(11, 19)} ${poster}`);
    return null;
  }
  const sharp = await loadSharp();
  // A recording that opens on black (the coach's form reviews do) is shown a second in.
  const dark = async (jpg: Buffer) => (await sharp(jpg).stats()).channels.slice(0, 3).every((c) => c.mean < 12);
  if (await dark(frame)) frame = (await firstFrame(source, 1)) ?? frame;
  const out = await sharp(frame, { failOn: "none" }).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
  remember(poster, out);
  stats.made.push(`${new Date().toISOString().slice(11, 19)} ${poster}`);
  void keepCopy(poster, out).catch(() => {});
  return out;
}

/** The poster as a response ("?poster=1"); null when the file is not a video or no frame could be had. */
export async function posterCopy(key: string): Promise<Response | null> {
  const poster = posterKey(key);
  if (!poster) return null;
  try {
    let bytes = await readUpload(poster);
    if (!bytes) {
      bytes = await once(poster, () => makePoster(key, poster));
      // "made" only when it was; else the reason makePoster left (25 Oct: a failure read as made).
      if (bytes) lastSource.set(poster, "made");
      else if (!lastSource.get(poster)?.startsWith("missing")) lastSource.set(poster, "missing");
    }
    lookLater(key, bytes);
    return bytes ? webp(bytes, smallCache(key)) : null;
  } catch (error) {
    console.error(`[uploads] no poster for ${key}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/** A picture's look from a small copy of it (25 Oct): its width and height and a 20px preview as a data URI. */
async function lookOf(bytes: Buffer): Promise<{ thumb: string | null; w: number | null; h: number | null }> {
  const sharp = await loadSharp();
  const meta = await sharp(bytes).metadata();
  const tiny = await sharp(bytes, { failOn: "none" }).resize({ width: 20 }).webp({ quality: 40 }).toBuffer();
  return { thumb: `data:image/webp;base64,${tiny.toString("base64")}`, w: meta.width ?? null, h: meta.height ?? null };
}
/** The look onto the chat messages showing this file. */
async function keepLook(publicPath: string, bytes: Buffer | null) {
  if (!bytes) return;
  try {
    const { setChatMediaLook } = await import("./queries");
    setChatMediaLook(publicPath.split("?")[0], await lookOf(bytes));
  } catch (error) {
    console.error("[uploads] no look for", publicPath, error instanceof Error ? error.message : error);
  }
}
// A chat picture or video from before looks were kept: its look made the first time a copy of it is served.
const looked = ((globalThis as unknown as { _uploadsLooked?: Set<string> })._uploadsLooked ??= new Set<string>());
function lookLater(key: string, bytes: Buffer | null) {
  if (!bytes || !key.startsWith("chat/") || looked.has(key)) return;
  looked.add(key);
  void import("./queries").then(({ chatMediaLacksLook }) => (chatMediaLacksLook(`/uploads/${key}`) ? keepLook(`/uploads/${key}`, bytes) : undefined)).catch(() => {});
}

/**
 * A thread read with pictures or videos that have no look yet (sent before 25 Oct): each made once a server run, behind
 * the answer, from its small copy or poster, so the next read has it. Never waits, never throws.
 */
// Videos one after another (4 Nov, Alex: memory is most of the bill): a thread of old videos had a poster made for each
// at once, ffmpeg and the frames all together. On globalThis, as the memory is, so every bundle shares the one line.
const looksLine = globalThis as unknown as { _uploadsLooksLine?: Promise<unknown> };
export function fillChatLooks(items: { path: string; type: string }[]) {
  for (const it of items) {
    const key = keyOf(it.path);
    if (!key || looked.has(key) || (it.type !== "image" && it.type !== "video")) continue;
    looked.add(key);
    const copy = it.type === "video" ? posterKey(key) : smallKey(key, CHAT_WIDTHS[0]);
    if (!copy) continue;
    const make = () => (it.type === "video" ? makePoster(key, copy) : makeSmall(key, copy, CHAT_WIDTHS[0]));
    const fill = async () => keepLook(it.path, (await readUpload(copy)) ?? (await once(copy, make)));
    if (it.type !== "video") {
      void fill().catch(() => {});
      continue;
    }
    const next = (looksLine._uploadsLooksLine ?? Promise.resolve()).then(fill, fill);
    looksLine._uploadsLooksLine = next.catch(() => {});
  }
}

/**
 * Everything a chat or an exercise needs to show at once, made ahead for what came before (25 Oct, Alex: "I can't
 * launch a product whose chat takes 20+ seconds to load media"): every chat picture's small copies and every video's
 * poster, and the look (size and preview) on each message; every exercise photo's and video's poster or copy. One at
 * a time, a while after the server starts, so pages never wait on it; what is there already is only checked.
 */
export async function prepareAllChatMedia(): Promise<number> {
  const { getData } = await import("./db");
  const data = getData();
  let made = 0;
  const seen = new Set<string>();
  const items: { path: string; type: "image" | "video"; chat: boolean; card?: boolean }[] = [];
  for (const m of data.chat_messages) {
    if (!m.media_path || (m.media_type !== "image" && m.media_type !== "video")) continue;
    if (m.media_thumb || seen.has(m.media_path)) continue;
    seen.add(m.media_path);
    items.push({ path: m.media_path, type: m.media_type, chat: true });
  }
  for (const v of data.video_requests ?? []) {
    if (!v.file_path || seen.has(v.file_path)) continue;
    seen.add(v.file_path);
    items.push({ path: v.file_path, type: v.media === "photo" ? "image" : "video", chat: false });
  }
  // A meal's picture, day's or saved, from before they had a preview (10 Nov, Alex): the card draws its 1080 as well.
  for (const p of [...data.meal_photos.filter((m) => !m.thumb).map((m) => m.file_path), ...data.saved_meals.filter((m) => m.picture && !m.picture_thumb).map((m) => m.picture!)]) {
    if (seen.has(p)) continue;
    seen.add(p);
    items.push({ path: p, type: "image", chat: true, card: true });
  }
  for (const it of items) {
    const key = keyOf(it.path);
    if (!key) continue;
    const copy = it.type === "video" ? posterKey(key) : smallKey(key, CHAT_WIDTHS[0]);
    if (!copy) continue;
    try {
      let bytes = await readUpload(copy);
      if (!bytes) {
        bytes = await once(copy, () => (it.type === "video" ? makePoster(key, copy) : makeSmall(key, copy, CHAT_WIDTHS[0])));
        if (bytes) made++;
      }
      if (it.chat) {
        looked.add(key);
        await keepLook(it.path, bytes);
      }
      if (it.card) {
        const wide = smallKey(key, 1080);
        if (wide && !(await readUpload(wide))) await once(wide, () => makeSmall(key, wide, 1080));
      }
    } catch (error) {
      console.warn(`[uploads] could not prepare ${key}:`, error instanceof Error ? error.message : error);
    }
  }
  return made;
}

/** A video's first frame sent by the device that sent it (25 Oct): made its poster (WebP, 720 at most) and its look,
    so it shows at once whatever the server's ffmpeg can do. */
export async function posterFromDevice(publicPath: string, frame: Buffer) {
  const key = keyOf(publicPath);
  const poster = key ? posterKey(key) : null;
  if (!key || !poster) return;
  try {
    const sharp = await loadSharp();
    const out = await sharp(frame, { failOn: "none" }).rotate().resize({ width: 720, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
    remember(poster, out);
    await keepCopy(poster, out);
    await keepLook(publicPath, out);
  } catch (error) {
    console.error(`[uploads] no device poster for ${key}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * Right after a chat send (21 Oct): a picture's small copies and a video's
 * poster, so the first person to open the chat gets them at once. Before, the
 * first open of a thread made each one then: the whole original read from the
 * bucket and shrunk, about three seconds a picture.
 */
export async function prepareChatMedia(publicPath: string, type: "image" | "video", bytes?: Buffer) {
  const key = keyOf(publicPath);
  if (!key) return;
  try {
    if (type === "video") {
      const poster = posterKey(key);
      // One the sending device gave is kept; else made here.
      if (poster) await keepLook(publicPath, (await readUpload(poster)) ?? (await once(poster, () => makePoster(key, poster))));
      return;
    }
    if (!smallKey(key, CHAT_WIDTHS[0])) return;
    // The send's own bytes when it has them: not fetched back from the bucket it just went to (25 Oct).
    const original = bytes ?? (await readUpload(key));
    if (!original) return;
    for (const w of CHAT_WIDTHS) {
      const small = smallKey(key, w)!;
      const made = await once(small, () => makeSmall(key, small, w, original));
      if (w === CHAT_WIDTHS[0]) await keepLook(publicPath, made);
    }
  } catch (error) {
    console.error(`[uploads] could not prepare ${key}:`, error instanceof Error ? error.message : error);
  }
}

/**
 * A video as its small web copy (25 Oct, Alex: videos slow to play): made beside the original ("chat/9/abc.mov" ->
 * "chat/9/abc-web.mp4"), put in the bucket, what showed the original pointed at it and its poster made. A chat
 * message's video, and since 4 Nov (Alex, fix 2) a client's exercise video too ("videos/9/12-1730….mov" ->
 * "videos/9/12-1730…-web.mp4"; the coach reviews it from the row's path, so the copy). Nothing changes when ffmpeg
 * can't make one. `dropOriginal` (4 Nov, Alex, fix 2: "drop video originals once a web copy exists"; the sends ask
 * it): once the copy is in and every message or exercise row shows it, the original goes from the bucket and the disk,
 * an hour later (dropOriginalLater). A first play of a message from before (the uploads route) doesn't ask it: their
 * originals are left alone.
 */
// One web copy in the making a video (4 Nov, review): the send (a server action) and a first play (the uploads route)
// are different bundles, and each checked for a copy before either had made one, so both made it, one after the
// other in the line. On globalThis so both share it; a later call finds the copy made and only does the swap.
const webbingNow = ((globalThis as unknown as { _uploadsWebbing?: Map<string, Promise<void>> })._uploadsWebbing ??= new Map());
// The originals some caller asked to drop, read once the copy in the making is done (whichever call started it).
const dropWanted = ((globalThis as unknown as { _uploadsDropWanted?: Set<string> })._uploadsDropWanted ??= new Set());
export function webVideo(publicPath: string, opts: { dropOriginal?: boolean } = {}): Promise<void> {
  const key = keyOf(publicPath);
  if (!key || /-web\.mp4$/i.test(key)) return Promise.resolve();
  if (opts.dropOriginal) dropWanted.add(key);
  let p = webbingNow.get(key);
  if (!p) {
    p = makeWebVideo(publicPath, key).finally(() => {
      webbingNow.delete(key);
      dropWanted.delete(key);
    });
    webbingNow.set(key, p);
  }
  return p;
}
/** The chat's name for it (the uploads route's first play). */
export const webChatVideo = (publicPath: string, opts: { dropOriginal?: boolean } = {}) => webVideo(publicPath, opts);

/** Whether a message or an exercise row still shows this file (a client's video, a coach's review, a chat file). */
function fileShown(publicPath: string): boolean {
  const data = getData();
  return (
    data.chat_messages.some((m) => m.media_path === publicPath) ||
    (data.video_requests ?? []).some((r) => r.file_path === publicPath || r.reply_file_path === publicPath)
  );
}

/** A client's exercise videos pointed at the web copy, as swapChatMedia does a chat's. */
function swapExerciseVideo(from: string, to: string): number {
  let n = 0;
  for (const r of getData().video_requests ?? []) {
    if (r.file_path !== from) continue;
    r.file_path = to;
    n++;
  }
  if (n) persist();
  return n;
}

async function makeWebVideo(publicPath: string, key: string) {
  void dropDueOriginals();
  try {
    const webKey = key.replace(/\.[^./]+$/, "") + "-web.mp4";
    const out = path.join(DATA_DIR, "uploads", webKey);
    const webPath = `/uploads/${webKey}`;
    // A copy made before is not made again (4 Nov, Alex: memory is most of the bill; a send and a first play could each
    // start one): in the bucket when it is on, else whole on the disk (toWebVideo names it only once finished).
    const b = bucket();
    const made = b ? await exists(b, webKey) : fs.existsSync(out) && fs.statSync(out).size > 0;
    if (!made) {
      const onDisk = path.join(DATA_DIR, "uploads", key);
      const source = fs.existsSync(onDisk) ? onDisk : await bucketLink(key);
      if (!source) return;
      fs.mkdirSync(path.dirname(out), { recursive: true });
      const { toWebVideo } = await import("./transcode");
      if (!(await toWebVideo(source, out))) return;
      await putUploadFromDisk(webPath, out, "video/mp4");
    }
    // Its poster first, so the message never points at a copy without one: made (or the one made before), else the
    // original's carried over.
    const poster = posterKey(webKey);
    const had = made && poster ? await readUpload(poster) : null;
    if (poster && !had && !(await once(poster, () => makePoster(webKey, poster)))) {
      const was = posterKey(key);
      const bytes = was ? await readUpload(was) : null;
      if (bytes) {
        remember(poster, bytes);
        await keepCopy(poster, bytes);
      }
    }
    const { swapChatMedia } = await import("./queries");
    swapChatMedia(publicPath, webPath);
    swapExerciseVideo(publicPath, webPath);
    // Nothing shows the copy (the message deleted, the exercise's video replaced or taken back meanwhile, and the
    // original gone with it): the copy goes too, so it never sits in the bucket unseen.
    if (!fileShown(webPath)) {
      dropDiskCopy(webKey);
      await deleteUpload(webPath);
      return;
    }
    await prepareChatMedia(webPath, "video");
    if (dropWanted.has(key) && !fileShown(publicPath)) dropOriginalLater(publicPath, webPath);
  } catch (error) {
    console.error(`[uploads] no web copy of ${key}:`, error instanceof Error ? error.message : error);
  }
}

// ---- A video's original dropped once its web copy shows (4 Nov, Alex, fix 2: Railway bills what the bucket holds; a
// phone's original is 30–128 MB, its web copy a tenth of that). An hour's grace first: a coach who opened the client's
// video before the copy was made is still playing or recording a review from the original, and a page opened before
// the swap still links it. The list is kept on the disk beside the data, so a restart in that hour still drops them:
// the next web copy made, or the next upload, runs what is due. Before dropping it is checked again: nothing shows the
// original any more, and the copy, when something shows it, is there (the bucket or the disk). Otherwise it stays.
const DROP_AFTER_MS = 60 * 60 * 1000;
const DROP_FILE = path.join(DATA_DIR, "originals-to-drop.json");
type Drop = { path: string; web: string; at: number };

function readDrops(): Drop[] {
  try {
    const list = JSON.parse(fs.readFileSync(DROP_FILE, "utf8"));
    return Array.isArray(list) ? list.filter((d): d is Drop => !!d && typeof d.path === "string" && typeof d.web === "string" && typeof d.at === "number") : [];
  } catch {
    return [];
  }
}
function writeDrops(list: Drop[]) {
  try {
    if (list.length) fs.writeFileSync(DROP_FILE, JSON.stringify(list));
    else fs.rmSync(DROP_FILE, { force: true });
  } catch (error) {
    console.error("[uploads] could not keep the originals to drop:", error instanceof Error ? error.message : error);
  }
}

function dropOriginalLater(original: string, web: string) {
  writeDrops([...readDrops().filter((d) => d.path !== original), { path: original, web, at: Date.now() + DROP_AFTER_MS }]);
  const t = setTimeout(() => void dropDueOriginals(), DROP_AFTER_MS + 5000);
  t.unref?.();
}

/** Has the bucket or the disk the file. */
async function fileThere(publicPath: string): Promise<boolean> {
  const key = keyOf(publicPath);
  if (!key) return false;
  const onDisk = path.join(DATA_DIR, "uploads", key);
  if (fs.existsSync(onDisk) && fs.statSync(onDisk).size > 0) return true;
  const b = bucket();
  return b ? exists(b, key) : false;
}

// One run at a time, shared by every bundle.
const dropping = globalThis as unknown as { _uploadsDropping?: Promise<void> | null };
/** Drops every original whose hour is up (see above). Never throws. */
export function dropDueOriginals(): Promise<void> {
  if (dropping._uploadsDropping) return dropping._uploadsDropping;
  const run = (async () => {
    const due = readDrops().filter((d) => d.at <= Date.now());
    if (!due.length) return;
    const settled = new Set<string>();
    for (const d of due) {
      try {
        const key = keyOf(d.path);
        // Still shown, or its copy shown but not there (kept, to put right by hand): the original stays, not asked again.
        // Its copy shown by nothing either (the exercise's video replaced or taken back, the message deleted, in that
        // hour): nothing needs the original, it goes.
        if (key && !fileShown(d.path) && (!fileShown(d.web) || (await fileThere(d.web)))) {
          dropDiskCopy(key);
          await deleteUpload(d.path);
          console.log(`[uploads] original dropped for its web copy: ${key}`);
        }
        settled.add(d.path);
      } catch (error) {
        console.error(`[uploads] could not drop ${d.path}:`, error instanceof Error ? error.message : error);
      }
    }
    // Read again: one added while these went stays on the list.
    writeDrops(readDrops().filter((d) => !settled.has(d.path)));
  })()
    .catch(() => {})
    .finally(() => {
      dropping._uploadsDropping = null;
    });
  dropping._uploadsDropping = run;
  return run;
}

/** Deletes every object whose key starts with `prefix` ("progress/9/"); returns how many. */
export async function deleteAllUnder(s3: S3Client, bucketName: string, prefix: string): Promise<number> {
  let deleted = 0;
  let token: string | undefined;
  do {
    const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucketName, Prefix: prefix, ContinuationToken: token }));
    const keys = (listed.Contents ?? []).filter((o) => o.Key).map((o) => ({ Key: o.Key! }));
    if (keys.length) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucketName, Delete: { Objects: keys, Quiet: true } }));
      deleted += keys.length;
    }
    token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
  } while (token);
  return deleted;
}

/**
 * Deletes a folder of uploads ("progress/9/") everywhere it lives: the disk
 * and the bucket. For erasing a client; one file at a time is deleteUpload.
 */
export async function deleteUploadFolder(folder: string) {
  if (!/^[a-z]+\/\d+\/$/.test(folder)) throw new Error(`Not a client upload folder: ${folder}`);
  fs.rmSync(path.join(DATA_DIR, "uploads", folder), { recursive: true, force: true });
  const b = bucket();
  if (!b) return;
  for (const key of inBucket) if (key.startsWith(folder)) inBucket.delete(key);
  await deleteAllUnder(b.s3, b.bucket, folder);
}

/** A link into the bucket that expires, or null to serve the file from the disk. */
// One signed link per file for most of its lifetime (15 Oct): a fresh signature on
// every request meant a new URL each time, so the browser could never reuse a photo
// it had just downloaded and a chat re-fetched every image on every open.
// Since 4 Nov (Alex: Railway's egress) one link a file for a whole 6-day window, signed as at the window's first moment
// (`signingDate`), so a restart signs the very same link and the phone's cache still holds what it downloaded. A file
// replaced under the same name (a face, a card picture) has a new "?v=" stamp; the stamp moves the signing moment a few
// seconds, so the replaced file gets a link of its own and never shows the old one's bytes. Always moved back, before the
// window's first moment, never into it: a link signed for a moment still to come is refused by the bucket ("not yet
// valid") until then, and the browser would keep that redirect for days. Five minutes more back for a clock running
// ahead of the bucket's; the link still lasts close to a day past the window's end.
const linkCache = new Map<string, string>();
let linkCacheWindow = 0;
const windowStart = (now = Date.now()) => Math.floor(now / LINK_WINDOW_MS) * LINK_WINDOW_MS;
/** Seconds further back a "?v=" stamp signs at: 1–3600, the same for the same stamp; 0 with none. */
function stampSeconds(v: string | null | undefined): number {
  const stamp = versionOf(v);
  if (!stamp) return 0;
  let h = 2166136261;
  for (let i = 0; i < stamp.length; i++) h = Math.imul(h ^ stamp.charCodeAt(i), 16777619);
  return ((h >>> 0) % 3600) + 1;
}

export async function bucketLink(key: string, v?: string | null): Promise<string | null> {
  const b = bucket();
  if (!b) return null;
  const start = windowStart();
  if (start !== linkCacheWindow) {
    linkCache.clear();
    linkCacheWindow = start;
  }
  const at = stampSeconds(v);
  const id = `${key}@${at}`;
  const hit = linkCache.get(id);
  if (hit) return hit;
  // Not copied to the bucket yet: served from the disk. Otherwise signed at once, no trip to the bucket to ask first
  // (25 Oct): signing is worked out here, and a file gone from both answers 404 from the bucket.
  if (fs.existsSync(path.join(DATA_DIR, "uploads", key))) return null;
  const url = await getSignedUrl(b.s3, new GetObjectCommand({ Bucket: b.bucket, Key: key }), {
    expiresIn: LINK_SECONDS,
    signingDate: new Date(start - (SIGN_EARLY_SECONDS + at) * 1000),
  });
  linkCache.set(id, url);
  return url;
}

/** How long the browser may keep the /uploads redirect (4 Nov): to the window's end, less ten minutes, so it never holds
    one past the link's life (the link lasts a day beyond the window). A minute at least. */
export function linkFreshSeconds(now = Date.now()): number {
  return Math.max(60, Math.floor((windowStart(now) + LINK_WINDOW_MS - now) / 1000) - 10 * 60);
}

/** A redirect's keep for callers that don't ask (the support screenshots): an hour, well inside any link's life. */
export const LINK_CACHE_SECONDS = 60 * 60;

/**
 * The file's bytes through the app instead of a link into the bucket (10 Oct):
 * for the coach's whiteboard, which draws the client's video into a canvas and
 * records it. A video from another origin taints the canvas and the browser
 * refuses to record it ("not origin-clean"), so that one video is fetched
 * same-origin. Range is passed on, so the player can seek. Null when the
 * bucket is off or does not have the file.
 */
export async function streamUpload(key: string, range: string | null): Promise<Response | null> {
  const b = bucket();
  if (!b || fs.existsSync(path.join(DATA_DIR, "uploads", key))) return null;
  let r;
  try {
    r = await b.s3.send(new GetObjectCommand({ Bucket: b.bucket, Key: key, ...(range ? { Range: range } : {}) }));
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
  const body = r.Body ? (r.Body as { transformToWebStream: () => ReadableStream }).transformToWebStream() : null;
  const headers: Record<string, string> = {
    "Content-Type": r.ContentType || mimeFor(key),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  };
  if (r.ContentLength != null) headers["Content-Length"] = String(r.ContentLength);
  if (r.ContentRange) headers["Content-Range"] = r.ContentRange;
  return new Response(body, { status: r.ContentRange ? 206 : 200, headers });
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

/**
 * Copies every file on the disk that the bucket does not have yet. Runs once
 * when the server starts with the bucket on; files already there are skipped,
 * so it only does real work the first time.
 */
export async function copyDiskUploadsToBucket() {
  const b = bucket();
  if (!b) return;
  const root = path.join(DATA_DIR, "uploads");
  let copied = 0;
  let skipped = 0;
  let failed = 0;
  let freed = 0;
  for (const file of walk(root)) {
    const key = path.relative(root, file).split(path.sep).join("/");
    if (key.startsWith("branding/")) continue; // served from elsewhere, not a client file
    if (await exists(b, key)) {
      // Already in the bucket: the disk copy is dead weight (15 Oct), so it goes.
      skipped++;
      dropDiskCopy(key);
      freed++;
      continue;
    }
    try {
      await b.s3.send(new PutObjectCommand({ Bucket: b.bucket, Key: key, Body: fs.readFileSync(file), ContentType: mimeFor(key) }));
      inBucket.add(key);
      copied++;
      dropDiskCopy(key);
      freed++;
    } catch (error) {
      failed++;
      console.error(`[uploads] could not copy ${key}:`, error instanceof Error ? error.message : error);
    }
  }
  console.log(`[uploads] bucket on: copied ${copied} file(s) from the disk, ${skipped} already there, ${failed} failed; ${freed} disk copies freed`);
}
