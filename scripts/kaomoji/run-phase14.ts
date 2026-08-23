import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase14Pipeline } from "@/lib/kaomoji/processing/phase14/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 14 - search excellence");
  const { manifest } = runPhase14Pipeline(rootDir);
  console.log("Benchmark:", (manifest.benchmark_pass_rate * 100).toFixed(1) + "%", manifest.benchmark_pass_count + "/" + manifest.benchmark_queries);
  console.log("Legacy:", manifest.legacy_pass_count + "/32");
  console.log("Index records:", manifest.index_records);
}

main();