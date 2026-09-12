import fs from "fs";
import path from "path";
import { PutObjectCommand, HeadObjectCommand, ListObjectsV2Command, DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import { DATA_DIR } from "./db";

// Nightly copy of everything on the volume to a bucket that is not the
// volume: the JSON store as a dated snapshot, the uploads folder mirrored
// file by file. Runs from instrumentation.ts on a timer; nothing in the
// app waits on it. Without the BACKUP_* variables it does nothing, so a
// dev machine never uploads its test data anywhere.
//
// Layout in the bucket:
//   snapshots/YYYY-MM-DD/ironline.json   one per day, the last KEEP kept
//   uploads/<same path as on the volume>  written once, skipped after
//   latest.json                           the newest snapshot again, for
//                                         an import script to find

const KEEP_SNAPSHOTS = 30;

function client(): { s3: S3Client; bucket: string } | null {
  const { BACKUP_BUCKET, BACKUP_ENDPOINT, BACKUP_REGION, BACKUP_ACCESS_KEY_ID, BACKUP_SECRET_ACCESS_KEY } = process.env;
  if (!BACKUP_BUCKET || !BACKUP_ENDPOINT || !BACKUP_ACCESS_KEY_ID || !BACKUP_SECRET_ACCESS_KEY) return null;
  return {
    bucket: BACKUP_BUCKET,
    s3: new S3Client({
      region: BACKUP_REGION || "auto",
      endpoint: BACKUP_ENDPOINT,
      credentials: { accessKeyId: BACKUP_ACCESS_KEY_ID, secretAccessKey: BACKUP_SECRET_ACCESS_KEY },
    }),
  };
}

export function backupConfigured(): boolean {
  return client() != null;
}

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

async function exists(s3: S3Client, bucket: string, key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
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

export type BackupResult = { snapshot: string; uploadsCopied: number; uploadsSkipped: number; pruned: number };

/** One full run. Throws on a failure the caller should log. */
export async function runBackup(): Promise<BackupResult | null> {
  const c = client();
  if (!c) return null;
  const { s3, bucket } = c;
  const day = localDate();

  // 1. The store itself, as today's snapshot and as latest.
  const dbPath = path.join(DATA_DIR, "ironline.json");
  const body = fs.readFileSync(dbPath);
  const snapshot = `snapshots/${day}/ironline.json`;
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: snapshot, Body: body, ContentType: "application/json" }));
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: "latest.json", Body: body, ContentType: "application/json" }));

  // 2. Uploads, mirrored. A file that is already there is left alone, so a
  //    night's run costs one HEAD per file and one PUT per new file.
  const uploadsRoot = path.join(DATA_DIR, "uploads");
  let copied = 0;
  let skipped = 0;
  for (const file of walk(uploadsRoot)) {
    const key = `uploads/${path.relative(uploadsRoot, file).split(path.sep).join("/")}`;
    if (await exists(s3, bucket, key)) {
      skipped++;
      continue;
    }
    await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: fs.readFileSync(file) }));
    copied++;
  }

  // 3. Keep the last KEEP_SNAPSHOTS days of the store; uploads are never pruned.
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "snapshots/" }));
  const days = Array.from(new Set((listed.Contents ?? []).map((o) => o.Key?.split("/")[1]).filter((d): d is string => !!d))).sort();
  const old = days.slice(0, Math.max(0, days.length - KEEP_SNAPSHOTS));
  let pruned = 0;
  if (old.length > 0) {
    const keys = (listed.Contents ?? []).filter((o) => old.includes(o.Key?.split("/")[1] ?? "")).map((o) => ({ Key: o.Key! }));
    if (keys.length > 0) {
      await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }));
      pruned = keys.length;
    }
  }

  return { snapshot, uploadsCopied: copied, uploadsSkipped: skipped, pruned };
}

/** When the next 03:15 (server local time) falls, in ms from now. */
export function msUntilNextRun(now = new Date()): number {
  const next = new Date(now);
  next.setHours(3, 15, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}
