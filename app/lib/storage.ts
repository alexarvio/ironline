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
  if (!b || !key) return;
  inBucket.delete(key);
  linkCache.delete(key);
  try {
    await b.s3.send(new DeleteObjectCommand({ Bucket: b.bucket, Key: key }));
  } catch {
    /* already gone */
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
