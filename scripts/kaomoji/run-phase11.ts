import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase11Pipeline } from "@/lib/kaomoji/processing/phase11/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 11 — canonical library composition audit (analysis only)");
  const { manifest } = runPhase11Pipeline(rootDir);
  console.log("\n=== Phase 11 Complete ===");
  console.log("RAW:", manifest.raw_before, "removed:", manifest.raw_removed);
  console.log("Canonical:", manifest.canonical_candidates);
  console.log("Public:", manifest.public_candidates);
  console.log("Unique:", manifest.unique_records);
}
main();
