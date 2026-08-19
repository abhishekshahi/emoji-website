import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase2UniversalPipeline } from "@/lib/kaomoji/pipeline/phase2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  console.log("Running Phase 2 universal pipeline...");
  const { manifest } = await runPhase2UniversalPipeline(rootDir);
  console.log("Phase 2 complete.");
  console.log(`Raw items: ${manifest.raw_item_count}`);
  console.log(`Aggregated: ${manifest.aggregated_item_count}`);
  console.log(`Normalized: ${manifest.normalized_item_count}`);
  console.log(`Silent deletions: ${manifest.no_loss.silent_deletions}`);
  console.log(`Provenance coverage: ${manifest.provenance_coverage.toFixed(4)}`);
  console.log(`Warnings: ${manifest.warnings.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
