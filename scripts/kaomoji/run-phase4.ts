import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase4AcquisitionPipeline } from "@/lib/kaomoji/collection/phase4-collector";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  const maxFetch = process.env.FASTEMOJI_MAX_FETCH ? Number(process.env.FASTEMOJI_MAX_FETCH) : 1500;
  const skipFastEmoji = process.env.SKIP_FASTEMOJI === "1";
  console.log(`Phase 4 acquisition (FastEmoji maxFetch=${maxFetch}, skip=${skipFastEmoji})...`);
  const { manifest } = await runPhase4AcquisitionPipeline(rootDir, {
    fastEmojiMaxFetch: maxFetch,
    skipFastEmoji,
  });
  console.log(`RAW before/after: ${manifest.raw_before} / ${manifest.raw_after}`);
  console.log(`New raw: ${manifest.new_raw_records}, removed: ${manifest.removed_records}`);
  for (const r of manifest.source_results) {
    console.log(`  ${r.source_id}: discovered=${r.discovered} collected=${r.collected} new=${r.new_raw}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
