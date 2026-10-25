import fs from "fs";
import path from "path";
import { DeleteObjectCommand, DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { DATA_DIR } from "./db";

// Uploaded files (progress photos, avatars, chat media, demo videos) in the
// Railway storage bucket, off the server's disk.
//
// On when UPLOADS_STORE=bucket and the UPLOADS_* credentials are set; remove
// UPLOADS_STORE and everything reads from the disk again, as before. While
// it is on, an upload is written to the disk only until its copy is in the
// bucket (15 Oct: the volume had filled with copies), and a file not yet there is
// served from the disk. The stored paths stay "/uploads/<key>", so nothing in
// the data changes; the /uploads route checks access, then redirects to a
// link into the bucket that expires after a few minutes.

const LINK_SECONDS = 15 * 60;

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
    inBucket.add(key);
    dropDiskCopy(key);
  } catch (error) {
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
// and every ask went to the bucket and back. Most recently used kept, 96 MB at most; a restart empties it. On
// globalThis, so the uploads route and the server actions (built into different bundles) share one.
const MEMO_BYTES = 96 * 1024 * 1024;
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
const namedOnce = (key: string) => keptForGood(key) || /^(covers|support)\//.test(key);
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

async function shrink(original: Buffer, w: number): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
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
  const sharp = (await import("sharp")).default;
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
  const sharp = (await import("sharp")).default;
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
export function fillChatLooks(items: { path: string; type: string }[]) {
  for (const it of items) {
    const key = keyOf(it.path);
    if (!key || looked.has(key) || (it.type !== "image" && it.type !== "video")) continue;
    looked.add(key);
    const copy = it.type === "video" ? posterKey(key) : smallKey(key, CHAT_WIDTHS[0]);
    if (!copy) continue;
    const make = () => (it.type === "video" ? makePoster(key, copy) : makeSmall(key, copy, CHAT_WIDTHS[0]));
    void (async () => keepLook(it.path, (await readUpload(copy)) ?? (await once(copy, make))))().catch(() => {});
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
  const items: { path: string; type: "image" | "video"; chat: boolean }[] = [];
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
    const sharp = (await import("sharp")).default;
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
 * A client's chat video as its small web copy (25 Oct, Alex: videos slow to play): made beside the original
 * ("chat/9/abc.mov" -> "chat/9/abc-web.mp4"), put in the bucket, the messages pointed at it and its poster made. The
 * original stays where it was. Nothing changes when ffmpeg can't make one.
 */
export async function webChatVideo(publicPath: string) {
  const key = keyOf(publicPath);
  if (!key || /-web\.mp4$/i.test(key)) return;
  try {
    const onDisk = path.join(DATA_DIR, "uploads", key);
    const source = fs.existsSync(onDisk) ? onDisk : await bucketLink(key);
    if (!source) return;
    const webKey = key.replace(/\.[^./]+$/, "") + "-web.mp4";
    const out = path.join(DATA_DIR, "uploads", webKey);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const { toWebVideo } = await import("./transcode");
    if (!(await toWebVideo(source, out))) return;
    const webPath = `/uploads/${webKey}`;
    await putUploadFromDisk(webPath, out, "video/mp4");
    // Its poster first, so the message never points at a copy without one: made, else the original's carried over.
    const poster = posterKey(webKey);
    if (poster && !(await once(poster, () => makePoster(webKey, poster)))) {
      const was = posterKey(key);
      const bytes = was ? await readUpload(was) : null;
      if (bytes) {
        remember(poster, bytes);
        await keepCopy(poster, bytes);
      }
    }
    const { swapChatMedia } = await import("./queries");
    swapChatMedia(publicPath, webPath);
    await prepareChatMedia(webPath, "video");
  } catch (error) {
    console.error(`[uploads] no web copy of ${key}:`, error instanceof Error ? error.message : error);
  }
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
const linkCache = new Map<string, { url: string; until: number }>();

export async function bucketLink(key: string): Promise<string | null> {
  const b = bucket();
  if (!b) return null;
  const hit = linkCache.get(key);
  if (hit && hit.until > Date.now()) return hit.url;
  // Not copied to the bucket yet: served from the disk. Otherwise signed at once, no trip to the bucket to ask first
  // (25 Oct): signing is worked out here, and a file gone from both answers 404 from the bucket.
  if (fs.existsSync(path.join(DATA_DIR, "uploads", key))) return null;
  const url = await getSignedUrl(b.s3, new GetObjectCommand({ Bucket: b.bucket, Key: key }), { expiresIn: LINK_SECONDS });
  linkCache.set(key, { url, until: Date.now() + (LINK_SECONDS - 6 * 60) * 1000 });
  return url;
}

export const LINK_CACHE_SECONDS = LINK_SECONDS - 5 * 60;

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
