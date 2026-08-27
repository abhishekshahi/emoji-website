import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RawKaomojiRecord } from "../../types";
import {
  getKaomojiRawRecordsPath,
  getPhase7DuplicateAnalysisDir,
  getPhase7NormalizedDir,
  getPhase7QualityDir,
  getPhase7RawSnapshotPath,
  getPhase7ValidationDir,
  getPhase7VariantAnalysisDir,
  getPhase7LicensingDir,
  getPhase8ManifestPath,
  getPhase8ProposedLibraryDir,
  getPhase8RootDir,
  PHASE8_PIPELINE_VERSION,
} from "../../storage/paths";
import {
  AUTHORITATIVE_RAW_COUNT,
  AUTHORITATIVE_RAW_SHA256,
  EXPECTED_RAW_BASELINE,
  FASTEMOJI_RAW_DRIFT,
  PHASE8_HISTORICAL_RAW_BASELINE,
  PHASE8_HISTORICAL_RAW_SHA256,
} from "../phase7/pipeline";
import { hashRawFile } from "../phase7/raw-snapshot";
import { buildCanonicalLibrary } from "./canonical-build";
import { explainProvenanceDiscrepancy, repairProvenance } from "./provenance-repair";
import type {
  CanonicalRecord,
  CurationStatus,
  Phase8Manifest,
  ProvenanceStatus,
  QualityTier,
  RepairedProvenance,
} from "./types";

export {
  AUTHORITATIVE_RAW_COUNT,
  AUTHORITATIVE_RAW_SHA256,
  EXPECTED_RAW_BASELINE,
  FASTEMOJI_RAW_DRIFT,
  PHASE8_HISTORICAL_RAW_BASELINE,
  PHASE8_HISTORICAL_RAW_SHA256,
};

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function loadRaw(rootDir: string): RawKaomojiRecord[] {
  return JSON.parse(readFileSync(getKaomojiRawRecordsPath(rootDir), "utf8")) as RawKaomojiRecord[];
}

export interface Phase8PipelineResult {
  readonly manifest: Phase8Manifest;
}

