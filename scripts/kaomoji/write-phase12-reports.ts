import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase12Manifest } from "@/lib/kaomoji/processing/phase12/types";
import { formatBytes } from "@/lib/kaomoji/processing/phase12/storage-measure";
import { getPhase12ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase12Manifest {
  const p = getPhase12ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase12 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase12Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 ? "PASS" : "FAIL";
  write("PHASE-12-QUALITY-LIBRARY.md", [
    "# Phase 12 Quality Library",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Count |",
    "|--------|------:|",
    `| EXCELLENT | ${m.excellent_qualified.toLocaleString()} |`,
    `| HIGH | ${m.high_qualified.toLocaleString()} |`,
    `| GOOD | ${m.good_qualified.toLocaleString()} |`,
    `| MEDIUM | ${m.medium_qualified.toLocaleString()} |`,
    `| **QUALITY-QUALIFIED** | **${m.quality_qualified.toLocaleString()}** |`,
    `| **FINAL PUBLIC** | **${m.publication_eligible.toLocaleString()}** |`,
    `| LOW excluded | ${m.low_excluded} |`,
    `| INVALID/REVIEW excluded | ${m.invalid_excluded} |`,
    "",
    "Output: `data/kaomoji/processed/phase-12/public-quality/`",
  ].join("\n"));
  write("PHASE-12-QUALITY-FILTER.md", [
    "# Quality Filter",
    "",
    "Included: EXCELLENT, HIGH, GOOD, MEDIUM",
    "Excluded: LOW, INVALID_REVIEW",
    "",
    `Quality-qualified: ${m.quality_qualified}`,
    `Publication-blocked (quality-qualified): ${m.publication_blocked}`,
  ].join("\n"));
  write("PHASE-12-STORAGE.md", [
    "# Storage",
    "",
    `| Tier | Size |`,
    "|------|------|",
    `| Excellent | ${formatBytes(m.storage.excellent_bytes)} |`,
    `| High | ${formatBytes(m.storage.high_bytes)} |`,
    `| Good | ${formatBytes(m.storage.good_bytes)} |`,
    `| Medium | ${formatBytes(m.storage.medium_bytes)} |`,
    `| **Total** | **${formatBytes(m.storage.total_public_bytes)}** |`,
  ].join("\n"));
  write("PHASE-12-SEARCH.md", `# Search\n\nServer-side index: ${m.publication_eligible.toLocaleString()} publication-eligible records`);
  write("PHASE-12-SEO.md", `# SEO\n\nIndexable from publication-eligible P0/P1 records only`);
  write("PHASE-12-QA.md", `# QA\n\nVerdict: ${verdict}\nErrors: ${m.errors.length}\nWarnings: ${m.warnings.length}`);
  write("PHASE-12-DEPLOYMENT.md", `# Deployment\n\nVerdict: ${verdict}\nDeploy: ${verdict === "PASS" ? "YES" : "NO"}`);
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-12-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}

main();
