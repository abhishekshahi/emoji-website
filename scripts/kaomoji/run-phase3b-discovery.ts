import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase3BDiscovery } from "@/lib/kaomoji/discovery/phase3b/discover";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

async function main(): Promise<void> {
  console.log("Phase 3B discovery audit (no raw modifications)...");
  const m = await runPhase3BDiscovery(rootDir);
  console.log(`RAW before/after: ${m.raw_before} / ${m.raw_after} (removed: ${m.removed_records})`);
  console.log(`Sources active: ${m.sources_active}, mismatch: ${m.sources_mismatch}, inaccessible: ${m.sources_inaccessible}`);
  for (const row of m.inventory_table) {
    console.log(`  ${row.source}: raw=${row.raw} discovered_status=${row.status}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
