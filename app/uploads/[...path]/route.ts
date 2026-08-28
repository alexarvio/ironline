import fs from "fs";
import path from "path";
import { DATA_DIR } from "../../lib/db";

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
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
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

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
