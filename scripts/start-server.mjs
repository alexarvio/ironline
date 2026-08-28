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

const result = spawnSync("npx", ["next", "start"], { stdio: "inherit", shell: true });
if (result.error) throw result.error;
process.exit(result.status ?? 0);
