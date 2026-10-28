import fs from "fs";
import path from "path";
import { DATA_DIR, getData, persist } from "./db";

// The coach's logo behind the screens (28 Oct, Alex: "their logo would be the one in the background"). Where the
// NorCoach star sits very faint today (the client's Home, every chat, every admin screen, the coach's phone), a coach
// who uploaded a logo has it there instead: the coach on their own screens, their clients on theirs. None, the star.
//
// The upload is made into what the star is: one dark shape on nothing, in the star's box (448 × 430), so every screen
// draws it exactly as it drew the star, only another picture (`--bg-mark`, set on the page's body by the root layout).
// The shape is the logo's own transparency when it has one, else whatever differs from the colour round its edge (a
// logo on white, or white on black). Too little left, or a solid block, says so and keeps the star.

/** The star's box, twice over for a sharp edge on a large screen. */
const BOX = { width: 896, height: 860 };
/** The ink every shape is drawn in (#141a24); the screens fade it to 4.5%. */
const INK = { r: 20, g: 26, b: 36 };

export type MarkResult = { ok: true; png: Buffer } | { ok: false; error: string };

/** The logo as a one-colour silhouette in the star's box, or why it can't be one. */
export async function makeLogoMark(upload: Buffer): Promise<MarkResult> {
  const sharp = (await import("sharp")).default;
  let raw: { data: Buffer; info: { width: number; height: number } };
  try {
    raw = await sharp(upload, { failOn: "none", density: 300 }).rotate().resize(800, 800, { fit: "inside", withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch {
    return { ok: false, error: "That file isn't a picture we can read." };
  }
  const { data, info } = raw;
  const { width: w, height: h } = info;
  const px = (i: number) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]] as const;

  // The edge: every pixel round the border.
  const edge: number[] = [];
  for (let x = 0; x < w; x++) edge.push(x, (h - 1) * w + x);
  for (let y = 1; y < h - 1; y++) edge.push(y * w, y * w + w - 1);
  const seeThrough = edge.filter((i) => px(i)[3] < 32).length > edge.length * 0.5;
  // The colour round it: the median of the opaque edge, channel by channel.
  const median = (vals: number[]) => vals.sort((a, b) => a - b)[Math.floor(vals.length / 2)] ?? 255;
  const solid = edge.filter((i) => px(i)[3] >= 32);
  const bg = seeThrough ? null : ([0, 1, 2].map((c) => median(solid.map((i) => px(i)[c]))) as [number, number, number]);
  // A photo or a pattern has no one colour round it to drop: what would show is noise.
  const off = (i: number) => (bg ? Math.max(...[0, 1, 2].map((c) => Math.abs(px(i)[c] - bg[c]))) : 0);
  if (bg && solid.filter((i) => off(i) > 40).length > solid.length * 0.2) return { ok: false, error: "It needs a plain or see-through background, as a logo file has." };

  const out = Buffer.alloc(w * h * 4);
  let covered = 0;
  for (let i = 0; i < w * h; i++) {
    const [r, g, b, a] = px(i);
    let alpha: number;
    if (!bg) alpha = a;
    else {
      // How far from the background, eased in over a band so an anti-aliased edge stays smooth.
      const d = Math.max(Math.abs(r - bg[0]), Math.abs(g - bg[1]), Math.abs(b - bg[2]));
      alpha = Math.round(Math.min(1, Math.max(0, (d - 28) / 60)) * a);
    }
    out[i * 4] = INK.r;
    out[i * 4 + 1] = INK.g;
    out[i * 4 + 2] = INK.b;
    out[i * 4 + 3] = alpha;
    covered += alpha / 255;
  }
  const share = covered / (w * h);
  if (share < 0.005) return { ok: false, error: "Nothing of it would show. Try a version with a plain background." };
  if (share > 0.85) return { ok: false, error: "It would show as a solid block. Try a version with a plain or see-through background." };

  // Cut to the shape, then into the star's box, centred, nothing round it.
  const trimmed = await sharp(out, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).png().toBuffer();
  const png = await sharp(trimmed).resize(BOX.width, BOX.height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return { ok: true, png };
}

const coachRow = (coachId: number) => getData().users.find((u) => u.id === coachId && u.role === "coach");

/** The coach's mark, as the screens draw it; null, the star. */
export function coachMark(coachId: number | null | undefined): string | null {
  return coachId == null ? null : (coachRow(coachId)?.coach_settings?.brand?.mark ?? null);
}

/** Whose mark a signed-in person sees: a coach their own, a client their coach's. */
export function markFor(user: { role: string; id: number; client_id: number | null } | null): string | null {
  if (!user) return null;
  if (user.role === "coach") return coachMark(user.id);
  const coachId = getData().clients.find((c) => c.id === user.client_id)?.coach_id ?? null;
  return coachMark(coachId);
}

/** The upload as a PNG of at most 1600px, kept beside the mark (for its own colours later, an invoice's head): never
 *  the file as sent, so an SVG is never served as one. */
export async function logoAsPng(upload: Buffer): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  return sharp(upload, { failOn: "none", density: 300 }).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).png().toBuffer();
}

/** Keeps the coach's logo (a PNG, logoAsPng) and its mark (uploads/coaches/<id>/, which the coach, the owner and
 *  their clients may read). Back with the paths now and the ones they replaced, for the storage bucket. */
export function saveCoachLogo(coachId: number, original: Buffer, mark: Buffer): { logo: string; mark: string; previous: (string | null)[] } | null {
  const user = coachRow(coachId);
  if (!user) return null;
  const dir = path.join(DATA_DIR, "uploads", "coaches", String(coachId));
  fs.mkdirSync(dir, { recursive: true });
  const was = user.coach_settings?.brand ?? {};
  const stamp = Date.now();
  // A new name each time, so no screen keeps the old one from its cache.
  const logoFile = `logo-${stamp}.png`;
  const markFile = `mark-${stamp}.png`;
  fs.writeFileSync(path.join(dir, logoFile), original);
  fs.writeFileSync(path.join(dir, markFile), mark);
  for (const old of [was.logo, was.mark]) unlinkUpload(old);
  const brand = { logo: `/uploads/coaches/${coachId}/${logoFile}`, mark: `/uploads/coaches/${coachId}/${markFile}` };
  user.coach_settings = { ...(user.coach_settings ?? {}), brand };
  persist();
  return { ...brand, previous: [was.logo ?? null, was.mark ?? null] };
}

/** Back to the star. The paths removed, for the storage bucket. */
export function removeCoachLogo(coachId: number): (string | null)[] {
  const user = coachRow(coachId);
  const was = user?.coach_settings?.brand;
  if (!user || !was) return [];
  for (const old of [was.logo, was.mark]) unlinkUpload(old);
  const { brand: _gone, ...rest } = user.coach_settings ?? {};
  void _gone;
  user.coach_settings = rest;
  persist();
  return [was.logo ?? null, was.mark ?? null];
}

function unlinkUpload(publicPath: string | null | undefined) {
  if (!publicPath?.startsWith("/uploads/")) return;
  try {
    fs.unlinkSync(path.join(DATA_DIR, ...publicPath.split("?")[0].slice("/uploads/".length).split("/")));
  } catch {
    /* already gone */
  }
}
