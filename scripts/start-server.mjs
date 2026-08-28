// Production start command (see package.json "start"). Seeds demo data into
// DATA_DIR on first boot only — guarded by a marker file on the same volume,
// since scripts/seed-rich.ts is not safe to re-run (it creates new clients
// and appends chat/meeting rows every time). On every later restart the
// marker already exists, so this just runs `next start` straight away.
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const DATA_DIR = process.env.DATA_DIR || process.cwd();
fs.mkdirSync(DATA_DIR, { recursive: true });
const marker = path.join(DATA_DIR, ".seeded");

// shell: true so this resolves "npx"/"node" correctly on Windows (where the
// real binaries are .cmd shims) as well as Linux (Railway's runtime).
function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: true });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (process.env.SKIP_SEED !== "1" && !fs.existsSync(marker)) {
  console.log("[start-server] No existing data found — seeding demo data...");
  run("node", ["scripts/seed.js"]);
  run("npx", ["tsx", "scripts/seed-rich.ts"]);
  fs.writeFileSync(marker, new Date().toISOString());
  console.log("[start-server] Seed complete.");
} else {
  console.log("[start-server] Existing data found, skipping seed.");
}

// Second-stage, separately-guarded enrichment pass (added after the initial
// seed was already deployed) — adds richer demo data to Jordan Blake and Sam
// Rivera without re-running or duplicating the first stage. Runs once ever,
// same marker-file pattern as above.
const lightMarker = path.join(DATA_DIR, ".seeded-light-v2");
if (process.env.SKIP_SEED !== "1" && !fs.existsSync(lightMarker)) {
  console.log("[start-server] Enriching light demo clients...");
  run("npx", ["tsx", "scripts/enrich-light-clients.ts"]);
  fs.writeFileSync(lightMarker, new Date().toISOString());
  console.log("[start-server] Light client enrichment complete.");
} else {
  console.log("[start-server] Light client data already enriched, skipping.");
}

// Coach-level metric templates (Stress/Nutrition/Training/Wellbeing/Optional
// weekly tracker categories) — not tied to any client, so this doesn't need
// the client data to exist first. The script itself is idempotent (skips
// categories that already exist), but it's marker-guarded too so a restart
// doesn't re-check on every boot.
const templatesMarker = path.join(DATA_DIR, ".seeded-templates");
if (process.env.SKIP_SEED !== "1" && !fs.existsSync(templatesMarker)) {
  console.log("[start-server] Seeding metric templates...");
  run("npx", ["tsx", "scripts/seed-metric-templates.ts"]);
  fs.writeFileSync(templatesMarker, new Date().toISOString());
  console.log("[start-server] Metric templates seeded.");
} else {
  console.log("[start-server] Metric templates already seeded, skipping.");
}

const result = spawnSync("npx", ["next", "start"], { stdio: "inherit", shell: true });
if (result.error) throw result.error;
process.exit(result.status ?? 0);
