// The full logo (the star and NORCOACH) as a PNG for emails (26 Oct, Alex: Clerk's code email): ink on a white
// rounded plate, so it reads in light and dark mail alike. Paths from app/components/NorCoachLogo.tsx.
//   node brand/build-email-logo.mjs  →  public/brand/email-logo.png
import fs from "node:fs";
import sharp from "sharp";

const src = fs.readFileSync("app/components/NorCoachLogo.tsx", "utf8");
const svgs = [...src.matchAll(/<svg[^>]*viewBox="([^"]+)"[^>]*>([\s\S]*?)<\/svg>/g)].map((m) => ({ box: m[1].split(" ").map(Number), body: m[2] }));
const [mark, word] = svgs;
const H = 120; // mark height
const mw = (mark.box[2] / mark.box[3]) * H;
const wh = H * 0.42;
const ww = (word.box[2] / word.box[3]) * wh;
const gap = 34, pad = 48;
const W = Math.round(pad * 2 + mw + gap + ww), T = Math.round(pad * 2 + H);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${T}" viewBox="0 0 ${W} ${T}">
<rect width="${W}" height="${T}" rx="28" fill="#ffffff"/>
<g fill="#141a24">
<svg x="${pad}" y="${pad}" width="${mw}" height="${H}" viewBox="${mark.box.join(" ")}">${mark.body}</svg>
<svg x="${pad + mw + gap}" y="${pad + (H - wh) / 2}" width="${ww}" height="${wh}" viewBox="${word.box.join(" ")}">${word.body}</svg>
</g></svg>`;
await sharp(Buffer.from(svg.replace(/className="[^"]*"/g, ""))).png().toFile("public/brand/email-logo.png");
console.log("public/brand/email-logo.png", W, "x", T);
