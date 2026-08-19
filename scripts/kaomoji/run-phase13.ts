import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase13Pipeline } from "@/lib/kaomoji/processing/phase13/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 13 - final data, legal, storage and build audit");
  const { manifest } = runPhase13Pipeline(rootDir);
  console.log("\n=== Phase 13 Complete ===");
  console.log("Quality-qualified:", manifest.quality_qualified);
  console.log("Publication eligible:", manifest.publication_eligible);
  console.log("Relationships:", manifest.relationships);
  console.log("RAW drift:", manifest.raw_drift.drift);
  console.log("Storage public:", manifest.storage.public_production_bytes);
  console.log("Errors:", manifest.errors.length);
}

main();