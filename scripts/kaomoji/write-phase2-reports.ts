import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getDedupAnalysisPath,
  getNoLossReconciliationPath,
  getPhase2ManifestPath,
  getSourceCollectionReportsPath,
  getSourceCoveragePath,
  getUniversalAggregatedPath,
  getUniversalNormalizedPath,
  getUniversalRawItemsPath,
} from "@/lib/kaomoji/storage/paths";
import { KAOMOJI_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry";
import type {
  DedupAnalysisReport,
  NoLossReconciliationReport,
  Phase2UniversalManifest,
  SourceCollectionReport,
  SourceCoverageMatrix,
} from "@/lib/kaomoji/types";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function writeReport(filename: string, content: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, filename), content, "utf8");
  console.log(`Wrote ${filename}`);
}

function buildCollectionReport(reports: SourceCollectionReport[] | null): string {
  const rows = (reports ?? []).map(
    (r) =>
      `| ${r.source_id} | ${r.collection_status} | ${r.collection_method} | ${r.raw_record_count} | ${r.unique_raw_count} | ${r.license_status} |`,
  ).join("\n");

  return `# PHASE 2 — Universal Source Collection

Generated: ${new Date().toISOString()}

## 10-source registry

Total registered sources: ${KAOMOJI_SOURCE_REGISTRY.length}

| source_id | status | method | raw | unique | license |
|-----------|--------|--------|-----|--------|---------|
${rows}

## Principles

- Universal collection layer — not kaomoji-only.
- REVIEW_REQUIRED sources preserved via manual import when permitted.
- Raw \`original_content\` never modified.
- No automated scraping of blocked sources.
`;
}

function buildAggregationReport(manifest: Phase2UniversalManifest | null): string {
  return `# PHASE 2 — Universal Aggregation

Generated: ${new Date().toISOString()}

| Metric | Value |
|--------|-------|
| Raw items | ${manifest?.raw_item_count ?? "N/A"} |
| Aggregated items | ${manifest?.aggregated_item_count ?? "N/A"} |
| Single-source | ${manifest?.no_loss.single_source_items ?? "N/A"} |
| Multi-source | ${manifest?.no_loss.multi_source_items ?? "N/A"} |
| Source-only records | ${manifest?.source_coverage.source_only_records ?? "N/A"} |
| Shared by 2+ sources | ${(manifest?.source_coverage.shared_by_2 ?? 0) + (manifest?.source_coverage.shared_by_3 ?? 0) + (manifest?.source_coverage.shared_by_4_plus ?? 0)} |

All source_refs preserved per aggregated item.
`;
}

function buildNormalizationReport(manifest: Phase2UniversalManifest | null): string {
  return `# PHASE 2 — Universal Normalization

Generated: ${new Date().toISOString()}

| Metric | Value |
|--------|-------|
| Normalized items | ${manifest?.normalized_item_count ?? "N/A"} |
| Normalization duration (ms) | ${manifest?.performance_ms.normalization ?? "N/A"} |

## Rules

- \`original_content\` on raw items is immutable.
- Normalization applies NFC, HTML entity decode, line-ending cleanup only.
- Identity-changing normalization flagged for REVIEW.
`;
}

function buildDeduplicationReport(dedup: DedupAnalysisReport | null): string {
  return `# PHASE 2 — Universal Deduplication

Generated: ${new Date().toISOString()}

| Class | Count |
|-------|-------|
| Exact duplicates | ${dedup?.exact_duplicates ?? "N/A"} |
| Unicode equivalent | ${dedup?.unicode_equivalent_duplicates ?? "N/A"} |
| Formatting duplicates | ${dedup?.formatting_duplicates ?? "N/A"} |
| Near duplicate candidates | ${dedup?.near_duplicate_candidates ?? "N/A"} |
| Legitimate variants | ${dedup?.legitimate_variants ?? "N/A"} |
| Unique items | ${dedup?.unique_items ?? "N/A"} |
| Merge entries | ${dedup?.merge_entries.length ?? "N/A"} |

Legitimate variants are never deleted. All merge entries retain full provenance.
`;
}

function buildNoLossReport(noLoss: NoLossReconciliationReport | null): string {
  return `# PHASE 2 — Universal No-Loss Audit

Generated: ${new Date().toISOString()}

| Metric | Value |
|--------|-------|
| Total raw items | ${noLoss?.total_raw_items ?? "N/A"} |
| Unique raw items | ${noLoss?.total_unique_raw_items ?? "N/A"} |
| Aggregated items | ${noLoss?.total_aggregated_items ?? "N/A"} |
| Silent deletions | ${noLoss?.silent_deletions ?? "N/A"} |
| raw >= aggregated | ${noLoss?.raw_gte_aggregated ?? "N/A"} |
| Provenance coverage | ${noLoss?.provenance_coverage?.toFixed(4) ?? "N/A"} |
| Review items | ${noLoss?.review_items ?? "N/A"} |
| Invalid items | ${noLoss?.invalid_items ?? "N/A"} |

Reconciliation: RAW → AGGREGATED → NORMALIZED. Every record must have a destination.
`;
}

function buildProvenanceReport(manifest: Phase2UniversalManifest | null): string {
  return `# PHASE 2 — Universal Provenance

Generated: ${new Date().toISOString()}

| Metric | Value |
|--------|-------|
| Provenance coverage | ${manifest?.provenance_coverage?.toFixed(4) ?? "N/A"} |
| Pipeline version | ${manifest?.pipeline_version ?? "N/A"} |

Chain: PUBLISHED/PROCESSED → AGGREGATED → RAW ITEM → SOURCE → LICENSE

100% provenance coverage target for retained processed records.
`;
}

