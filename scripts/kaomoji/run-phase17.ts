import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase17Pipeline } from "@/lib/kaomoji/processing/phase17/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 17 - UI/UX");
  const { manifest } = runPhase17Pipeline(rootDir);
  console.log("Instant search:", manifest.instant_search);
  console.log("Filter categories:", manifest.filter_categories);
}

main();
