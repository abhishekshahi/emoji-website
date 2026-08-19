import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase5CollectionManifest } from "@/lib/kaomoji/discovery/phase5/types";
import { PHASE5_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry-phase5";
import { getPhase5ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase5CollectionManifest {
  const p = getPhase5ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase5 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase5CollectionManifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.removed_records === 0 && m.deduplication_performed === false ? "PASS WITH WARNINGS" : "FAIL";

  write("PHASE-5-23-SOURCE-AUDIT.md", `# Phase 5 — 23 Source Audit\n\nCandidate: ${m.candidate_sources} | Unique identities: ${m.unique_source_identities}\n\nDedup performed: **${m.deduplication_performed}**\n`);
  write("PHASE-5-23-SOURCE-INVENTORY.md", `# Phase 5 Inventory\n\n${m.source_inventory.map((r) => `## ${r.source_id}\n\nStatus: ${r.status}\nOccurrences: ${r.raw_occurrences}\nDiscovered: ${r.records_discovered}\n`).join("\n")}`);
  write("PHASE-5-23-SOURCE-LICENSES.md", `# Phase 5 Licenses\n\n${m.source_inventory.map((r) => `- ${r.source_id}: ${r.license}\n`).join("")}`);
  write("PHASE-5-23-SOURCE-PAGES.md", `# Phase 5 Pages\n\nTotal pages: ${m.total_pages}\nTotal files: ${m.total_files}\n`);
  write("PHASE-5-23-RAW-COLLECTION.md", `# Phase 5 Raw Collection\n\nTOTAL RAW: ${m.total_raw_records}\nTOTAL OCCURRENCES: ${m.total_source_occurrences}\nNEW: ${m.new_raw_records}\n`);
  write("PHASE-5-23-PROVENANCE.md", `# Phase 5 Provenance\n\nCoverage: ${(m.provenance_coverage * 100).toFixed(1)}%\n`);
  write("PHASE-5-23-NO-LOSS.md", `# Phase 5 No Loss\n\n| raw_before | ${m.raw_before} |\n| raw_after | ${m.raw_after} |\n| removed | ${m.removed_records} |\n| modified | ${m.existing_raw_modified} |\n`);
  write("PHASE-5-23-FINAL.md", `# Phase 5 Final\n\n**Verdict: ${verdict}**\n\nDedup: ${m.deduplication_performed}\nRAW: ${m.raw_before} → ${m.raw_after}\n`);

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-5-source-registry.json"), `${JSON.stringify(PHASE5_SOURCE_REGISTRY, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-5-source-inventory.json"), `${JSON.stringify(m.source_inventory, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-5-raw-collection.json"), `${JSON.stringify({ total_raw: m.total_raw_records, source_counts: m.source_inventory.map((r) => ({ id: r.source_id, occurrences: r.raw_occurrences })) }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-5-provenance.json"), `${JSON.stringify({ coverage: m.provenance_coverage }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-5-final.json"), `${JSON.stringify(m, null, 2)}\n`, "utf8");
}

main();
