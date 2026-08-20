import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPhase3DiscoveryPath, getPhase3ManifestPath } from "@/lib/kaomoji/storage/paths";
import type { Phase3CollectionManifest } from "@/lib/kaomoji/discovery/types";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeReport(name: string, content: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), content, "utf8");
  console.log(`Wrote ${name}`);
}

function inventoryTable(m: Phase3CollectionManifest | null): string {
  return (m?.inventory ?? [])
    .map(
      (r) =>
        `| ${r.source_id} | ${r.pages} | ${r.raw_records} | ${r.unique} | ${r.duplicate} | ${r.review} | ${r.blocked} | ${r.status} |`,
    )
    .join("\n");
}

function buildFinal(m: Phase3CollectionManifest | null): string {
  const verdict =
    m && m.removed_raw === 0 && m.raw_after >= m.raw_before
      ? m.warnings.length > 0
        ? "PASS WITH WARNINGS"
        : "PASS"
      : "FAIL";

  return `# PHASE 3 — Final Report

Generated: ${new Date().toISOString()}

## Source inventory

| Source | Pages | Raw | Unique | Dup | Review | Blocked | Status |
|--------|-------|-----|--------|-----|--------|---------|--------|
${inventoryTable(m)}

## Totals

| Metric | Value |
|--------|-------|
| RAW before | ${m?.raw_before ?? "N/A"} |
| RAW after | ${m?.raw_after ?? "N/A"} |
| New raw | ${m?.new_raw ?? "N/A"} |
| Removed raw | ${m?.removed_raw ?? "N/A"} |
| Total unique | ${m?.total_unique ?? "N/A"} |
| Total aggregated | ${m?.total_aggregated ?? "N/A"} |
| Total normalized | ${m?.total_normalized ?? "N/A"} |
| Provenance | ${m?.provenance_coverage?.toFixed(4) ?? "N/A"} |

## Verdict

**${verdict}**
`;
}

function main(): void {
  const manifest = readJson<Phase3CollectionManifest>(getPhase3ManifestPath(rootDir));
  const discovery = readJson(getPhase3DiscoveryPath(rootDir));

  writeReport(
    "PHASE-3-FULL-COLLECTION.md",
    `# PHASE 3 — Full Collection\n\nRAW before: ${manifest?.raw_before}\nRAW after: ${manifest?.raw_after}\nNew: ${manifest?.new_raw}\nRemoved: ${manifest?.removed_raw}\n`,
  );
  writeReport("PHASE-3-SOURCE-BY-SOURCE.md", `# PHASE 3 — Source by Source\n\n${inventoryTable(manifest)}\n`);
  writeReport("PHASE-3-LICENSE.md", `# PHASE 3 — License\n\nSee inventory publication_gate columns in manifest.\n`);
  writeReport("PHASE-3-COVERAGE.md", `# PHASE 3 — Coverage\n\n${JSON.stringify(discovery, null, 2)}\n`);
  writeReport(
    "PHASE-3-NO-LOSS.md",
    `# PHASE 3 — No Loss\n\nRemoved raw: ${manifest?.removed_raw ?? "N/A"} (must be 0)\n`,
  );
  writeReport(
    "PHASE-3-PROVENANCE.md",
    `# PHASE 3 — Provenance\n\nCoverage: ${manifest?.provenance_coverage?.toFixed(4) ?? "N/A"}\n`,
  );
  writeReport("PHASE-3-FINAL.md", buildFinal(manifest));

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-3-full-collection.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-3-sources.json"), `${JSON.stringify(manifest?.inventory ?? [], null, 2)}\n`, "utf8");
  writeFileSync(
    join(manifestDir, "phase-3-license.json"),
    `${JSON.stringify({ inventory: manifest?.inventory?.map((r) => ({ source_id: r.source_id, gate: r.publication_gate })) }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(join(manifestDir, "phase-3-final.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

main();
