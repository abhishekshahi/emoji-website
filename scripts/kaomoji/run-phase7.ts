import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EXPECTED_RAW_BASELINE, runPhase7Pipeline } from "@/lib/kaomoji/processing/phase7/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log(`Phase 7 processing — RAW baseline ${EXPECTED_RAW_BASELINE}`);
  const { manifest } = runPhase7Pipeline(rootDir);
  console.log("\n=== Phase 7 Complete ===");
  console.log("RAW before/after:", manifest.raw_before, "/", manifest.raw_after);
  console.log("Removed:", manifest.raw_removed, "Modified:", manifest.raw_modified);
  console.log("Normalized:", manifest.total_normalized);
  console.log("Variants:", manifest.variant_count);
  console.log("Provenance:", (manifest.provenance_coverage * 100).toFixed(1) + "%");
}

main();
