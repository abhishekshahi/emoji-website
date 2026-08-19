import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase9Pipeline } from "@/lib/kaomoji/processing/phase9/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 9 — kaomoji knowledge + product layer");
  const { manifest, searchPassRate } = runPhase9Pipeline(rootDir);
  console.log("\n=== Phase 9 Complete ===");
  console.log("RAW:", manifest.raw_before, "removed:", manifest.raw_removed);
  console.log("Canonical:", manifest.canonical_candidates, "Public:", manifest.public_candidates);
  console.log("Tier 1/2/3:", manifest.tier_1, manifest.tier_2, manifest.tier_3);
  console.log("Collections:", manifest.collections, "Relationships:", manifest.relationships);
  console.log("Search pass rate:", (searchPassRate * 100).toFixed(1) + "%");
}

main();
