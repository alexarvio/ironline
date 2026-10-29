import { readFileSync } from "fs";
import { join } from "path";

// The build this server runs (Next writes .next/BUILD_ID on every build; "development" under next dev). A page knows
// the build it came from, so a phone left open across a deploy can tell it is stale (FreshBuild).
let cached: string | null = null;
export function buildId(): string {
  if (cached) return cached;
  try {
    cached = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim() || "unknown";
  } catch {
    cached = "unknown";
  }
  return cached;
}
