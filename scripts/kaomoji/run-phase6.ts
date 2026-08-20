import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase6Collection } from "@/lib/kaomoji/collection/phase6-collector";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  const skipFastEmoji = process.env.SKIP_FASTEMOJI === "1";
  console.log("Phase 6 gap closure — baseline RAW will be recorded");
  console.log("SKIP_FASTEMOJI:", skipFastEmoji);

  const { manifest } = await runPhase6Collection(rootDir, {
    skipFastEmoji,
    fastEmojiMaxFetch: Number(process.env.FASTEMOJI_MAX_FETCH ?? 3000),
    fastEmojiMaxCollect: Number(process.env.FASTEMOJI_MAX_COLLECT ?? 12000),
  });

  console.log("\n=== Phase 6 Complete ===");
  console.log("RAW before:", manifest.raw_before);
  console.log("RAW after:", manifest.raw_after);
  console.log("New:", manifest.new_raw_records);
  console.log("Removed:", manifest.removed_records);
  console.log("Modified:", manifest.existing_raw_modified);
  console.log("Gaps closed:", manifest.phase6_gaps_closed.join(", "));
  if (manifest.fastemoji_canonical_discovered != null) {
    console.log("FastEmoji:", manifest.fastemoji_canonical_collected, "/", manifest.fastemoji_canonical_discovered, "remaining:", manifest.fastemoji_canonical_remaining);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
