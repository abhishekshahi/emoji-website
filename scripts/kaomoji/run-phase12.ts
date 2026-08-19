import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase12Pipeline } from "@/lib/kaomoji/processing/phase12/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 12 — final quality library (Excellent/High/Good/Medium)");
  const { manifest } = runPhase12Pipeline(rootDir);
  console.log("\n=== Phase 12 Complete ===");
  console.log("Quality qualified:", manifest.quality_qualified);
  console.log("Publication eligible:", manifest.publication_eligible);
  console.log("RAW unchanged:", manifest.raw_before, "->", manifest.raw_after);
}
main();
