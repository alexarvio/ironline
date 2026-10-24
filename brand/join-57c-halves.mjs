// The 57c star in two halves: every gap filled except 6|4 and 3|5 (the shape
// numbers on the numbered sheet). Top and right arms (4, 2, 1, 3) become one
// shape, bottom and left (7, 5, 6) the other. Each arm runs straight from its
// tip to the thin blade's shoulder (the thin blades stopped short of the tip),
// and the two halves are parted by the kept gaps' walls, carried on until
// they meet at the centre, so the channel between them is one even width.
// Run: node brand/join-57c-halves.mjs
import { writeFileSync } from "node:fs";

// The blades' corners, as in norcoach-57c-joined.svg.
const s4 = [-23.91, -18.52], tip4 = [-28.81, -82.89], in4 = [6.38, -13.28];
const p2 = [11.47, -18.43];
const a1 = [13.49, -16.94];
const tip3 = [86.87, 0.82], s3 = [25.05, 16.91], in3 = [10.86, -10.04];
const l7 = [-86.29, 0.82], b7 = [27.09, 82.88], n7 = [-12.19, 17.23];
const s5 = [24.05, 20.37], in5 = [11.66, -3.15];
const s6 = [-26.74, -16.47], in6 = [-0.07, -11.86];

// Where the line through a and b crosses the line through c and d.
const meet = (a, b, c, d) => {
  const r = [b[0] - a[0], b[1] - a[1]], q = [d[0] - c[0], d[1] - c[1]];
  const t = ((c[0] - a[0]) * q[1] - (c[1] - a[1]) * q[0]) / (r[0] * q[1] - r[1] * q[0]);
  return [+(a[0] + r[0] * t).toFixed(2), +(a[1] + r[1] * t).toFixed(2)];
};
const centreTR = meet(s4, in4, s3, in3); // 4's wall meets 3's
const centreBL = meet(s6, in6, s5, in5); // 6's wall meets 5's

const topRight = [s4, tip4, p2, a1, tip3, s3, centreTR];
const bottomLeft = [l7, s6, centreBL, s5, b7, n7];

const d = (pts) => `M${pts.map((p) => `${p[0]} ${p[1]}`).join("L")}Z`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220" width="1024" height="1024"><g fill="#0B0D12"><path d="${d(topRight)}"/><path d="${d(bottomLeft)}"/></g></svg>\n`;
writeFileSync(new URL("./norcoach-57c-halves.svg", import.meta.url), svg);
console.log(svg);