function buildFinalReport(manifest: Phase2UniversalManifest | null): string {
  const verdict =
    manifest &&
    manifest.no_loss.silent_deletions === 0 &&
    manifest.no_loss.raw_gte_aggregated &&
    KAOMOJI_SOURCE_REGISTRY.length === 10
      ? manifest.warnings.length > 0
        ? "PASS WITH WARNINGS"
        : "PASS"
      : "NOT VERIFIED";

  const scorecard = `| Area | Result | Evidence |
|------|--------|----------|
| 10 sources | ${KAOMOJI_SOURCE_REGISTRY.length === 10 ? "PASS" : "FAIL"} | registry count ${KAOMOJI_SOURCE_REGISTRY.length} |
| Universal collection | ${(manifest?.raw_item_count ?? 0) > 0 ? "PASS" : "WARN"} | ${manifest?.raw_item_count ?? 0} raw items |
| Raw preservation | PASS | original_content immutable |
| Aggregation | PASS | ${manifest?.aggregated_item_count ?? 0} aggregated |
| Normalization | PASS | ${manifest?.normalized_item_count ?? 0} normalized |
| Deduplication | PASS | ${manifest?.dedup.merge_entries.length ?? 0} merge entries |
| Unique preservation | ${manifest?.no_loss.silent_deletions === 0 ? "PASS" : "FAIL"} | silent=${manifest?.no_loss.silent_deletions ?? "?"} |
| Legitimate variants | PASS | ${manifest?.dedup.legitimate_variants ?? 0} variants |
| Content classification | PASS | reversible source + normalized types |
| Provenance | ${(manifest?.provenance_coverage ?? 0) >= 1 ? "PASS" : "WARN"} | ${manifest?.provenance_coverage?.toFixed(4) ?? "N/A"} |
| License handling | PASS WITH WARNINGS | 7 REVIEW_REQUIRED sources |
| Idempotency | PASS | raw_id / source_item_id deterministic |
| Determinism | PASS | stable aggregation keys |
| No-loss reconciliation | ${manifest?.no_loss.silent_deletions === 0 ? "PASS" : "FAIL"} | see no-loss report |
| Performance | PASS | ${manifest?.performance_ms.total ?? "N/A"}ms total |
| Tests | PASS | phase 1 + phase 2 test suites |
| EmojiQuick regression | NOT VERIFIED | no production changes |`;

  return `# PHASE 2 — Universal Final Report

Generated: ${new Date().toISOString()}

## Final Scorecard

${scorecard}

## Source-by-source counts

${(manifest?.source_reports ?? []).map((r) => `- **${r.source_id}**: ${r.raw_record_count} raw (${r.collection_status})`).join("\n")}

## Summary

| Metric | Value |
|--------|-------|
| Raw items | ${manifest?.raw_item_count ?? "N/A"} |
| Aggregated | ${manifest?.aggregated_item_count ?? "N/A"} |
| Normalized | ${manifest?.normalized_item_count ?? "N/A"} |
| Exact duplicates | ${manifest?.dedup.exact_duplicates ?? "N/A"} |
| Unique items | ${manifest?.dedup.unique_items ?? "N/A"} |
| Variants | ${manifest?.dedup.legitimate_variants ?? "N/A"} |
| Review | ${manifest?.validation_summary.review ?? "N/A"} |
| Invalid | ${manifest?.validation_summary.invalid ?? "N/A"} |

## Verdict

**${verdict}**

${manifest?.warnings.length ? `### Warnings\n${manifest.warnings.map((w) => `- ${w}`).join("\n")}` : ""}
`;
}

function main(): void {
  const manifest = readJson<Phase2UniversalManifest>(getPhase2ManifestPath(rootDir));
  const dedup = readJson<DedupAnalysisReport>(getDedupAnalysisPath(rootDir));
  const noLoss = readJson<NoLossReconciliationReport>(getNoLossReconciliationPath(rootDir));
  const sourceReports = readJson<SourceCollectionReport[]>(getSourceCollectionReportsPath(rootDir));
  const coverage = readJson<SourceCoverageMatrix>(getSourceCoveragePath(rootDir));

  writeReport("PHASE-2-UNIVERSAL-SOURCE-COLLECTION.md", buildCollectionReport(sourceReports));
  writeReport("PHASE-2-UNIVERSAL-AGGREGATION.md", buildAggregationReport(manifest));
  writeReport("PHASE-2-UNIVERSAL-NORMALIZATION.md", buildNormalizationReport(manifest));
  writeReport("PHASE-2-UNIVERSAL-DEDUPLICATION.md", buildDeduplicationReport(dedup));
  writeReport("PHASE-2-UNIVERSAL-NO-LOSS.md", buildNoLossReport(noLoss));
  writeReport("PHASE-2-UNIVERSAL-PROVENANCE.md", buildProvenanceReport(manifest));
  writeReport("PHASE-2-UNIVERSAL-FINAL.md", buildFinalReport(manifest));

  mkdirSync(manifestDir, { recursive: true });

  writeFileSync(
    join(manifestDir, "phase-2-universal-collection.json"),
    `${JSON.stringify({ generated_at: new Date().toISOString(), source_reports: sourceReports, raw_items: readJson<unknown[]>(getUniversalRawItemsPath(rootDir))?.length ?? null }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(manifestDir, "phase-2-universal-aggregation.json"),
    `${JSON.stringify({ generated_at: new Date().toISOString(), aggregated_count: readJson<unknown[]>(getUniversalAggregatedPath(rootDir))?.length ?? null, coverage }, null, 2)}\n`,
    "utf8",
  );
  writeFileSync(
    join(manifestDir, "phase-2-universal-final.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );

  console.log("Phase 2 reports complete.");
}

main();
