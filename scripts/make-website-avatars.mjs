// Run from the repo root: node scripts/make-website-avatars.mjs website/img/avatars
// Illustrated demo-client avatars for the marketing site's mock screens: a flat head and shoulders in a circle, no
// real person. One SVG per demo client, written to website/img/avatars/<first>.svg.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const out = process.argv[2];
mkdirSync(out, { recursive: true });

const SKIN = { a: "#f3d3bd", b: "#e8b896", c: "#c98e66", d: "#a06a45", e: "#6e4630" };
const shade = (hex, k) => {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
};

// Hair drawn behind the head (back) and over it (front).
const HAIR = {
  short: { front: "M20.6 27.5C20 16.5 25.5 12.6 32 12.6c6.8 0 12 3.9 11.4 14.9-1.3-5.8-5-8.4-11.4-8.2-6.3-.2-10 2.4-11.4 8.2z" },
  side: { front: "M20.4 28c-.7-11.6 5-15.6 11.8-15.6 7.4 0 12.2 4.1 11.4 15.1-1.9-4.4-4.6-7.8-12.6-8.4-3.4 2.2-7.2 4.2-10.6 8.9z" },
  buzz: { front: "M21.2 25.5c.2-8.8 5-12.2 10.8-12.2 6 0 10.6 3.4 10.8 12.2-1.8-4.4-5.4-6.6-10.8-6.6s-9 2.2-10.8 6.6z" },
  long: {
    back: "M18.4 31C17.6 16 24.6 11 32 11s14.4 5 13.6 20l1.6 15.6c-3.8 2-7.6.8-8.6-2.6H25.4c-1 3.4-4.8 4.6-8.6 2.6z",
    front: "M20.8 26.5c.2-9.6 5.4-13.6 11.2-13.6 6.4 0 11.4 4.2 11.2 13.2-3.4-3.4-7.4-6.2-13.2-6.6-3.2 2.2-6.4 4.4-9.2 7z",
  },
  bob: {
    back: "M19 32c-1-15 5.6-20.4 13-20.4S46 17 45 32c.2 4 .8 6.4 1.6 8.4-3.4 1.4-6.6.6-8-1.6H25.4c-1.4 2.2-4.6 3-8 1.6.8-2 1.4-4.4 1.6-8.4z",
    front: "M20.6 27.2c.2-9.8 5.4-14.2 11.4-14.2 6.6 0 11.6 4.4 11.4 14.2-2.2-4.8-6.4-7.6-11.4-7.6s-9.2 2.8-11.4 7.6z",
  },
  bun: {
    back: "M32 3.6a5.6 5.6 0 1 1 0 11.2 5.6 5.6 0 0 1 0-11.2z",
    front: "M20.6 27c.2-9.6 5.4-13.8 11.4-13.8S43.2 17.4 43.4 27c-2.4-4.6-6.6-7.2-11.4-7.2S23 22.4 20.6 27z",
  },
  pony: {
    back: "M41 18c6 1.4 8.4 7 7.2 14.4-.6 3.6-2.4 6.4-4.6 8-.4-4.4-1.2-9.4-3.6-13.4z",
    front: "M20.6 27c.2-9.6 5.4-13.8 11.4-13.8S43.2 17.4 43.4 27c-2.4-4.6-6.6-7.2-11.4-7.2S23 22.4 20.6 27z",
  },
  curly: {
    front:
      "M19.8 27.8c-2.6-2.6-1.8-6.6 1-7.6-.8-3.4 1.8-6.2 5-5.4.8-3 4.4-4.6 7.2-2.8 2.6-1.8 6.4-.6 7 2.6 3.2-.4 5.4 2.6 4.4 5.6 2.8 1.2 3.2 5 .8 7.4-2.4-4.4-6.4-7.4-12.2-7.4s-10 3-13.2 7.6z",
  },
};
const BEARD = "M21.6 30.4c.6 6.6 4.6 10.8 10.4 10.8s9.8-4.2 10.4-10.8c-1.6 2.6-3.2 3.6-5 3.8-1.4-1.2-3.2-1.6-5.4-1.6s-4 .4-5.4 1.6c-1.8-.2-3.4-1.2-5-3.8z";

// The demo clients in the site's rail, and Finlay as a stand-in until his photo comes.
const PEOPLE = [
  ["adam", "b", "short", "#3b2a20", "#dfe6ee", "#43566e"],
  ["ben", "d", "buzz", "#1f1712", "#e9e4dc", "#6b5b47", true],
  ["chloe", "a", "long", "#b8873f", "#f1e3e6", "#b0596b"],
  ["daniel", "c", "side", "#2a1c14", "#e3ebe5", "#3e6b55", true],
  ["emma", "b", "bob", "#5a3a26", "#ece6f3", "#5c4a8a"],
  ["grace", "e", "curly", "#1b1310", "#f3ead9", "#b88a2e"],
  ["hannah", "a", "bun", "#2c211b", "#e6eef3", "#3f6f8a"],
  ["jack", "a", "side", "#a8742f", "#eef0e4", "#6f7a3a"],
  ["james", "d", "short", "#191310", "#e8e2ef", "#4b3f72", true],
  ["lucy", "b", "pony", "#7a4a26", "#f4e6dd", "#b06a42"],
  ["mia", "c", "long", "#20160f", "#e2ecee", "#2f7a7a"],
  ["oliver", "b", "buzz", "#6b4a2e", "#eae6e0", "#5a5248"],
  ["sara", "a", "bob", "#3a2a22", "#efe4e8", "#8a3f5a"],
  ["tom", "c", "short", "#140f0c", "#e4e9f0", "#2f4f78", true],
  ["zoe", "e", "bun", "#16100c", "#f1e9e1", "#9a5b2a"],
  ["finlay", "b", "side", "#4a2f1e", "#e7e9ec", "#141a24", true],
];

for (const [name, tone, hairKey, hair, bg, shirt, beard] of PEOPLE) {
  const skin = SKIN[tone];
  const h = HAIR[hairKey];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Illustrated avatar">
<defs><clipPath id="c"><circle cx="32" cy="32" r="32"/></clipPath></defs>
<g clip-path="url(#c)">
<rect width="64" height="64" fill="${bg}"/>
${h.back ? `<path d="${h.back}" fill="${hair}"/>` : ""}
<path d="M8 66c0-13 10.4-21 24-21s24 8 24 21z" fill="${shirt}"/>
<path d="M26.6 36.6h10.8v8.6c0 3-2.4 5-5.4 5s-5.4-2-5.4-5z" fill="${shade(skin, 0.9)}"/>
<ellipse cx="32" cy="27.8" rx="11.4" ry="13.4" fill="${skin}"/>
${beard ? `<path d="${BEARD}" fill="${hair}" opacity=".92"/>` : ""}
<path d="${h.front}" fill="${hair}"/>
</g>
</svg>
`;
  writeFileSync(join(out, `${name}.svg`), svg);
}
console.log(`${PEOPLE.length} avatars in ${out}`);
