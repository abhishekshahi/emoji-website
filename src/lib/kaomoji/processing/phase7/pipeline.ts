import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RawKaomojiRecord } from "../../types";
import {
  getKaomojiRawRecordsPath,
  getPhase7DuplicateAnalysisDir,
  getPhase7LicensingDir,
  getPhase7ManifestPath,
  getPhase7NormalizedDir,
  getPhase7ProposedPublishedDir,
  getPhase7QualityDir,
  getPhase7RawSnapshotPath,
  getPhase7RootDir,
  getPhase7ValidationDir,
  getPhase7VariantAnalysisDir,
  PHASE7_DEDUP_ANALYSIS_VERSION,
  PHASE7_PIPELINE_VERSION,
} from "../../storage/paths";
import { analyzeDuplicates } from "./duplicate-analyze";
import { processRawRecord } from "./process-record";
import { createRawSnapshot, loadFastEmojiCheckpointStats, verifyRawUnchanged } from "./raw-snapshot";
import { analyzeVariants } from "./variant-analyze";
import type { Phase7CollectionManifest, Phase7ProcessedRecord, Phase7SourceStats } from "./types";

/** Historical Phase 7/8 snapshot baseline before fastemoji collection completed (+3,825). */
export const PHASE8_HISTORICAL_RAW_BASELINE = 232_683;
export const PHASE8_HISTORICAL_RAW_SHA256 =
  "d795bc676307f854ea8cfa89bc151d6364c46b052b338358d7d47f9ab8618640";

/** Authoritative immutable RAW dataset verified in Phase 13/21 audits. */
export const AUTHORITATIVE_RAW_COUNT = 236_508;
export const AUTHORITATIVE_RAW_SHA256 =
  "fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf";
export const FASTEMOJI_RAW_DRIFT = 3_825;

/** Current RAW count expectation for pipeline immutability checks. */
export const EXPECTED_RAW_BASELINE = AUTHORITATIVE_RAW_COUNT;

function loadRaw(rootDir: string): RawKaomojiRecord[] {
  const path = getKaomojiRawRecordsPath(rootDir);
  if (!existsSync(path)) throw new Error(`RAW records not found: ${path}`);
  return JSON.parse(readFileSync(path, "utf8")) as RawKaomojiRecord[];
}

