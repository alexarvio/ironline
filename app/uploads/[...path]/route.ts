import fs from "fs";
import path from "path";
import { DATA_DIR } from "../../lib/db";
import { canAccessClient } from "../../lib/auth";

// Serves files written by savePhotoUpload/saveChatMedia in queries.ts. Those
// live under DATA_DIR/uploads rather than /public/uploads so they survive on
// a mounted volume in production — this route is what makes the stored
// `/uploads/...` paths resolvable again.
const MIME_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  m4v: "video/x-m4v",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;

  // Layout on disk mirrors the URL, so the client id is always the second
  // segment:
  //   uploads/progress/<clientId>/<slotId>/<period>.<ext>
  //   uploads/chat/<clientId>/<filename>
  //   uploads/demos/<clientId>/<assignmentId>.<ext>
  // Progress photos are about as sensitive as this app gets, and without
  // this check anyone who guessed or was sent a URL could fetch any
  // client's. 404 rather than 403 for an unauthorized caller, since a
  // "forbidden" would confirm the file exists.
  if (
    !segments ||
    segments.length < 2 ||
    segments.some((seg) => !seg || seg === "." || seg === ".." || seg.includes("/") || seg.includes("\\"))
  ) {
    return new Response("Not found", { status: 404 });
  }
  const [kind, clientIdRaw] = segments;
  if (kind !== "progress" && kind !== "chat" && kind !== "demos") {
    return new Response("Not found", { status: 404 });
  }
  const clientId = Number(clientIdRaw);
  if (!Number.isInteger(clientId) || clientId <= 0 || !(await canAccessClient(clientId))) {
    return new Response("Not found", { status: 404 });
  }

  const uploadsRoot = path.join(DATA_DIR, "uploads");
  const filePath = path.join(uploadsRoot, ...segments);

  // Guard against the resolved path escaping uploadsRoot (e.g. "..").
  if (!filePath.startsWith(uploadsRoot + path.sep)) {
    return new Response("Not found", { status: 404 });
  }

  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return new Response("Not found", { status: 404 });
  }

  const ext = path.extname(filePath).slice(1).toLowerCase();
  const contentType = MIME_TYPES[ext] ?? "application/octet-stream";
  const body = fs.readFileSync(filePath);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
