import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase3AcquisitionPipeline } from "@/lib/kaomoji/collection/phase3-collector";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  console.log("Running Phase 3 full acquisition pipeline...");
  const { manifest } = await runPhase3AcquisitionPipeline(rootDir);
  console.log("Phase 3 complete.");
  console.log(`RAW before: ${manifest.raw_before}`);
  console.log(`RAW after: ${manifest.raw_after}`);
  console.log(`New raw: ${manifest.new_raw}`);
  console.log(`Removed raw: ${manifest.removed_raw}`);
  console.log(`Total unique: ${manifest.total_unique}`);
  console.log(`Total aggregated: ${manifest.total_aggregated}`);
  for (const row of manifest.inventory) {
    console.log(`  ${row.source_id}: ${row.raw_records} raw (${row.status})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
