import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase3BManifest } from "@/lib/kaomoji/discovery/phase3b/types";
import { getPhase3BManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase3BManifest | null {
  const p = getPhase3BManifestPath(rootDir);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as Phase3BManifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function table(m: Phase3BManifest): string {
  return m.inventory_table
    .map(
      (r) =>
        `| ${r.source} | ${r.pages} | ${r.categories} | ${r.raw} | ${r.unique} | ${r.duplicates} | ${r.content_types.join(",")} | ${r.status} |`,
    )
    .join("\n");
}

function main(): void {
  const m = readManifest();
  if (!m) throw new Error("Run npm run kaomoji:phase3b-discovery first");

  write(
    "PHASE-3B-SOURCE-DISCOVERY.md",
    `# PHASE 3B — Source Discovery\n\nGenerated: ${m.timestamp}\n\nDiscovery-only audit. **No raw records modified.**\n\nremoved_records: ${m.removed_records}\n`,
  );

  write(
    "PHASE-3B-SOURCE-INVENTORY.md",
    `# PHASE 3B — Source Inventory\n\n| Source | Pages | Categories | Raw | Unique | Duplicates | Content Types | Status |\n|--------|-------|------------|-----|--------|------------|--------------|--------|\n${table(m)}\n\n## Totals\n\n- TOTAL RAW: ${m.total_raw}\n- TOTAL UNIQUE: ${m.total_unique}\n- TOTAL DUPLICATES: ${m.total_duplicates}\n- TOTAL DISCOVERED (sum where measured): ${m.total_discovered}\n`,
  );

  write(
    "PHASE-3B-LICENSE-TERMS.md",
    `# PHASE 3B — License / Terms\n\n${m.source_audits.map((a) => `## ${a.source_id}\n\n- License: ${a.license.license_status} (${a.license.license ?? "unknown"})\n- Terms: ${a.license.terms_url ?? "n/a"}\n- Commercial: ${a.license.commercial_use}\n- Redistribution: ${a.license.redistribution}\n- Attribution: ${a.license.attribution}\n`).join("\n")}`,
  );

  write(
    "PHASE-3B-COVERAGE.md",
    `# PHASE 3B — Coverage\n\n${m.source_audits.map((a) => `### ${a.source_id}\n\n${a.status_evidence.map((e) => `- ${e}`).join("\n")}\n`).join("\n")}`,
  );

  write(
    "PHASE-3B-NO-LOSS.md",
    `# PHASE 3B — No Loss\n\n| Metric | Value |\n|--------|-------|\n| raw_before | ${m.raw_before} |\n| raw_after | ${m.raw_after} |\n| removed_records | ${m.removed_records} |\n| new_records | ${m.new_records} |\n`,
  );

  const verdict = m.removed_records === 0 ? "PASS WITH WARNINGS" : "FAIL";
  write(
    "PHASE-3B-FINAL.md",
    `# PHASE 3B — Final Discovery Report\n\n**Verdict: ${verdict}**\n\n| Metric | Value |\n|--------|-------|\n| Sources active | ${m.sources_active} |\n| Sources mismatch | ${m.sources_mismatch} |\n| Sources inaccessible | ${m.sources_inaccessible} |\n| Total raw | ${m.total_raw} |\n| Total unique | ${m.total_unique} |\n\n${table(m)}\n`,
  );

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-3b-source-inventory.json"), `${JSON.stringify(m.inventory_table, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-3b-coverage.json"), `${JSON.stringify(m.source_audits, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-3b-license.json"), `${JSON.stringify(m.source_audits.map((a) => a.license), null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-3b-final.json"), `${JSON.stringify(m, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-3b-full-collection.json"), `${JSON.stringify({ url_inventory: m.url_inventory }, null, 2)}\n`, "utf8");
}

main();
