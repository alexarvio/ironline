// The production build without the running app's memory cap (4 Nov, Alex): Railway hands its variables to the build as
// well, and NODE_OPTIONS=--max-old-space-size=768 (meant to keep the running server small) made `next build`'s type
// check run out of memory. The cap belongs to the running app alone (package.json "start"); the build gets room.
import { spawnSync } from "child_process";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const env = { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" };
const result = spawnSync(process.execPath, [nextBin, "build"], { stdio: "inherit", env });
process.exit(result.status ?? 1);
