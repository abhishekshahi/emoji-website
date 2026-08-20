import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { EXPECTED_KAOMOJI, EXPECTED_RELATIONSHIPS, queryCount } from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase19ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const intervalMs = Number(process.env.PHASE19_WAIT_INTERVAL_MS ?? 120_000);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  console.log(
    "Waiting for D1 import gate:",
    EXPECTED_KAOMOJI,
    "kaomoji,",
    EXPECTED_RELATIONSHIPS,
    "relationships",
  );
  while (true) {
    const k = queryCount(rootDir, "kaomoji", true);
    const r = queryCount(rootDir, "relationship", true);
    console.log(new Date().toISOString(), "kaomoji=", k, "relationships=", r);
    const manifestPath = getPhase19ManifestPath(rootDir);
    if (existsSync(manifestPath)) {
      const m = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
      m.d1_kaomoji_count = k;
      m.d1_relationship_count = r;
      m.d1_import_complete = k === EXPECTED_KAOMOJI && r === EXPECTED_RELATIONSHIPS;
      writeFileSync(manifestPath, JSON.stringify(m, null, 2) + "\n", "utf8");
    }
    if (k === EXPECTED_KAOMOJI && r === EXPECTED_RELATIONSHIPS) {
      console.log("D1 import gate PASSED");
      process.exit(0);
    }
    await sleep(intervalMs);
  }
}

void main();
