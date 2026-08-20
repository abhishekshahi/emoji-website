import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase19Pipeline } from "@/lib/kaomoji/processing/phase19/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 19 - Cloudflare D1 + R2 production migration");
  const { manifest, export: summary } = runPhase19Pipeline(rootDir);
  console.log("Public records:", manifest.public_records);
  console.log("Relationships:", manifest.relationships);
  console.log("D1 SQL files:", summary.d1_sql_files);
  console.log("R2 export:", summary.export_dir);
  if (manifest.errors.length) {
    console.error("Errors:", manifest.errors);
    process.exitCode = 1;
  }
}

main();