export function runPhase8Pipeline(rootDir: string): Phase8PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const rawBefore = loadRaw(rootDir);
  const rawShaBefore = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;

  let phase7Sha: string | null = null;
  const p7Snap = getPhase7RawSnapshotPath(rootDir);
  if (existsSync(p7Snap)) {
    phase7Sha = (JSON.parse(readFileSync(p7Snap, "utf8")) as { file_sha256: string }).file_sha256;
    if (phase7Sha !== rawShaBefore) warnings.push("RAW sha256 differs from Phase 7 snapshot — RAW unchanged since Phase 7");
  }

  const normalized = JSON.parse(readFileSync(join(getPhase7NormalizedDir(rootDir), "records.json"), "utf8")) as Array<{
    raw_id: string;
    normalized_content: string;
  }>;
  const validation = JSON.parse(readFileSync(join(getPhase7ValidationDir(rootDir), "records.json"), "utf8")) as Array<{
    raw_id: string;
    validation_status: string;
    validation_reasons: string[];
    content_types: string[];
  }>;
  const quality = JSON.parse(readFileSync(join(getPhase7QualityDir(rootDir), "records.json"), "utf8")) as Array<{
    raw_id: string;
    quality_score: number;
    quality_status: string;
  }>;
  const licensing = JSON.parse(readFileSync(join(getPhase7LicensingDir(rootDir), "records.json"), "utf8")) as Array<{
    raw_id: string;
    license_status: import("../../types").LicenseStatus;
    publication_status: string;
  }>;

  const normalizedByRawId = new Map(normalized.map((n) => [n.raw_id, n.normalized_content]));
  const qualityByRawId = new Map(quality.map((q) => [q.raw_id, q]));
  const licensingByRawId = new Map(licensing.map((l) => [l.raw_id, l]));
  const metaByRawId = new Map(
    validation.map((v) => {
      const q = qualityByRawId.get(v.raw_id);
      const l = licensingByRawId.get(v.raw_id);
      return [
        v.raw_id,
        {
          validation_status: v.validation_status,
          validation_reasons: v.validation_reasons,
          content_types: v.content_types,
          quality_score:
            typeof q?.quality_score === "number" && Number.isFinite(q.quality_score) ? q.quality_score : 0,
          quality_status: q?.quality_status ?? "REVIEW",
          license_status: l?.license_status ?? "UNKNOWN",
          publication_status: l?.publication_status ?? "REVIEW_REQUIRED",
        },
      ];
    }),
  );

  const repairedRecords: RepairedProvenance[] = [];
  const repairedByRawId = new Map<string, RepairedProvenance>();
  const provCounts: Record<ProvenanceStatus, number> = {
    COMPLETE: 0,
    PARTIAL: 0,
    MISSING: 0,
    CONFLICTING: 0,
    PROVENANCE_UNRESOLVED: 0,
  };
  for (const raw of rawBefore) {
    const r = repairProvenance(raw);
    repairedRecords.push(r);
    repairedByRawId.set(raw.raw_id, r);
    provCounts[r.status] += 1;
  }

  const variantGroups = JSON.parse(
    readFileSync(join(getPhase7VariantAnalysisDir(rootDir), "groups.json"), "utf8"),
  ) as Array<{ variant_group_id: string; variant_type: string; raw_ids: string[] }>;
  const variantGroupByRawId = new Map<string, { group_id: string; variant_type: string }>();
  for (const vg of variantGroups) {
    for (const rid of vg.raw_ids) {
      variantGroupByRawId.set(rid, { group_id: vg.variant_group_id, variant_type: vg.variant_type });
    }
  }

  const dupGroups = JSON.parse(
    readFileSync(join(getPhase7DuplicateAnalysisDir(rootDir), "groups.json"), "utf8"),
  ) as Array<{ kind: string; raw_ids: string[] }>;
  const nearDuplicateRawIds = new Set<string>();
  for (const g of dupGroups) {
    if (g.kind === "NEAR_DUPLICATE") {
      for (const id of g.raw_ids) nearDuplicateRawIds.add(id);
    }
  }

  const { canonicalRecords, rawToCanonical, duplicateGroups } = buildCanonicalLibrary({
    rawRecords: rawBefore,
    normalizedByRawId,
    metaByRawId,
    repairedByRawId,
    variantGroupByRawId,
    nearDuplicateRawIds,
  });

  const rawAfter = loadRaw(rootDir);
  const rawShaAfter = hashRawFile(getKaomojiRawRecordsPath(rootDir)).sha256;

  const unmapped = rawBefore.filter((r) => !rawToCanonical.has(r.raw_id)).map((r) => r.raw_id);
  if (unmapped.length) errors.push(`unmapped raw_ids: ${unmapped.length}`);

  const qualityCounts: Record<QualityTier, number> = { HIGH: 0, GOOD: 0, MEDIUM: 0, LOW: 0, REVIEW: 0 };
  const curationCounts: Record<CurationStatus, number> = { KEEP_CANDIDATE: 0, REVIEW: 0, REMOVE_CANDIDATE: 0 };
  const licenseCounts: Record<string, number> = {};
  const publicationCounts: Record<string, number> = {};

  let exactOccurrences = 0;
  for (const c of canonicalRecords) {
    qualityCounts[c.quality_status] += 1;
    curationCounts[c.curation_status] += 1;
    licenseCounts[c.license_status] = (licenseCounts[c.license_status] ?? 0) + 1;
    publicationCounts[c.publication_status] = (publicationCounts[c.publication_status] ?? 0) + 1;
    if (c.created_from_raw_ids.length > 1) exactOccurrences += c.created_from_raw_ids.length;
  }

  const uniqueRecords = canonicalRecords.filter((c) => c.created_from_raw_ids.length === 1);
  const uniqueLegitimate = uniqueRecords.filter((c) => c.curation_status === "KEEP_CANDIDATE").length;
  const uniqueReview = uniqueRecords.filter((c) => c.curation_status === "REVIEW").length;
  const uniqueRemove = uniqueRecords.filter((c) => c.curation_status === "REMOVE_CANDIDATE").length;

  const reviewRecords = canonicalRecords.filter((c) => c.curation_status === "REVIEW");
  const removeCandidates = canonicalRecords.filter((c) => c.curation_status === "REMOVE_CANDIDATE");

  const libDir = getPhase8ProposedLibraryDir(rootDir);
  mkdirSync(libDir, { recursive: true });

  writeJson(join(libDir, "canonical-records.json"), canonicalRecords);
  writeJson(
    join(libDir, "source-occurrences.json"),
    canonicalRecords.flatMap((c) =>
      c.source_occurrences.map((o) => ({ ...o, canonical_id: c.canonical_id })),
    ),
  );
  writeJson(join(libDir, "duplicate-groups.json"), duplicateGroups);
  writeJson(join(libDir, "variant-groups.json"), variantGroups);
  writeJson(join(libDir, "review-records.json"), reviewRecords);
  writeJson(join(libDir, "remove-candidates.json"), removeCandidates);
  writeJson(join(libDir, "license-gate.json"), canonicalRecords.map((c) => ({
    canonical_id: c.canonical_id,
    license_status: c.license_status,
    publication_status: c.publication_status,
  })));
  writeJson(join(libDir, "provenance-audit.json"), {
    repaired: repairedRecords,
    stats: provCounts,
    explanation: explainProvenanceDiscrepancy(provCounts, rawBefore.length),
  });

  writeJson(join(libDir, "raw-to-canonical-map.json"), Object.fromEntries(rawToCanonical));

  const manifest: Phase8Manifest = {
    phase: 8,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE8_PIPELINE_VERSION,
    raw_before: rawBefore.length,
    raw_after: rawAfter.length,
    raw_removed: 0,
    raw_modified: rawShaBefore !== rawShaAfter ? -1 : 0,
    raw_sha256_before: rawShaBefore,
    raw_sha256_after: rawShaAfter,
    phase7_sha256: phase7Sha,
    total_normalized: normalized.length,
    canonical_candidates: canonicalRecords.length,
    exact_groups: duplicateGroups.length,
    exact_occurrences: exactOccurrences,
    variant_groups: variantGroups.length,
    legitimate_variants: variantGroups.filter((v) => v.variant_type !== "category_context").length,
    review_variants: variantGroups.length,
    unique_records: uniqueRecords.length,
    unique_legitimate: uniqueLegitimate,
    unique_review: uniqueReview,
    unique_remove_candidates: uniqueRemove,
    provenance: provCounts,
    provenance_repair_explanation: explainProvenanceDiscrepancy(provCounts, rawBefore.length),
    quality: qualityCounts,
    license: licenseCounts,
    curation: curationCounts,
    publication: publicationCounts,
    no_loss: {
      all_raw_mapped: unmapped.length === 0,
      mapped_count: rawToCanonical.size,
      unmapped_raw_ids: unmapped.slice(0, 100),
    },
    deterministic: true,
    errors,
    warnings,
  };

  mkdirSync(join(getPhase8RootDir(rootDir), "manifests"), { recursive: true });
  writeJson(getPhase8ManifestPath(rootDir), manifest);

  return { manifest };
}

export function hashCanonicalOutput(records: readonly CanonicalRecord[]): string {
  const payload = records.map((c) => `${c.canonical_id}:${c.representative_raw_id}:${c.curation_status}`).join("\n");
  return createHash("sha256").update(payload).digest("hex");
}
