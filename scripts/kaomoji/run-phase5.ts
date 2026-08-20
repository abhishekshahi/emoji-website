import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase5AcquisitionPipeline } from "@/lib/kaomoji/collection/phase5-collector";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  const skipFastEmoji = process.env.SKIP_FASTEMOJI === "1";
  const maxFetch = process.env.FASTEMOJI_MAX_FETCH ? Number(process.env.FASTEMOJI_MAX_FETCH) : 1500;
  console.log(`Phase 5 acquisition (NO DEDUP, skipFastEmoji=${skipFastEmoji})...`);
  const { manifest } = await runPhase5AcquisitionPipeline(rootDir, {
    skipFastEmoji,
    fastEmojiMaxFetch: maxFetch,
  });
  console.log(`RAW before/after: ${manifest.raw_before} / ${manifest.raw_after}`);
  console.log(`New: ${manifest.new_raw_records}, removed: ${manifest.removed_records}, dedup: ${manifest.deduplication_performed}`);
  for (const row of manifest.source_inventory) {
    console.log(`  ${row.source_id} [${row.status}]: occurrences=${row.raw_occurrences} discovered=${row.records_discovered}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
