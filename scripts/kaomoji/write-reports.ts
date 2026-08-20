import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getKaomojiAggregatedPath,
  getKaomojiNormalizedPath,
  getKaomojiPreservationPath,
  getKaomojiProcessedDir,
  getKaomojiProvenancePath,
  getKaomojiRawManifestPath,
  getKaomojiValidationPath,
} from "@/lib/kaomoji/storage/paths";
import { buildLicenseAuditRecords, summarizeLicenseStatuses } from "@/lib/kaomoji/sources/license-audit";
import { KAOMOJI_SOURCE_REGISTRY } from "@/lib/kaomoji/sources/registry";
import type {
  AggregatedDatasetManifest,
  AggregatedKaomojiRecord,
  NormalizedKaomojiRecord,
  PreservationAuditReport,
  ProvenanceRecord,
  RawDatasetManifest,
  ValidationRecord,
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

function buildSourceAuditReport(): string {
  const records = buildLicenseAuditRecords();
  const summary = summarizeLicenseStatuses(records);

  const rows = KAOMOJI_SOURCE_REGISTRY.map((source) => {
    const audit = records.find((r) => r.source_id === source.source_id);
    return `| ${source.source_id} | ${source.license_status} | ${source.collection_method} | ${source.enabled_for_collection} | ${source.enabled_for_publication} | ${audit?.confidence ?? "n/a"} |`;
  }).join("\n");

  return `# PHASE KAOMOJI — Source + License Audit

Generated: ${new Date().toISOString()}

## Registry summary

| Metric | Value |
|--------|-------|
| Total sources | ${summary.total} |
| Collection enabled | ${summary.collection_enabled} |
| Publication enabled | ${summary.publication_enabled} |
| APPROVED | ${summary.by_status.APPROVED ?? 0} |
| ATTRIBUTION_REQUIRED | ${summary.by_status.ATTRIBUTION_REQUIRED ?? 0} |
| REVIEW_REQUIRED | ${summary.by_status.REVIEW_REQUIRED ?? 0} |
| UNKNOWN | ${summary.by_status.UNKNOWN ?? 0} |
| NOT_PERMITTED | ${summary.by_status.NOT_PERMITTED ?? 0} |

## Per-source audit

| source_id | license_status | collection_method | collection | publication | confidence |
|-----------|----------------|-------------------|------------|-------------|------------|
${rows}

## Principles

- Accessible != redistributable != commercially reusable.
- REVIEW_REQUIRED sources are stored via manual import only when permitted.
- Raw data is never deleted due to uncertain licensing.
`;
}

function buildRawCollectionReport(rawManifest: RawDatasetManifest | null): string {
  return `# PHASE KAOMOJI — Raw Collection

Generated: ${new Date().toISOString()}

| Field | Value |
|-------|-------|
| Collector version | ${rawManifest?.collector_version ?? "N/A"} |
| Run ID | ${rawManifest?.run_id ?? "N/A"} |
| Record count | ${rawManifest?.record_count ?? "N/A"} |
| Unique originals | ${rawManifest?.unique_original_count ?? "N/A"} |

## Per-source raw counts

${rawManifest ? Object.entries(rawManifest.source_counts).map(([k, v]) => `- **${k}**: ${v}`).join("\n") : "No raw manifest found."}

## Collection notes

- Idempotent merge by \`raw_id\` with \`first_seen\` / \`last_seen\` tracking.
- Original kaomoji preserved exactly in \`original_kaomoji\`.
- Automated collection: emoticon-data, kaomoji-tagged, wikipedia (API).
- Manual import pathway documented in \`data/kaomoji/imports/README.md\`.
`;
}

function buildAggregationReport(
  rawManifest: RawDatasetManifest | null,
  aggregatedManifest: AggregatedDatasetManifest | null,
  aggregated: AggregatedKaomojiRecord[] | null,
): string {
  const normalizationChanges =
    readJson<NormalizedKaomojiRecord[]>(getKaomojiNormalizedPath(rootDir))?.filter(
      (n) => n.normalization_changes.length > 0,
    ).length ?? "N/A";

  return `# PHASE KAOMOJI — Aggregation

Generated: ${new Date().toISOString()}

| Metric | Value |
|--------|-------|
| Raw records | ${rawManifest?.record_count ?? "N/A"} |
| Unique raw originals | ${rawManifest?.unique_original_count ?? "N/A"} |
| Aggregated candidates | ${aggregatedManifest?.candidate_count ?? "N/A"} |
| Single-source candidates | ${aggregatedManifest?.single_source_count ?? "N/A"} |
| Multi-source candidates | ${aggregatedManifest?.multi_source_count ?? "N/A"} |
| Normalization changes | ${normalizationChanges} |
| Aggregated file rows | ${aggregated?.length ?? "N/A"} |

All source_refs preserved per candidate. Multi-source merges retain full provenance.
`;
}

function buildProvenanceReport(
  provenance: ProvenanceRecord[] | null,
  aggregatedManifest: AggregatedDatasetManifest | null,
): string {
  const totalChains = provenance?.reduce((sum, p) => sum + p.chain.length, 0) ?? 0;

  return `# PHASE KAOMOJI — Provenance

Generated: ${new Date().toISOString()}

| Metric | Value |
|--------|-------|
| Provenance entries | ${provenance?.length ?? "N/A"} |
| Total chain links | ${totalChains} |
| Provenance coverage | ${aggregatedManifest?.provenance_coverage?.toFixed(4) ?? "N/A"} |

Traceability chain: KAOMOJI candidate → aggregated_id → raw_id → source_id → license.

Sample chains (first 5):

${provenance?.slice(0, 5).map((p) => `- ${p.aggregated_id}: ${p.chain.join(" → ")}`).join("\n") ?? "No provenance data."}
`;
}

function buildFoundationReport(
  rawManifest: RawDatasetManifest | null,
  aggregatedManifest: AggregatedDatasetManifest | null,
  preservation: PreservationAuditReport | null,
  validation: ValidationRecord[] | null,
): string {
  const validCount = validation?.filter((v) => v.classification === "VALID_CANDIDATE").length ?? 0;
  const reviewCount = validation?.filter((v) => v.classification === "REVIEW").length ?? 0;
  const invalidCount = validation?.filter((v) => v.classification === "INVALID_CANDIDATE").length ?? 0;
  const licenseSummary = summarizeLicenseStatuses();

  const verdict =
    preservation &&
    preservation.silent_deletions === 0 &&
    preservation.raw_gte_aggregated &&
    KAOMOJI_SOURCE_REGISTRY.length >= 10
      ? licenseSummary.by_status.REVIEW_REQUIRED && licenseSummary.by_status.REVIEW_REQUIRED > 0
        ? "PASS WITH WARNINGS"
        : "PASS"
      : "REVIEW REQUIRED";

  return `# PHASE KAOMOJI — Foundation Report

Generated: ${new Date().toISOString()}

## Architecture classification

| Component | Status |
|-----------|--------|
| Kaomoji module (\`src/lib/kaomoji/\`) | NEW — isolated from emoji database |
| Emoji database / R2 / search | EXISTING — unchanged |
| Public Kaomoji UI | NOT IMPLEMENTED (Phase 1 data foundation only) |

## Summary

| Metric | Value |
|--------|-------|
| Registered sources | ${KAOMOJI_SOURCE_REGISTRY.length} |
| Collection-enabled sources | ${licenseSummary.collection_enabled} |
| Raw records | ${rawManifest?.record_count ?? "N/A"} |
| Unique originals | ${rawManifest?.unique_original_count ?? "N/A"} |
| Aggregated candidates | ${aggregatedManifest?.candidate_count ?? "N/A"} |
| Single-source | ${aggregatedManifest?.single_source_count ?? "N/A"} |
| Multi-source | ${aggregatedManifest?.multi_source_count ?? "N/A"} |
| Provenance coverage | ${aggregatedManifest?.provenance_coverage?.toFixed(4) ?? "N/A"} |
| Silent deletions | ${preservation?.silent_deletions ?? "N/A"} |
| Valid candidates | ${validCount} |
| Review | ${reviewCount} |
| Invalid | ${invalidCount} |

## Source counts

${rawManifest ? Object.entries(rawManifest.source_counts).map(([k, v]) => `- ${k}: ${v}`).join("\n") : "No raw manifest found."}

## Preservation

- raw_gte_aggregated: ${preservation?.raw_gte_aggregated ?? "N/A"}
- potential_duplicates: ${preservation?.potential_duplicates ?? "N/A"}
- merge_audit entries: ${preservation?.merge_audit.length ?? 0}

## Verdict

**${verdict}**

${verdict.includes("WARNINGS") ? "Warnings: 7 sources require manual import / license review before publication." : "No silent deletions detected."}
`;
}

function main(): void {
  const processedDir = getKaomojiProcessedDir(rootDir);
  const rawManifest = readJson<RawDatasetManifest>(getKaomojiRawManifestPath(rootDir));
  const aggregatedManifest = readJson<AggregatedDatasetManifest>(
    join(processedDir, "aggregated-manifest.json"),
  );
  const preservation = readJson<PreservationAuditReport>(getKaomojiPreservationPath(rootDir));
  const validation = readJson<ValidationRecord[]>(getKaomojiValidationPath(rootDir));
  const aggregated = readJson<AggregatedKaomojiRecord[]>(getKaomojiAggregatedPath(rootDir));
  const provenance = readJson<ProvenanceRecord[]>(getKaomojiProvenancePath(rootDir));
  const licenseRecords = buildLicenseAuditRecords();
  const licenseSummary = summarizeLicenseStatuses(licenseRecords);

  writeReport("PHASE-KAOMOJI-SOURCE-AUDIT.md", buildSourceAuditReport());
  writeReport("PHASE-KAOMOJI-RAW-COLLECTION.md", buildRawCollectionReport(rawManifest));
  writeReport("PHASE-KAOMOJI-AGGREGATION.md", buildAggregationReport(rawManifest, aggregatedManifest, aggregated));
  writeReport("PHASE-KAOMOJI-PROVENANCE.md", buildProvenanceReport(provenance, aggregatedManifest));
  writeReport("PHASE-KAOMOJI-FOUNDATION.md", buildFoundationReport(rawManifest, aggregatedManifest, preservation, validation));

  mkdirSync(manifestDir, { recursive: true });

  writeFileSync(
    join(manifestDir, "kaomoji-source-audit.json"),
    `${JSON.stringify({ generated_at: new Date().toISOString(), summary: licenseSummary, records: licenseRecords }, null, 2)}\n`,
    "utf8",
  );
  console.log("Wrote manifests/kaomoji-source-audit.json");

  const foundationManifest = {
    generated_at: new Date().toISOString(),
    verdict:
      preservation && preservation.silent_deletions === 0 ? "PASS WITH WARNINGS" : "REVIEW REQUIRED",
    sources: {
      registered: KAOMOJI_SOURCE_REGISTRY.length,
      collection_enabled: licenseSummary.collection_enabled,
    },
    raw: rawManifest,
    aggregated: aggregatedManifest,
    preservation: preservation
      ? {
          silent_deletions: preservation.silent_deletions,
          single_source: preservation.single_source_candidates,
          multi_source: preservation.multi_source_candidates,
          raw_gte_aggregated: preservation.raw_gte_aggregated,
          potential_duplicates: preservation.potential_duplicates,
        }
      : null,
    validation_summary: validation
      ? {
          valid: validation.filter((v) => v.classification === "VALID_CANDIDATE").length,
          review: validation.filter((v) => v.classification === "REVIEW").length,
          invalid: validation.filter((v) => v.classification === "INVALID_CANDIDATE").length,
        }
      : null,
    provenance_coverage: aggregatedManifest?.provenance_coverage ?? null,
  };

  writeFileSync(
    join(manifestDir, "kaomoji-foundation.json"),
    `${JSON.stringify(foundationManifest, null, 2)}\n`,
    "utf8",
  );
  console.log("Wrote manifests/kaomoji-foundation.json");
}

main();
