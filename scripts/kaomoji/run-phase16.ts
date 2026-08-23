import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase16Pipeline } from "@/lib/kaomoji/processing/phase16/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 16 - SEO content");
  const { manifest } = runPhase16Pipeline(rootDir);
  console.log("Indexable:", manifest.indexable_count + "/" + manifest.total_public);
  console.log("Collections:", manifest.collection_pages);
}

main();
