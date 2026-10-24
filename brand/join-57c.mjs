// The 57c star (one ink) with its two lower blades joined into one shape:
// their facing sides grow out until they meet on the middle of the gap, then
// the two are one path. Their outer edges keep their lines.
// Run: node brand/join-57c.mjs
import { readFileSync, writeFileSync } from "node:fs";

const src = readFileSync(new URL("./norcoach-57c.svg", import.meta.url), "utf8");

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
// Where the line through p and q crosses the line through m along dir.
const cross = (p, q, m, dir) => {
  const d = sub(q, p), den = d[0] * dir[1] - d[1] * dir[0];
  const t = ((m[0] - p[0]) * dir[1] - (m[1] - p[1]) * dir[0]) / den;
  return [p[0] + d[0] * t, p[1] + d[1] * t];
};
const f = (v) => +v.toFixed(2);
const same = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05;

// Left-lower blade and bottom-left blade: tip, shoulder, inner point.
const left = { d: "M-13.52 16.94L-86.29 0.82L5.94 -10.05Z", s: [-13.52, 16.94], tip: [-86.29, 0.82], i: [5.94, -10.05] };
const bottom = { d: "M27.09 82.88L-11.49 18.40L7.97 -8.59Z", tip: [27.09, 82.88], s: [-11.49, 18.4], i: [7.97, -8.59] };

const dir = sub(left.i, left.s);
const len = Math.hypot(...dir);
const n = [-dir[1] / len, dir[0] / len];
const width = dot(sub(bottom.s, left.s), n);
const mid = [left.s[0] + (n[0] * width) / 2, left.s[1] + (n[1] * width) / 2];

// Round the joined outline: left tip, the centre, bottom tip, the notch.
const pts = [
  left.tip,
  cross(left.tip, left.i, mid, dir),
  cross(bottom.tip, bottom.i, mid, dir),
  bottom.tip,
  cross(bottom.tip, bottom.s, mid, dir),
  cross(left.tip, left.s, mid, dir),
].filter((p, k, all) => k === 0 || !same(p, all[k - 1]));
const joined = `M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join("L")}Z`;

let out = src.replace(`<path d="${bottom.d}"></path>`, "").replace(`d="${left.d}"`, `d="${joined}"`);
if (out.includes(bottom.d) || !out.includes(joined)) throw new Error("blades not found");
out = out.replace(/<metadata>[\s\S]*?<\/metadata>/, "").replace(' xmlns:c2pa="http://c2pa.org/manifest"', "");
writeFileSync(new URL("./norcoach-57c-joined.svg", import.meta.url), out);
console.log({ width: f(width), joined });
