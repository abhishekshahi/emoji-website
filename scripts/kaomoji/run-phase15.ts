import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase15Pipeline } from "@/lib/kaomoji/processing/phase15/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 15 - multilingual architecture");
  const { manifest } = runPhase15Pipeline(rootDir);
  console.log("Locales:", manifest.supported_locales);
  console.log("Search terms:", manifest.localized_search_terms);
  console.log("Hreflang routes:", manifest.hreflang_routes);
}

main();
