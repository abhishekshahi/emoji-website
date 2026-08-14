import { readFileSync } from "node:fs";
import { join } from "node:path";
import { integrationDataPaths } from "@/lib/master/integration/config";
import type { ProductionToMasterMap } from "@/lib/master/integration/types";

let slugByCanonicalId: Map<string, string> | null = null;

export function getProductionSlugForCanonical(
  canonicalId: string,
  rootDir: string = process.cwd(),
): string | null {
  if (!slugByCanonicalId) {
    const map = JSON.parse(
      readFileSync(join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"), "utf8"),
    ) as ProductionToMasterMap;
    const emojis = JSON.parse(readFileSync(join(rootDir, "src/data/emojis.json"), "utf8")) as Array<{
      slug: string;
      hexcode: string;
    }>;
    const extras = JSON.parse(readFileSync(join(rootDir, "src/data/openmoji-extras.json"), "utf8")) as Array<{
      slug: string;
      hexcode: string;
    }>;
    const byHex = new Map<string, string>();
    for (const emoji of [...emojis, ...extras]) {
      byHex.set(emoji.hexcode.toUpperCase(), emoji.slug);
    }
    slugByCanonicalId = new Map<string, string>();
    for (const entry of [...map.standardRecords.entries, ...map.extrasRecords.entries]) {
      const slug = byHex.get(entry.productionHexcode.toUpperCase());
      if (slug) {
        slugByCanonicalId.set(entry.canonicalId, slug);
      }
    }
  }
  return slugByCanonicalId.get(canonicalId) ?? null;
}

export function resetProductionSlugCache(): void {
  slugByCanonicalId = null;
}