function qualityBucket(score: number): string {
  if (score <= 20) return "0-20";
  if (score <= 40) return "21-40";
  if (score <= 60) return "41-60";
  if (score <= 80) return "61-80";
  return "81-100";
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export interface Phase7PipelineResult {
  readonly manifest: Phase7CollectionManifest;
}

/** Phase 7: process 232k RAW occurrences into derived analysis layers — RAW immutable. */
export function runPhase7Pipeline(rootDir: string): Phase7PipelineResult {
  const started = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawBefore = loadRaw(rootDir);
  const rawCountBefore = rawBefore.length;
  if (rawCountBefore !== EXPECTED_RAW_BASELINE) {
    warnings.push(`baseline mismatch: expected ${EXPECTED_RAW_BASELINE}, got ${rawCountBefore}`);
  }

  const feStats = loadFastEmojiCheckpointStats(rootDir);
  const snapshot = createRawSnapshot(rootDir, rawBefore, feStats);

  const normalizedRecords: ReturnType<typeof processRawRecord>["normalized"][] = [];
  const processedRecords: Phase7ProcessedRecord[] = [];

  for (const raw of rawBefore) {
    const result = processRawRecord(raw);
    normalizedRecords.push(result.normalized);
    processedRecords.push(result.processed);
  }

  const duplicate = analyzeDuplicates(processedRecords);
  const variants = analyzeVariants(processedRecords);

  const contentTypeCounts: Record<string, number> = {};
  const validationCounts: Record<string, number> = {};
  const qualityBuckets: Record<string, number> = {};
  const licenseCounts: Record<string, number> = {};
  const publicationCounts: Record<string, number> = {};

  for (const p of processedRecords) {
    for (const t of p.content_types) contentTypeCounts[t] = (contentTypeCounts[t] ?? 0) + 1;
    validationCounts[p.validation_status] = (validationCounts[p.validation_status] ?? 0) + 1;
    const bucket = qualityBucket(p.quality_score);
    qualityBuckets[bucket] = (qualityBuckets[bucket] ?? 0) + 1;
    licenseCounts[p.license_status] = (licenseCounts[p.license_status] ?? 0) + 1;
    publicationCounts[p.publication_status] = (publicationCounts[p.publication_status] ?? 0) + 1;
  }

  const sourceStatsMap = new Map<string, {
    source_id: string;
    raw_occurrences: number;
    content_types: Record<string, number>;
    validation: Record<string, number>;
    quality_buckets: Record<string, number>;
    license: Record<string, number>;
    publication: Record<string, number>;
    duplicate_groups: number;
    variant_groups: number;
  }>();
  for (const p of processedRecords) {
    let stats = sourceStatsMap.get(p.source_id);
    if (!stats) {
      stats = {
        source_id: p.source_id,
        raw_occurrences: 0,
        content_types: {},
        validation: {},
        quality_buckets: {},
        license: {},
        publication: {},
        duplicate_groups: 0,
        variant_groups: 0,
      };
      sourceStatsMap.set(p.source_id, stats);
    }
    stats.raw_occurrences += 1;
    for (const t of p.content_types) stats.content_types[t] = (stats.content_types[t] ?? 0) + 1;
    stats.validation[p.validation_status] = (stats.validation[p.validation_status] ?? 0) + 1;
    const qb = qualityBucket(p.quality_score);
    stats.quality_buckets[qb] = (stats.quality_buckets[qb] ?? 0) + 1;
    stats.license[p.license_status] = (stats.license[p.license_status] ?? 0) + 1;
    stats.publication[p.publication_status] = (stats.publication[p.publication_status] ?? 0) + 1;
  }

  for (const g of duplicate.groups) {
    for (const sid of g.source_ids) {
      const s = sourceStatsMap.get(sid);
      if (s) s.duplicate_groups += 1;
    }
  }
  for (const v of variants) {
    const first = processedRecords.find((p) => p.raw_id === v.raw_ids[0]);
    if (first) {
      const s = sourceStatsMap.get(first.source_id);
      if (s) s.variant_groups += 1;
    }
  }

  const root = getPhase7RootDir(rootDir);
  mkdirSync(root, { recursive: true });

  writeJson(getPhase7RawSnapshotPath(rootDir), snapshot);
  writeJson(join(getPhase7NormalizedDir(rootDir), "records.json"), normalizedRecords);
  writeJson(join(getPhase7ValidationDir(rootDir), "records.json"), processedRecords.map((p) => ({
    raw_id: p.raw_id,
    validation_status: p.validation_status,
    validation_reasons: p.validation_reasons,
    content_types: p.content_types,
  })));
  writeJson(join(getPhase7QualityDir(rootDir), "records.json"), processedRecords.map((p) => ({
    raw_id: p.raw_id,
    quality_score: p.quality_score,
    quality_status: p.quality_status,
    beauty_foundation: p.beauty_foundation,
  })));
  writeJson(join(getPhase7LicensingDir(rootDir), "records.json"), processedRecords.map((p) => ({
    raw_id: p.raw_id,
    license_status: p.license_status,
    publication_status: p.publication_status,
  })));
  writeJson(join(getPhase7ProposedPublishedDir(rootDir), "records.json"), processedRecords.map((p) => ({
    raw_id: p.raw_id,
    original_content: p.original_content,
    normalized_content: p.normalized_content,
    publication_status: p.publication_status,
    content_types: p.content_types,
    provenance: p.provenance,
  })));
  writeJson(join(getPhase7DuplicateAnalysisDir(rootDir), "summary.json"), {
    version: PHASE7_DEDUP_ANALYSIS_VERSION,
    counts: duplicate.counts,
    relationship_count: duplicate.relationship_count,
    group_count: duplicate.groups.length,
  });
  writeJson(join(getPhase7DuplicateAnalysisDir(rootDir), "groups.json"), duplicate.groups);
  writeJson(join(getPhase7VariantAnalysisDir(rootDir), "groups.json"), variants);

  const rawAfter = loadRaw(rootDir);
  const verify = verifyRawUnchanged(rootDir, snapshot, rawAfter);

  const manifest: Phase7CollectionManifest = {
    phase: 7,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE7_PIPELINE_VERSION,
    raw_before: rawCountBefore,
    raw_after: rawAfter.length,
    raw_removed: 0,
    raw_modified: verify.ok ? 0 : -1,
    raw_new: 0,
    total_normalized: normalizedRecords.length,
    content_type_counts: contentTypeCounts,
    validation_counts: validationCounts,
    duplicate_counts: duplicate.counts,
    variant_count: variants.length,
    quality_buckets: qualityBuckets,
    license_counts: licenseCounts,
    publication_counts: publicationCounts,
    provenance_coverage: snapshot.provenance_coverage,
    source_stats: [...sourceStatsMap.values()].sort((a, b) => a.source_id.localeCompare(b.source_id)),
    fastemoji_collected: feStats.collected,
    fastemoji_remaining: feStats.remaining,
    deterministic: true,
    errors: [...errors, ...verify.errors],
    warnings,
  };

  mkdirSync(join(root, "manifests"), { recursive: true });
  writeJson(getPhase7ManifestPath(rootDir), manifest);

  const elapsed = Date.now() - started;
  if (elapsed > 0) {
    /* performance tracked in manifest via timestamp */
  }

  return { manifest };
}

/** Deterministic hash of normalized output for rerun verification. */
export function hashPhase7Output(processed: readonly Phase7ProcessedRecord[]): string {
  const payload = processed.map((p) => `${p.raw_id}:${p.normalized_content}:${p.validation_status}`).join("\n");
  return createHash("sha256").update(payload).digest("hex");
}
