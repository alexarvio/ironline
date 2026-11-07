// Run from the repo root: node scripts/make-website-plan-mock.mjs website/index.html (it replaces the old .pl block; edit the markup in place after it has run once).
// Draws the website's plan mock as the app's Plan tab draws its Phases card (timelineParts.tsx, plan.css, phaseChrome.ts),
// for the demo client Emma on Wed 28 Oct, and puts it in website/index.html in place of the old one.
import { readFileSync, writeFileSync } from "node:fs";

const file = process.argv[2];
const ICON = {
  lifestyle: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  training: "M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12",
  nutrition: "M12 8c-2-2-7-1.5-7 4 0 4 3 8 5 8 1 0 1.3-.5 2-.5s1 .5 2 .5c2 0 5-4 5-8 0-5.5-5-6-7-4zM12 8c0-2 1-4 3-4",
};
const TRACK = {
  lifestyle: { label: "Lifestyle", tint: "#efede6", ink: "#a08a5c", rgb: "160, 138, 92" },
  training: { label: "Training", tint: "#e6e4fa", ink: "#3a3390", rgb: "58, 51, 144" },
  nutrition: { label: "Nutrition", tint: "#dff1ef", ink: "#1d7a70", rgb: "29, 122, 112" },
};
const SCHEDULED = { band: "#eef3f9", ink: "#1e3a6e", rgb: "30, 58, 110" };
const DRAFT = { band: "#fdf3ee", ink: "#b3471d" };
const TAG = { live: ["rgba(47, 122, 63, 0.12)", "#2f7a3f"], scheduled: ["#e6ecf3", "#1e3a6e"], draft: ["#fbe9e0", "#b3471d"] };

const WEEKS = [["W43", "19 Oct"], ["W44", "26 Oct"], ["W45", "2 Nov"], ["W46", "9 Nov"], ["W47", "16 Nov"], ["W48", "23 Nov"], ["W49", "30 Nov"], ["W50", "7 Dec"], ["W51", "14 Dec"], ["W52", "21 Dec"], ["W53", "28 Dec"], ["W1", "4 Jan"], ["W2", "11 Jan"]];
const MONTHS = [["Oct", 2], ["Nov", 5], ["Dec", 4], ["Jan", 2]];
const NOW_IDX = 1, NOW = 1 + 2 / 7; // Wednesday of W44

// [track, first col, last col (1-based), state, name, length, pill, clipStart, clipEnd]
const BARS = {
  lifestyle: [[1, 4, "live", "Sleep and steps", "8 weeks", "week 6 of 8", true], [5, 10, "scheduled", "Stress and recovery", "6 weeks", "starts 16/11"]],
  training: [[1, 4, "live", "Upper strength", "6 weeks", "week 4 of 6", true], [5, 8, "scheduled", "Peak", "4 weeks", "starts 16/11"], [9, 13, "draft", "Hypertrophy", "6 weeks", "", false, true]],
  nutrition: [[1, 10, "live", "Lean bulk", "12 weeks", "week 4 of 12", true], [11, 13, "scheduled", "Cut", "4 weeks", "starts 28/12", false, true]],
};

const sep = `<i class="sep"></i>`;
const bar = (track, [a, b, state, name, len, more, clipS, clipE]) => {
  const t = TRACK[track];
  const look = state === "live" ? { band: t.tint, ink: t.ink, border: `rgba(${t.rgb}, 0.5)`, style: "solid" } : state === "scheduled" ? { band: SCHEDULED.band, ink: SCHEDULED.ink, border: `rgba(${SCHEDULED.rgb}, 0.5)`, style: "solid" } : { band: DRAFT.band, ink: DRAFT.ink, border: DRAFT.ink, style: "dashed" };
  const span = b - a + 1;
  const elapsed = state === "live" ? Math.max(0, Math.min(span, NOW - (a - 1))) / span : 0;
  const [tagBg, tagInk] = TAG[state];
  const word = state === "live" ? "Live" : state === "scheduled" ? "Scheduled" : "Draft";
  const pill = `<span class="pq-pill" style="background:linear-gradient(${tagBg},${tagBg}),#fff;color:${tagInk}"><b>${word}</b>${more ? `${sep}${more}` : ""}</span>`;
  return `<div class="pq-bar${clipS ? " clip-start" : ""}${clipE ? " clip-end" : ""}" style="grid-column:${a} / span ${span};background:${look.band};color:${look.ink};border-color:${look.border};border-style:${look.style}">${elapsed ? `<span class="pq-el" style="width:${(elapsed * 100).toFixed(2)}%"></span>` : ""}<span class="pq-main"><span class="pq-name">${name}</span><span class="pq-meta">${len}</span></span>${pill}</div>`;
};

const cells = WEEKS.map(() => `<span class="pq-cell"></span>`).join("");
const lanes = Object.keys(BARS).map((track) => {
  const t = TRACK[track];
  return `<div class="pq-row"><span class="pq-lab"><svg viewBox="0 0 24 24" aria-hidden="true" style="color:${t.ink}"><path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="${ICON[track]}"/></svg>${t.label}</span><div class="pq-grid">${cells}${BARS[track].map((b) => bar(track, b)).join("")}</div></div>`;
}).join("\n      ");

const html = `<div class="pq" role="img" aria-label="Emma's plan, as on the Plan tab: Lifestyle, Training and Nutrition, each a lane of phases over the next three months, the live ones marked with their week, the next ones scheduled, one still a draft, and a line marking now.">
  <div class="pq-in" aria-hidden="true">
    <div class="pq-head"><b>Phases</b><span class="pq-tools"><span class="pq-pan"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M15 6l-6 6 6 6"/></svg><em>Today</em><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6"/></svg></span><span class="pq-cap"><span class="on">3 months</span><span>6 months</span><span>9 months</span><span>12 months</span></span><span class="pq-add"><svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>Add</span></span></div>
    <div class="pq-card">
      <div class="pq-row"><span></span><div class="pq-grid">${MONTHS.map(([m, n]) => `<span class="pq-month" style="grid-column:span ${n}">${m}</span>`).join("")}</div></div>
      <div class="pq-row"><span></span><div class="pq-grid">${WEEKS.map(([w, d], i) => `<span class="pq-week${i === NOW_IDX ? " now" : ""}"><b>${w}</b><small>${d}</small></span>`).join("")}</div></div>
      <div class="pq-body">
      ${lanes}
      <i class="pq-now" style="left:calc(var(--pq-lab) + (100% - var(--pq-lab)) * ${(NOW / WEEKS.length).toFixed(4)})"></i>
      </div>
    </div>
  </div>
</div>`;

let s = readFileSync(file, "utf8");
const a = s.indexOf(`<div class="pl" role="img"`);
const b = s.indexOf(`<div class="tracks">`, a);
if (a < 0 || b < 0) throw new Error("plan mock not found");
s = s.slice(0, a) + html + "\n    " + s.slice(b);
writeFileSync(file, s);
console.log("plan mock replaced");
