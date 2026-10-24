// The NorCoach star, symmetrical: four arms at 90°, one length, each arm's
// dark blade the same triangle (tip, shoulder, centre). The left and bottom
// blades are joined: their outer edges run on until they meet on the 45° line.
// The gaps are cut out of the shapes (an inset by half the gap, a round notch
// where an outline turns inward), so the file works on any background.
// Run: node brand/build-star.mjs
import { writeFileSync } from "node:fs";
import { inset } from "./inset.mjs";

const SIZE = 1024, C = 512;
const L = 405;      // arm length, centre to tip (the old file averaged 403–407)
const ALONG = 55, OUT = 90; // a blade's shoulder: 55 along its arm, 90 out (the old blades)
const GAP = 23.27;  // the old file's gap, kept
const R = GAP / 2;
const INK = "#0b0d12";

const P = (x, y) => [C + x, C + y];
const tipT = P(0, -L), tipR = P(L, 0), tipB = P(0, L), tipL = P(-L, 0), O = P(0, 0);
// Where the left blade's outer edge, carried on, crosses the 45° line.
const J = (OUT * L) / (L - ALONG + OUT);
const shapes = [
  [tipT, P(-OUT, -ALONG), O],       // top arm, its left blade
  [tipR, P(ALONG, OUT), O],         // right arm, its lower blade
  [tipL, P(-J, J), tipB, O],        // left and bottom blades, joined
];

const paths = shapes.map((s) => `  <path d="${inset(s, R).d}"/>`).join("\n");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">\n<g fill="${INK}">\n${paths}\n</g>\n</svg>\n`;
writeFileSync(new URL("./norcoach-star-symmetric.svg", import.meta.url), svg);
console.log(svg);
