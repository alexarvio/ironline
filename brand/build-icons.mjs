// The app icons from the star (norcoach-mark.svg): ink on the app's paper
// colour, the star centred by its bounds. Writes the web app's icons
// (app/icon.png, app/apple-icon.png, app/favicon.ico: the home-screen icon,
// the iPhone's and the browser tab's) and the phone shell's sources
// (mobile/assets: run `npm run icons` in mobile/ to make the native sets).
// Run from the repo root: node brand/build-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const PAPER = "#f8f9fb"; // the manifest's background_color
const INK = "#141a24";
const svg = readFileSync(new URL("./norcoach-mark.svg", import.meta.url), "utf8").replace("currentColor", INK);

// The star `share` of the canvas wide, centred, on paper (or on nothing).
async function icon(size, share, background = PAPER) {
  const star = await sharp(Buffer.from(svg), { density: 600 }).resize({ width: Math.round(size * share), height: Math.round(size * share), fit: "inside" }).png().toBuffer();
  const { width, height } = await sharp(star).metadata();
  const base = sharp({ create: { width: size, height: size, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } } });
  let out = base.composite([{ input: star, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }]).png();
  if (background) out = sharp(await out.toBuffer()).flatten({ background }).png(); // opaque: iOS wants no alpha
  return out.toBuffer();
}

// An .ico holding PNG images (every browser since IE Vista reads them).
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1);
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

const STAR = 0.66; // the star's share of a full icon, inside every platform's mask
writeFileSync("app/icon.png", await icon(512, STAR));
writeFileSync("app/apple-icon.png", await icon(180, STAR));
// The .ico's images must carry an alpha channel, or Next can't read them.
const rgba = async (png) => sharp(png).ensureAlpha().png().toBuffer();
writeFileSync("app/favicon.ico", ico(await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await rgba(await icon(size, 0.8)) })))));

// Android's adaptive icon crops to the middle two thirds, so the foreground
// star is smaller; the splash shows it small in the middle.
writeFileSync("mobile/assets/icon-only.png", await icon(1024, STAR));
writeFileSync("mobile/assets/icon-foreground.png", await icon(1024, 0.46, null));
writeFileSync("mobile/assets/icon-background.png", await sharp({ create: { width: 1024, height: 1024, channels: 3, background: PAPER } }).png().toBuffer());
writeFileSync("mobile/assets/splash.png", await icon(2732, 0.16));
console.log("icons written");
