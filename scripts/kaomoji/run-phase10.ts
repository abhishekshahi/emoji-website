import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase10Pipeline } from "@/lib/kaomoji/processing/phase10/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 10 — scoring + curation pass");
  const { manifest } = runPhase10Pipeline(rootDir);
  console.log("\n=== Phase 10 Complete ===");
  console.log("RAW:", manifest.raw_before, "removed:", manifest.raw_removed);
  console.log("Scored:", manifest.canonical_candidates);
  console.log("Popularity:", manifest.popularity_status);
}

main();
