import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { runNoLossAudit } from "../universal/loss-audit";
import { buildAllSourceReports } from "../collection/all-sources";
import { runCollection } from "../collection/collector";
import { buildSourceCoverageMatrix } from "../coverage/matrix";
import { analyzeDeduplication, applyDedupClasses } from "../dedup/analyze";
import { runKaomojiFoundationPipeline } from "./foundation";
import { kaomojiRecordsToSourceItems } from "../universal/adapter";
import { aggregateSourceItems } from "../universal/aggregate";
import { normalizeSourceItems } from "../universal/normalize";
import { buildUniversalProvenanceGraph, computeProvenanceCoverage } from "../universal/provenance";
import { validateAggregatedItems } from "../universal/validate";
import { summarizeLicenseStatuses } from "../sources/license-audit";
import {
  COLLECTOR_VERSION,
  getDedupAnalysisPath,
  getKaomojiRawRecordsPath,
  getKaomojiUniversalDir,
  getNoLossReconciliationPath,
  getPhase2ManifestPath,
  getSourceCollectionReportsPath,
  getSourceCoveragePath,
  getUniversalAggregatedPath,
  getUniversalNormalizedPath,
  getUniversalProvenancePath,
  getUniversalRawItemsPath,
  getUniversalValidationPath,
  PIPELINE_VERSION,
} from "../storage/paths";
import type { Phase2UniversalManifest, RawKaomojiRecord } from "../types";

export interface Phase2PipelineResult {
  readonly manifest: Phase2UniversalManifest;
}

function loadExistingRaw(rootDir: string): RawKaomojiRecord[] {
  const path = getKaomojiRawRecordsPath(rootDir);
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, "utf8")) as RawKaomojiRecord[];
}

/** Run Phase 2 universal pipeline extending Phase 1 foundation. */
export async function runPhase2UniversalPipeline(
  rootDir: string,
  options: { fetchFn?: typeof fetch; skipNetworkCollection?: boolean } = {},
): Promise<Phase2PipelineResult> {
  const started = Date.now();
  const warnings: string[] = [];
  const errors: string[] = [];

  const collectionStart = Date.now();
  if (!options.skipNetworkCollection) {
    await runCollection(rootDir, { fetchFn: options.fetchFn });
  }
  await runKaomojiFoundationPipeline(rootDir, {
    fetchFn: options.skipNetworkCollection
      ? async () => new Response("{}", { status: 404 })
      : options.fetchFn,
  });
  const collectionMs = Date.now() - collectionStart;

  const rawKaomoji = loadExistingRaw(rootDir);
  const rawItems = kaomojiRecordsToSourceItems(rawKaomoji);

  const aggregationStart = Date.now();
  let aggregated = aggregateSourceItems(rawItems);
  const aggregationMs = Date.now() - aggregationStart;

  const normalizationStart = Date.now();
  const normalized = normalizeSourceItems(aggregated);
  const normalizationMs = Date.now() - normalizationStart;

  const dedupStart = Date.now();
  const dedupReport = analyzeDeduplication(aggregated);
  aggregated = applyDedupClasses(aggregated, dedupReport);
  const dedupMs = Date.now() - dedupStart;

  const validation = validateAggregatedItems(aggregated);
  const provenance = buildUniversalProvenanceGraph(aggregated);
  const sourceReports = buildAllSourceReports(rootDir, rawKaomoji, rawItems);
  const sourceCoverage = buildSourceCoverageMatrix(rawItems, aggregated, validation);
  const noLoss = runNoLossAudit({
    rawItems,
    aggregated,
    normalized,
    validation,
    provenance,
    dedup: dedupReport,
  });

  const provenanceCoverage = computeProvenanceCoverage(rawItems.length, provenance);
  const licenseSummary = summarizeLicenseStatuses();

  for (const report of sourceReports) {
    if (report.collection_status === "manual_required") {
      warnings.push(`${report.source_id}: manual import / license review required`);
    }
    errors.push(...report.errors);
  }

  if (noLoss.silent_deletions > 0) {
    errors.push(`silent_deletions detected: ${noLoss.silent_deletions}`);
  }

  const universalDir = getKaomojiUniversalDir(rootDir);
  mkdirSync(universalDir, { recursive: true });

  writeFileSync(getUniversalRawItemsPath(rootDir), `${JSON.stringify(rawItems, null, 2)}\n`, "utf8");
  writeFileSync(getUniversalAggregatedPath(rootDir), `${JSON.stringify(aggregated, null, 2)}\n`, "utf8");
  writeFileSync(getUniversalNormalizedPath(rootDir), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  writeFileSync(getUniversalProvenancePath(rootDir), `${JSON.stringify(provenance, null, 2)}\n`, "utf8");
  writeFileSync(getUniversalValidationPath(rootDir), `${JSON.stringify(validation, null, 2)}\n`, "utf8");
  writeFileSync(getSourceCollectionReportsPath(rootDir), `${JSON.stringify(sourceReports, null, 2)}\n`, "utf8");
  writeFileSync(getDedupAnalysisPath(rootDir), `${JSON.stringify(dedupReport, null, 2)}\n`, "utf8");
  writeFileSync(getNoLossReconciliationPath(rootDir), `${JSON.stringify(noLoss, null, 2)}\n`, "utf8");
  writeFileSync(getSourceCoveragePath(rootDir), `${JSON.stringify(sourceCoverage, null, 2)}\n`, "utf8");

  const totalMs = Date.now() - started;

  const manifest: Phase2UniversalManifest = {
    phase: 2,
    timestamp: new Date().toISOString(),
    pipeline_version: PIPELINE_VERSION,
    collector_version: COLLECTOR_VERSION,
    source_reports: sourceReports,
    raw_item_count: rawItems.length,
    raw_kaomoji_count: rawKaomoji.length,
    aggregated_item_count: aggregated.length,
    normalized_item_count: normalized.length,
    dedup: dedupReport,
    no_loss: noLoss,
    source_coverage: sourceCoverage,
    validation_summary: {
      valid: validation.filter((v) => v.classification === "VALID").length,
      review: validation.filter((v) => v.classification === "REVIEW").length,
      invalid: validation.filter((v) => v.classification === "INVALID").length,
    },
    license_summary: licenseSummary.by_status,
    provenance_coverage: provenanceCoverage,
    performance_ms: {
      collection: collectionMs,
      aggregation: aggregationMs,
      normalization: normalizationMs,
      deduplication: dedupMs,
      total: totalMs,
    },
    warnings,
    errors,
  };

  writeFileSync(getPhase2ManifestPath(rootDir), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  return { manifest };
}
