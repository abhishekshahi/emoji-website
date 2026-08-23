import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase14Manifest } from "@/lib/kaomoji/processing/phase14/types";
import { getPhase14ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase14Manifest {
  const p = getPhase14ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase14 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase14Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 && m.benchmark_pass_rate >= 0.98 ? "PASS" : "FAIL";
  write("PHASE-14-SEARCH-AUDIT.md", [
    "# Phase 14 Search Audit",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "Root causes fixed for legacy failures:",
    "- anime/instagram/discord: controlled synonym intent mapping",
    "- whatsapp false positive: removed accidental content substring matching for text queries",
    "",
    `Legacy dataset: **${m.legacy_pass_count}/32** (${(m.legacy_pass_rate * 100).toFixed(1)}%)`,
    `Benchmark: **${m.benchmark_pass_count}/${m.benchmark_queries}** (${(m.benchmark_pass_rate * 100).toFixed(1)}%)`,
  ].join("\n"));
  write("PHASE-14-SEARCH-BENCHMARK.md", [
    "# Phase 14 Search Benchmark",
    "",
    `Queries: ${m.benchmark_queries}`,
    `Pass: ${m.benchmark_pass_count}`,
    `Rate: ${(m.benchmark_pass_rate * 100).toFixed(1)}%`,
    `Zero-result rate (non-empty): ${(m.zero_result_rate * 100).toFixed(1)}%`,
  ].join("\n"));
  write("PHASE-14-SEARCH-PERFORMANCE.md", [
    "# Phase 14 Search Performance",
    "",
    "Server-side inverted index v2. No full 50,979-record payload sent to browser.",
    "Pagination via limit/offset (max 48). Query capped at 120 chars.",
  ].join("\n"));
  write("PHASE-14-SEARCH-FINAL.md", [
    "# Phase 14 Search Final",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| Search version | ${m.search_version} |`,
    `| Index records | ${m.index_records.toLocaleString()} |`,
    `| Legacy pass | ${m.legacy_pass_count}/32 |`,
    `| Benchmark pass | ${m.benchmark_pass_count}/${m.benchmark_queries} |`,
    `| Benchmark rate | ${(m.benchmark_pass_rate * 100).toFixed(1)}% |`,
  ].join("\n"));
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-14-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}

main();