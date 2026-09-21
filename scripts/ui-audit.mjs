// Drift check against docs/UI-GUIDELINES.md.
//
// Written because the same three notes kept coming back from whoever was
// looking at the screen — serif numbers, a card header that is not on the
// tint, a menu clipped by a scrolling column. Each was fixed where it was
// spotted rather than everywhere it existed, so the next unvisited screen
// produced the same note again.
//
// Heuristic, not a linter: it greps. A hit is worth a look, not an
// automatic failure. Run it before saying a sweep is finished.
//
//   node scripts/ui-audit.mjs

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const read = (p) => readFileSync(p, "utf8");
const walk = (dir, out = []) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(p)) out.push(p);
  }
  return out;
};

const css = read("app/globals.css");
const cssLines = css.split(/\r?\n/);
const files = walk("app");
let problems = 0;

const report = (title, hits, note) => {
  if (hits.length === 0) return;
  problems += hits.length;
  console.log(`\n${title}  (${hits.length})`);
  if (note) console.log(`  ${note}`);
  for (const h of hits.slice(0, 20)) console.log(`  ${h}`);
  if (hits.length > 20) console.log(`  … and ${hits.length - 20} more`);
};

// 1 · Colours the guidelines retired (§3). The commonest source of drift:
//     a near-miss grey or blue copied from an older rule.
// Swept 21 Sep 2026. Three are deliberately NOT here:
//   #334EAC and #3a3390 are the macro and category hues, which §3 keeps.
//   #f8f9fb is retired only as a PAGE colour and is a valid subtle surface
//   in dozens of hovers and strips; the page itself is #F4F7FC.
const RETIRED = [
  "#081F5C", "#1b3f6e", "#3B5A8C", "#5987a8", "#7C9DE0",
  "#5b6472", "#8b93a0", "#14171c", "#c2cbd3", "#c3c9d2",
  "#3d4a68", "#6C7A9C", "#97A3BD", "#F7F9FC",
  "#3f6e46", "#1f7a4d", "#9a5a33", "#b8471f", "#a13a3a", "#9b2c2c",
];
const retired = [];
cssLines.forEach((line, i) => {
  if (/^\s*(\/\*|\*)/.test(line)) return;
  for (const hex of RETIRED) {
    if (line.toLowerCase().includes(hex.toLowerCase())) {
      retired.push(`globals.css:${i + 1}  ${hex}  ${line.trim().slice(0, 90)}`);
      break;
    }
  }
});
report("Retired colours still in the stylesheet", retired, "UI-GUIDELINES §3 lists what each was replaced by.");

// 2 · A figure set in the serif face directly, which the admin-wide token
//     override cannot reach.
const hardSerif = [];
cssLines.forEach((line, i) => {
  // The token definition itself, the wordmark, and the client app's own
  // display face are all meant to be serif.
  // The token definition, the wordmark, the client app's display face, and
  // the admin's three dialog-title selectors are all meant to be serif.
  const near = cssLines.slice(Math.max(0, i - 4), i).join(" ");
  const ok =
    /--font-(serif|brand)/.test(line) ||
    /Baskerville/.test(line) ||
    /app-menu-brand/.test(line) ||
    /(pb-confirm-title|pb-modal-title|ad-client-title)/.test(near);
  if (/font-family:[^;]*(Newsreader|Georgia)/i.test(line) && !ok) {
    hardSerif.push(`globals.css:${i + 1}  ${line.trim().slice(0, 90)}`);
  }
});
report("Newsreader/Georgia set directly", hardSerif, "Only dialog titles should. Everything else inherits --font-serif.");

// 3 · A popover positioned by CSS rather than by components/popover.ts.
//     .ad-main scrolls, so absolute menus get clipped by it.
// Read whole rule blocks, not single lines: the first version of this check
// only matched one-liners, and missed .ml-pop — a fifth clipped popover —
// purely because its declarations were on separate lines.
const absolutePopovers = [];
{
  // Absolute is fine when the popup cannot leave its column. These were
  // each looked at; the four that WERE broken (exercise picker, client
  // gyms, add week, column menus) are on placePopover now.
  //
  //   app-menu, app-menu-scrim  full-screen overlays, nothing clips them
  //   ad-rail-menu              the sidebar, which does not scroll
  //   combo-box-menu            left:0 right:0, so it is exactly as wide as
  //                             its own input and cannot overflow sideways
  //   ml-pop, ph-menu           anchored to a wrapper inside the scrolling
  //                             content, so scrolling reaches them
  //   ad-panel-toggle,
  //   pb-colmenu-item           not menus; they match the name pattern
  const SAFE = [
    ".app-menu", ".app-menu-scrim", ".ad-rail-menu", ".combo-box-menu",
    ".ml-pop", ".ph-menu", ".ad-panel-toggle", ".pb-colmenu-item",
  ];
  const rule = /(^|\n)([^{}\n][^{}]*)\{([^}]*)\}/g;
  let m;
  while ((m = rule.exec(css))) {
    const selector = m[2].trim().split("\n").pop().trim();
    const body = m[3];
    if (!/^\.[a-z0-9-]*(menu|pop|dropdown|panel)[a-z0-9-]*/i.test(selector)) continue;
    if (SAFE.some((c) => selector.startsWith(c))) continue;
    if (!/position:\s*absolute/.test(body)) continue;
    const at = css.slice(0, m.index).split("\n").length;
    absolutePopovers.push(`globals.css:${at}  ${selector.slice(0, 70)}`);
  }
}
report("Menus positioned absolute", absolutePopovers, "Use placePopover() from components/popover.ts, or confirm no scrolling ancestor.");

// 4 · A card header that is not the shared tinted band.
const CARD_HEADS = [
  "ch-head", "pl-card-head", "ch-rail-head", "ph-band", "mx-block-head",
  "nl-block-strip", "cc-dialog-head", "pb-modal-head", "pl-dialog-head",
  "fd-head", "ch-foot", "pl-band", "pb-gyms-title", "ch-note-when",
  "exercise-picker", "ms-head", "cpe-section", "ml-pop-head",
];
const strayHeads = [];
for (const f of files.filter((p) => p.endsWith(".tsx"))) {
  const src = read(f);
  src.split(/\r?\n/).forEach((line, i) => {
    if (!/className="[^"]*\b(ch-label|pl-eyebrow|ad-microlabel)\b/.test(line)) return;
    // Look back a few lines for a known header wrapper.
    const before = src.split(/\r?\n/).slice(Math.max(0, i - 4), i + 1).join(" ");
    if (!CARD_HEADS.some((c) => before.includes(c))) {
      strayHeads.push(`${f}:${i + 1}  ${line.trim().slice(0, 80)}`);
    }
  });
}
report("Card labels outside a known header band", strayHeads, "Headers are the accent tint with navy letters; see .pl-card-head.");

console.log(problems === 0 ? "\nNo drift found.\n" : `\n${problems} thing(s) to look at.\n`);
