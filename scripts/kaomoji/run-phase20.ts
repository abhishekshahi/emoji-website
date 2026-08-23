import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase20Pipeline } from "@/lib/kaomoji/processing/phase20/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 20 - production hardening");
  const { manifest } = runPhase20Pipeline(rootDir);
  console.log("Search benchmark:", manifest.performance.search_benchmark_score);
  console.log("Schema indexes:", manifest.performance.schema_indexes);
  console.log("Security:", manifest.security);
  if (manifest.errors.length) {
    console.error("Errors:", manifest.errors);
    process.exitCode = 1;
  }
}

main();
