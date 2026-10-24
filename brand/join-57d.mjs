// The 57d star with its two lower blades grown into each other: the grey left
// blade's and the dark bottom blade's facing sides move out until they meet
// on the middle of the gap. Each keeps its colour and its other edges' lines.
// The dark one (drawn first) runs a hair under the grey at the outer end, so
// no light seam shows where they meet. Run: node brand/join-57d.mjs
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("./norcoach-57d.svg", import.meta.url), "utf8");
const UNDER = 0.4; // how far the dark blade runs under the grey one

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
// Where the line through p and q crosses the line through m along dir.
const cross = (p, q, m, dir) => {
  const d = sub(q, p), den = d[0] * dir[1] - d[1] * dir[0];
  const t = ((m[0] - p[0]) * dir[1] - (m[1] - p[1]) * dir[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
};
const f = (v) => +v.toFixed(2);
const pathOf = (pts) => `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}Z`;

// Grey left-lower blade: tip, shoulder, inner point. Dark bottom-left: tip, shoulder, inner point.
const grey = { d: "M-13.52 16.94L-86.29 0.82L5.94 -10.05Z", s: [-13.52, 16.94], tip: [-86.29, 0.82], i: [5.94, -10.05] };
const dark = { d: "M27.09 82.88L-11.49 18.40L7.97 -8.59Z", tip: [27.09, 82.88], s: [-11.49, 18.4], i: [7.97, -8.59] };

const dir = sub(grey.i, grey.s);                      // the gap runs this way
const len = Math.hypot(...dir);
const n = [-dir[1] / len, dir[0] / len];              // across the gap
const width = dot(sub(dark.s, grey.s), n);            // gap width (sign gives the side)
const mid = [grey.s[0] + (n[0] * width) / 2, grey.s[1] + (n[1] * width) / 2];
const under = [mid[0] - n[0] * UNDER * Math.sign(width), mid[1] - n[1] * UNDER * Math.sign(width)];

const greyPts = [cross(grey.tip, grey.s, mid, dir), grey.tip, cross(grey.tip, grey.i, mid, dir)];
// Under the grey at the outer end, exactly on the middle at the centre, so
// nothing pokes out past the grey's inner corner.
const darkPts = [dark.tip, cross(dark.tip, dark.s, under, dir), cross(dark.tip, dark.i, mid, dir)];

let out = src.replace(`d="${grey.d}"`, `d="${pathOf(greyPts)}"`).replace(`d="${dark.d}"`, `d="${pathOf(darkPts)}"`);
if (out === src || !out.includes(pathOf(greyPts)) || !out.includes(pathOf(darkPts))) throw new Error("blades not found");
// The provenance block belonged to the file as exported; this is a new file.
out = out.replace(/<metadata>[\s\S]*?<\/metadata>/, "").replace(' xmlns:c2pa="http://c2pa.org/manifest"', "");
writeFileSync(new URL("./norcoach-57d-joined.svg", import.meta.url), out);
console.log({ width: f(width), grey: greyPts.map((p) => p.map(f)), dark: darkPts.map((p) => p.map(f)) });
