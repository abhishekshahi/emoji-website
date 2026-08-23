import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase18Pipeline } from "@/lib/kaomoji/processing/phase18/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 18 - analytics popularity");
  const { manifest } = runPhase18Pipeline(rootDir);
  console.log("Events wired:", manifest.events_wired.join(", "));
  console.log("Popularity:", manifest.popularity_status);
}

main();
