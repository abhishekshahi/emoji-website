import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase8Pipeline } from "@/lib/kaomoji/processing/phase8/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 8 — canonical library construction (no RAW deletion)");
  const { manifest } = runPhase8Pipeline(rootDir);
  console.log("\n=== Phase 8 Complete ===");
  console.log("RAW:", manifest.raw_before, "→", manifest.raw_after, "removed:", manifest.raw_removed);
  console.log("Canonical candidates:", manifest.canonical_candidates);
  console.log("Exact groups:", manifest.exact_groups, "occurrences:", manifest.exact_occurrences);
  console.log("Provenance COMPLETE:", manifest.provenance.COMPLETE, "PARTIAL:", manifest.provenance.PARTIAL);
  console.log("Curation KEEP:", manifest.curation.KEEP_CANDIDATE, "REVIEW:", manifest.curation.REVIEW, "REMOVE_CAND:", manifest.curation.REMOVE_CANDIDATE);
  console.log("No-loss:", manifest.no_loss.all_raw_mapped ? "PASS" : "FAIL");
}

main();
