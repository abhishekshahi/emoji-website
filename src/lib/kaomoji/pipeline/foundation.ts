import { mkdirSync, writeFileSync } from "node:fs";
import { aggregateRawRecords } from "../aggregate/aggregate";
import { runPreservationAudit } from "../audit/preservation";
import { runCollection } from "../collection/collector";
import { classifyAggregatedRecords } from "../classify/classify";
import { normalizeKaomoji } from "../normalize/normalize";
import { buildProvenanceGraph } from "../provenance/graph";
import { buildLicenseAuditRecords, summarizeLicenseStatuses } from "../sources/license-audit";
import {
  getKaomojiAggregatedPath,
  getKaomojiNormalizedPath,
  getKaomojiPreservationPath,
  getKaomojiProcessedDir,
  getKaomojiProvenancePath,
  getKaomojiValidationPath,
} from "../storage/paths";
import type {
  AggregatedDatasetManifest,
  NormalizedKaomojiRecord,
  PreservationAuditReport,
} from "../types";

export interface FoundationPipelineResult {
  readonly raw_count: number;
  readonly aggregated_count: number;
  readonly normalized_count: number;
  readonly validation_count: number;
  readonly provenance_count: number;
  readonly preservation: PreservationAuditReport;
  readonly license_summary: ReturnType<typeof summarizeLicenseStatuses>;
}

/** Run the full Kaomoji Phase 1 foundation pipeline. */
export async function runKaomojiFoundationPipeline(
  rootDir: string,
  options: { fetchFn?: typeof fetch } = {},
): Promise<FoundationPipelineResult> {
  const fetchFn = options.fetchFn ?? fetch;

  const { records: rawRecords } = await runCollection(rootDir, { fetchFn });

  const aggregated = aggregateRawRecords(rawRecords);

  const normalized: NormalizedKaomojiRecord[] = aggregated.map((record) => {
    const primaryForm = record.original_forms[0] ?? record.candidate_key;
    const result = normalizeKaomoji(primaryForm);
    return {
      aggregated_id: record.aggregated_id,
      original_kaomoji: result.original_kaomoji,
      normalized_kaomoji: result.normalized_kaomoji,
      normalization_version: result.normalization_version,
      normalization_method: result.normalization_method,
      normalization_changes: result.normalization_changes,
      normalization_warnings: result.normalization_warnings,
    };
  });

  const validation = classifyAggregatedRecords(aggregated);
  const provenance = buildProvenanceGraph(aggregated);
  const preservation = runPreservationAudit(rawRecords, aggregated);

  const processedDir = getKaomojiProcessedDir(rootDir);
  mkdirSync(processedDir, { recursive: true });

  writeFileSync(getKaomojiAggregatedPath(rootDir), `${JSON.stringify(aggregated, null, 2)}\n`, "utf8");
  writeFileSync(getKaomojiNormalizedPath(rootDir), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  writeFileSync(getKaomojiValidationPath(rootDir), `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  writeFileSync(getKaomojiProvenancePath(rootDir), `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
  writeFileSync(getKaomojiPreservationPath(rootDir), `${JSON.stringify(preservation, null, 2)}\n`, "utf8");

  const licenseRecords = buildLicenseAuditRecords();
  writeFileSync(
    `${processedDir}/license-audit.json`,
    `${JSON.stringify(licenseRecords, null, 2)}\n`,
    "utf8",
  );

  const aggregatedManifest: AggregatedDatasetManifest = {
    generated_at: new Date().toISOString(),
    candidate_count: aggregated.length,
    single_source_count: preservation.single_source_candidates,
    multi_source_count: preservation.multi_source_candidates,
    raw_record_count: rawRecords.length,
    provenance_coverage:
      rawRecords.length > 0
        ? provenance.reduce((sum, p) => sum + p.raw_ids.length, 0) / rawRecords.length
        : 0,
  };
  writeFileSync(
    `${processedDir}/aggregated-manifest.json`,
    `${JSON.stringify(aggregatedManifest, null, 2)}\n`,
    "utf8",
  );

  return {
    raw_count: rawRecords.length,
    aggregated_count: aggregated.length,
    normalized_count: normalized.length,
    validation_count: validation.length,
    provenance_count: provenance.length,
    preservation,
    license_summary: summarizeLicenseStatuses(licenseRecords),
  };
}
