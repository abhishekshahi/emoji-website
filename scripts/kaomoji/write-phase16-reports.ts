import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase16Manifest } from "@/lib/kaomoji/processing/phase16/types";
import { getPhase16ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase16Manifest {
  const p = getPhase16ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase16 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase16Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 && m.indexable_rate >= 0.99 ? "PASS" : "FAIL";
  write("PHASE-16-SEO-AUDIT.md", [
    "# Phase 16 SEO Audit",
    "",
    `**Verdict:** ${verdict}`,
    "",
    `Indexable: **${m.indexable_count}/${m.total_public}** (${(m.indexable_rate * 100).toFixed(1)}%)`,
    `Sitemap slugs: **${m.sitemap_slugs.toLocaleString()}**`,
    `Collection pages: **${m.collection_pages}**`,
    `Structured data: ${m.structured_data_types.join(", ")}`,
  ].join("\n"));
  write("PHASE-16-SEO-FINAL.md", [
    "# Phase 16 SEO Final",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| SEO version | ${m.seo_version} |`,
    `| Indexable rate | ${(m.indexable_rate * 100).toFixed(1)}% |`,
    `| Collection pages | ${m.collection_pages} |`,
  ].join("\n"));
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-16-final.json"), JSON.stringify(m, null, 2) + "\n", "utf8");
}

main();
