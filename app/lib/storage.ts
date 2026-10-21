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
    inBucket.add(key);
    linkCache.delete(key);
    dropDiskCopy(key);
  } catch (error) {
    // The file is on the disk and is served from there; the startup copy
    // puts it in the bucket next time. Worth knowing about, not worth
    // failing the client's upload over.
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
  // Its small copies go with it (19 Oct), wherever they were made, and a video's poster (21 Oct).
  const smalls = [...SMALL_WIDTHS.map((w) => smallKey(key, w)), posterKey(key)].filter((k): k is string => !!k);
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
export const SMALL_WIDTHS = [480, 1080];

export function smallKey(key: string, w: number): string | null {
  if (!/\.(jpe?g|png|webp)$/i.test(key)) return null;
  const parts = key.split("/");
  if (parts.length < 3) return null;
  const [kind, owner, ...rest] = parts;
  return `${kind}/${owner}/_w${w}/${rest.join("/").replace(/\.[^.]+$/, "")}.webp`;
}

/** The original's bytes, from the bucket or the disk; null when it is nowhere. */
async function readUpload(key: string): Promise<Buffer | null> {
  const b = bucket();
  if (b && (await exists(b, key))) {
    const r = await b.s3.send(new GetObjectCommand({ Bucket: b.bucket, Key: key }));
    const bytes = await (r.Body as { transformToByteArray: () => Promise<Uint8Array> } | undefined)?.transformToByteArray();
    return bytes ? Buffer.from(bytes) : null;
  }
  const file = path.join(DATA_DIR, "uploads", key);
  return fs.existsSync(file) ? fs.readFileSync(file) : null;
}

// ---- Made once, kept in the browser (21 Oct, Alex: the chat's pictures and
// videos were slow). A chat upload's name (and a client's exercise video's) is
// a stamp that is never used again, so its small copies and poster can stay
// in the browser for good. They are sent by the app rather than through a
// link into the bucket: that link is signed afresh every few minutes and on
// every restart, and each new one was downloaded again, every picture of the
// thread on every open.
const keptForGood = (key: string) => /^(chat|videos)\//.test(key);
const smallCache = (key: string) => (keptForGood(key) ? "private, max-age=31536000, immutable" : "private, max-age=86400");
const webp = (bytes: Buffer, cache: string) =>
  new Response(new Uint8Array(bytes), { headers: { "Content-Type": "image/webp", "Content-Length": String(bytes.length), "Cache-Control": cache } });

// Two asks for one copy at once (the panel and the send's own) make it once.
const making = new Map<string, Promise<Buffer | null>>();
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
  await keepCopy(small, out);
  return out;
}

/**
 * The small copy as a response: the bytes for a file kept for good, else a
 * link into the bucket once it is there, or the bytes. Made at the send for
 * the chat (prepareChatMedia), else on the first ask. Null (serve the
 * original) when the file is not a picture, cannot be read, or sharp is missing.
 */
export async function smallCopy(key: string, w: number): Promise<Response | null> {
  const small = smallKey(key, w);
  if (!small || !SMALL_WIDTHS.includes(w)) return null;
  if (!keptForGood(key)) {
    const link = await bucketLink(small);
    if (link) return new Response(null, { status: 302, headers: { Location: link, "Cache-Control": `private, max-age=${LINK_CACHE_SECONDS}` } });
  }
  try {
    const bytes = (await readUpload(small)) ?? (await once(small, () => makeSmall(key, small, w)));
    return bytes ? webp(bytes, smallCache(key)) : null;
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
const noPoster = new Set<string>();

async function makePoster(key: string, poster: string): Promise<Buffer | null> {
  if (noPoster.has(key)) return null;
  const onDisk = path.join(DATA_DIR, "uploads", key);
  const source = fs.existsSync(onDisk) ? onDisk : await bucketLink(key);
  if (!source) return null;
  const { firstFrame } = await import("./transcode");
  let frame = await firstFrame(source);
  if (!frame) {
    noPoster.add(key);
    return null;
  }
  const sharp = (await import("sharp")).default;
  // A recording that opens on black (the coach's form reviews do) is shown a second in.
  const dark = async (jpg: Buffer) => (await sharp(jpg).stats()).channels.slice(0, 3).every((c) => c.mean < 12);
  if (await dark(frame)) frame = (await firstFrame(source, 1)) ?? frame;
  const out = await sharp(frame, { failOn: "none" }).resize({ width: 720, withoutEnlargement: true }).webp({ quality: 74 }).toBuffer();
  await keepCopy(poster, out);
  return out;
}

/** The poster as a response ("?poster=1"); null when the file is not a video or no frame could be had. */
export async function posterCopy(key: string): Promise<Response | null> {
  const poster = posterKey(key);
  if (!poster) return null;
  try {
    const bytes = (await readUpload(poster)) ?? (await once(poster, () => makePoster(key, poster)));
    return bytes ? webp(bytes, smallCache(key)) : null;
  } catch (error) {
    console.error(`[uploads] no poster for ${key}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Right after a chat send (21 Oct): a picture's small copies and a video's
 * poster, so the first person to open the chat gets them at once. Before, the
 * first open of a thread made each one then: the whole original read from the
 * bucket and shrunk, about three seconds a picture.
 */
export async function prepareChatMedia(publicPath: string, type: "image" | "video") {
  const key = keyOf(publicPath);
  if (!key) return;
  try {
    if (type === "video") {
      const poster = posterKey(key);
      if (poster) await once(poster, () => makePoster(key, poster));
      return;
    }
    if (!smallKey(key, SMALL_WIDTHS[0])) return;
    const original = await readUpload(key);
    if (!original) return;
    for (const w of SMALL_WIDTHS) {
      const small = smallKey(key, w)!;
      await once(small, () => makeSmall(key, small, w, original));
    }
  } catch (error) {
    console.error(`[uploads] could not prepare ${key}:`, error instanceof Error ? error.message : error);
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
  if (!(await exists(b, key))) return null;
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
  if (!b || !(await exists(b, key))) return null;
  const r = await b.s3.send(new GetObjectCommand({ Bucket: b.bucket, Key: key, ...(range ? { Range: range } : {}) }));
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
