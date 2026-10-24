// The NorCoach mark for the app: logonorcoach-joined.svg (Alex's star, the
// two lower blades joined) as clean ink shapes on nothing. The source paints
// its gaps with a 23.27-wide light stroke over each blade; here each blade is
// cut down by half that instead, so the gaps are real and the mark sits on
// any background. Blades thinner than the gap vanish, as they do in the
// source. Cropped to the star with a little air. Run: node brand/build-mark.mjs
import { writeFileSync } from "node:fs";
import { inset } from "./inset.mjs";

const R = 23.27 / 2;
// The blades of logonorcoach-joined.svg, in its own coordinates.
const blades = [
  [[550.21, 457.96], [915.08, 512], [542.86, 470.34]],
  [[381.86, 126.14], [550.21, 457.96], [542.86, 470.34]],
  [[914.97, 512], [586.55, 566.04], [542.75, 470.34]],
  [[437.34, 457.96], [381.86, 126.14], [542.86, 470.34]],
  [[586.66, 566.04], [642.14, 897.86], [542.86, 470.34]],
  [[108.92, 512], [437.34, 457.96], [542.86, 470.34]],
  [[109.03, 512], [473.79, 566.04], [642.03, 897.86], [542.86, 470.34]],
];

const cut = blades.map((b) => inset(b, R)).filter(Boolean);
const all = cut.flatMap((c) => c.pts);
const AIR = 8;
const x0 = Math.min(...all.map((p) => p[0])) - AIR, x1 = Math.max(...all.map((p) => p[0])) + AIR;
const y0 = Math.min(...all.map((p) => p[1])) - AIR, y1 = Math.max(...all.map((p) => p[1])) + AIR;
const f = (v) => +v.toFixed(2);
const box = `${f(x0)} ${f(y0)} ${f(x1 - x0)} ${f(y1 - y0)}`;

// currentColor: ink on light pages, white on photos, set by the page.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" fill="currentColor">\n${cut.map((c) => `  <path d="${c.d}"/>`).join("\n")}\n</svg>\n`;
writeFileSync(new URL("./norcoach-mark.svg", import.meta.url), svg);
console.log(`${cut.length} of ${blades.length} blades show; viewBox ${box}`);
