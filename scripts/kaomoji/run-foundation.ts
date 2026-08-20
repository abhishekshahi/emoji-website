import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runKaomojiFoundationPipeline } from "@/lib/kaomoji/pipeline/foundation";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  console.log("Running Kaomoji Phase 1 foundation pipeline...");
  const result = await runKaomojiFoundationPipeline(rootDir);

  console.log(`Raw records:       ${result.raw_count}`);
  console.log(`Aggregated:        ${result.aggregated_count}`);
  console.log(`Normalized:        ${result.normalized_count}`);
  console.log(`Validation:        ${result.validation_count}`);
  console.log(`Provenance:        ${result.provenance_count}`);
  console.log(`Silent deletions:  ${result.preservation.silent_deletions}`);
  console.log(`Single-source:     ${result.preservation.single_source_candidates}`);
  console.log(`Multi-source:      ${result.preservation.multi_source_candidates}`);
  console.log("License summary:", result.license_summary.by_status);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
