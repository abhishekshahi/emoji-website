import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalRecord } from "../phase8/types";
import type { KaomojiEditorialRecord } from "../phase9/types";
import type { Phase10ScoredRecord, QualityBucket } from "../phase10/types";
import { hashRawFile } from "../phase7/raw-snapshot";
import { buildCollections } from "../phase9/collections";
import { buildRelationships } from "../phase9/relationships";
import { buildSearchIndex } from "../phase9/search-index";
import { buildRankings } from "../phase10/rankings";
import {
  getCurationResolutionsPath,
  getKaomojiRawRecordsPath,
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase10RootDir,
  getPhase12ManifestPath,
  getPhase12PublicQualityDir,
  PHASE12_PIPELINE_VERSION,
} from "../../storage/paths";
import { evaluatePublicationGate, isQualityEligible } from "./publication-filter";
import { measurePublicLibraryStorage } from "./storage-measure";
import type { CurationResolution, ExcludedRecord, Phase12Manifest, PublicLibraryRecord } from "./types";

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function sha256File(path: string): string {
  return hashRawFile(path).sha256;
}

function loadCurationResolutions(rootDir: string): Map<string, CurationResolution> {
  const path = getCurationResolutionsPath(rootDir);
  if (!existsSync(path)) return new Map();
  const rows = JSON.parse(readFileSync(path, "utf8")) as CurationResolution[];
  return new Map(rows.map((r) => [r.canonical_id, r]));
}

function applyCurationResolution(c: CanonicalRecord, resolution: CurationResolution): CanonicalRecord {
  return {
    ...c,
    curation_status: resolution.resolved_curation_status,
    license_status: resolution.resolved_license_status as CanonicalRecord["license_status"],
    publication_status: resolution.resolved_publication_status as CanonicalRecord["publication_status"],
  };
}

function applyEditorialResolution(ed: KaomojiEditorialRecord, resolution: CurationResolution): KaomojiEditorialRecord {
  return {
    ...ed,
    is_public: true,
    curation_status: resolution.resolved_curation_status,
    license_status: resolution.resolved_license_status as KaomojiEditorialRecord["license_status"],
    publication_status: resolution.resolved_publication_status as KaomojiEditorialRecord["publication_status"],
  };
}

export interface Phase12PipelineResult {
  readonly manifest: Phase12Manifest;
}

export function runPhase12Pipeline(rootDir: string): Phase12PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawShaBefore = sha256File(rawPath);
  const rawBefore = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];

  const p8Sha = sha256File(join(getPhase8ProposedLibraryDir(rootDir), "canonical-records.json"));
  const p9Sha = sha256File(join(getPhase9EditorialDir(rootDir), "editorial-records.json"));
  const p10Sha = sha256File(join(getPhase10RootDir(rootDir), "scored-records.json"));

  const canonical = JSON.parse(readFileSync(join(getPhase8ProposedLibraryDir(rootDir), "canonical-records.json"), "utf8")) as CanonicalRecord[];
  const dupGroups = JSON.parse(readFileSync(join(getPhase8ProposedLibraryDir(rootDir), "duplicate-groups.json"), "utf8")) as unknown[];
  const variantGroups = JSON.parse(readFileSync(join(getPhase8ProposedLibraryDir(rootDir), "variant-groups.json"), "utf8")) as Array<{ variant_type: string }>;
  const editorial = JSON.parse(readFileSync(join(getPhase9EditorialDir(rootDir), "editorial-records.json"), "utf8")) as KaomojiEditorialRecord[];
  const scored = JSON.parse(readFileSync(join(getPhase10RootDir(rootDir), "scored-records.json"), "utf8")) as Phase10ScoredRecord[];

  const editorialById = new Map(editorial.map((e) => [e.canonical_id, e]));
  const scoredById = new Map(scored.map((s) => [s.canonical_id, s]));
  const resolutions = loadCurationResolutions(rootDir);

  if (canonical.length !== 63248) warnings.push(`canonical count ${canonical.length} != 63248`);
  if (canonical.length !== editorial.length || canonical.length !== scored.length) {
    errors.push(`layer mismatch canonical=${canonical.length} editorial=${editorial.length} scored=${scored.length}`);
  }

  const qualityBuckets: Record<QualityBucket, number> = {
    EXCELLENT: 0, HIGH: 0, GOOD: 0, MEDIUM: 0, LOW: 0, INVALID_REVIEW: 0,
  };
  const gates: ReturnType<typeof evaluatePublicationGate>[] = [];
  const publicRecords: PublicLibraryRecord[] = [];
  const excluded: ExcludedRecord[] = [];
  const excellentIds: string[] = [];
  const highIds: string[] = [];
  const goodIds: string[] = [];
  const mediumIds: string[] = [];

  for (const c of canonical) {
    const ed = editorialById.get(c.canonical_id);
    const sc = scoredById.get(c.canonical_id);
    if (!ed || !sc) { errors.push(`missing layer: ${c.canonical_id}`); continue; }
    qualityBuckets[sc.quality_bucket] += 1;
    const resolution = resolutions.get(c.canonical_id);
    const gateCanonical = resolution ? applyCurationResolution(c, resolution) : c;
    const gate = evaluatePublicationGate(gateCanonical, sc);
    gates.push(gate);

    if (isQualityEligible(sc.quality_bucket)) {
      if (sc.quality_bucket === "EXCELLENT") excellentIds.push(c.canonical_id);
      else if (sc.quality_bucket === "HIGH") highIds.push(c.canonical_id);
      else if (sc.quality_bucket === "GOOD") goodIds.push(c.canonical_id);
      else mediumIds.push(c.canonical_id);
    }

    if (gate.publication_eligible) {
      const publicEd = resolution ? applyEditorialResolution(ed, resolution) : ed;
      publicRecords.push({ canonical: gateCanonical, editorial: publicEd, scores: sc });
    } else if (gate.blocked_reason) {
      excluded.push({
        canonical_id: c.canonical_id,
        quality_bucket: sc.quality_bucket,
        reason: gate.blocked_reason,
        publication_status: c.publication_status,
        license_status: c.license_status,
        curation_status: c.curation_status,
      });
    }
  }

  const expectedQualified =
    qualityBuckets.EXCELLENT + qualityBuckets.HIGH + qualityBuckets.GOOD + qualityBuckets.MEDIUM;
  const tierTotal = excellentIds.length + highIds.length + goodIds.length + mediumIds.length;
  if (tierTotal !== expectedQualified) {
    errors.push(`quality tier total ${tierTotal} != expected ${expectedQualified}`);
  }
  if (expectedQualified !== 63181) {
    warnings.push(`quality qualified total ${expectedQualified} != baseline 63181`);
  }
  const conservation = expectedQualified + qualityBuckets.LOW + qualityBuckets.INVALID_REVIEW;
  if (conservation !== canonical.length) {
    errors.push(`quality conservation ${conservation} != canonical ${canonical.length}`);
  }

  const publicEditorial = publicRecords.map((r) => r.editorial);
  const publicScored = publicRecords.map((r) => r.scores);
  const publicCanonical = publicRecords.map((r) => r.canonical);

  const publicRelationships = buildRelationships(publicEditorial);
  const publicCollections = buildCollections(publicEditorial);
  const searchIndex = buildSearchIndex(publicEditorial);
  const { rankings, collections: rankCollections } = buildRankings(publicScored.map((s) => ({ ...s, is_public: true })));

  const libDir = getPhase12PublicQualityDir(rootDir);
  writeJson(join(libDir, "excellent", "canonical-ids.json"), excellentIds.sort());
  writeJson(join(libDir, "high", "canonical-ids.json"), highIds.sort());
  writeJson(join(libDir, "good", "canonical-ids.json"), goodIds.sort());
  writeJson(join(libDir, "medium", "canonical-ids.json"), mediumIds.sort());
  writeJson(join(libDir, "canonical-records.json"), publicCanonical);
  writeJson(join(libDir, "editorial.json"), publicEditorial);
  writeJson(join(libDir, "scores.json"), publicScored);
  writeJson(join(libDir, "categories.json"), publicEditorial.map((r) => ({
    canonical_id: r.canonical_id, categories: r.emojiquick_categories, category_status: r.category_status,
  })));
  writeJson(join(libDir, "keywords.json"), publicEditorial.map((r) => ({
    canonical_id: r.canonical_id, source_keywords: r.source_keywords, emojiquick_keywords: r.emojiquick_keywords,
  })));
  writeJson(join(libDir, "names.json"), publicEditorial.map((r) => ({
    canonical_id: r.canonical_id, editorial_name: r.editorial_name, name_status: r.name_status, accessible_name: r.accessible_name,
    seo_title: r.seo_title,
  })));
  writeJson(join(libDir, "meanings.json"), publicEditorial.map((r) => ({
    canonical_id: r.canonical_id, meaning_status: r.meaning_status, meaning: r.meaning, common_usage: r.common_usage,
  })));
  writeJson(join(libDir, "relationships.json"), publicRelationships);
  writeJson(join(libDir, "collections.json"), publicCollections);
  writeJson(join(libDir, "provenance.json"), publicCanonical.map((c) => ({
    canonical_id: c.canonical_id,
    provenance_status: c.provenance_status,
    source_occurrences: c.source_occurrences,
    created_from_raw_ids: c.created_from_raw_ids,
  })));
  writeJson(join(libDir, "publication-gate.json"), gates);
  writeJson(join(libDir, "search-index.json"), searchIndex);
  writeJson(join(libDir, "rankings.json"), rankings);
  writeJson(join(libDir, "ranking-collections.json"), rankCollections);
  writeJson(join(libDir, "slug-map.json"), Object.fromEntries(publicEditorial.map((r) => [r.slug, r.canonical_id])));
  writeJson(join(libDir, "excluded-records.json"), excluded.sort((a, b) => a.canonical_id.localeCompare(b.canonical_id)));

  const rawShaAfter = sha256File(rawPath);
  const rawAfter = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];
  if (rawShaBefore !== rawShaAfter) errors.push("RAW sha256 changed");
  if (rawAfter.length !== rawBefore.length) errors.push("RAW count changed");

  const p8ShaAfter = sha256File(join(getPhase8ProposedLibraryDir(rootDir), "canonical-records.json"));
  const p9ShaAfter = sha256File(join(getPhase9EditorialDir(rootDir), "editorial-records.json"));
  const p10ShaAfter = sha256File(join(getPhase10RootDir(rootDir), "scored-records.json"));
  if (p8Sha !== p8ShaAfter) errors.push("Phase 8 canonical modified");
  if (p9Sha !== p9ShaAfter) errors.push("Phase 9 editorial modified");
  if (p10Sha !== p10ShaAfter) errors.push("Phase 10 scores modified");

  const storage = measurePublicLibraryStorage(libDir);

  const excellentPublic = publicRecords.filter((r) => r.scores.quality_bucket === "EXCELLENT").length;
  const highPublic = publicRecords.filter((r) => r.scores.quality_bucket === "HIGH").length;
  const goodPublic = publicRecords.filter((r) => r.scores.quality_bucket === "GOOD").length;
  const mediumPublic = publicRecords.filter((r) => r.scores.quality_bucket === "MEDIUM").length;

  const manifest: Phase12Manifest = {
    phase: 12,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE12_PIPELINE_VERSION,
    raw_before: rawBefore.length,
    raw_after: rawAfter.length,
    raw_removed: 0,
    raw_modified: rawShaBefore !== rawShaAfter ? -1 : 0,
    raw_sha256: rawShaAfter,
    canonical_candidates: canonical.length,
    quality_buckets: qualityBuckets,
    quality_qualified: expectedQualified,
    publication_eligible: publicRecords.length,
    publication_blocked: excluded.filter((e) => isQualityEligible(e.quality_bucket)).length,
    excellent_qualified: qualityBuckets.EXCELLENT,
    high_qualified: qualityBuckets.HIGH,
    good_qualified: qualityBuckets.GOOD,
    medium_qualified: qualityBuckets.MEDIUM,
    excellent_public: excellentPublic,
    high_public: highPublic,
    good_public: goodPublic,
    medium_public: mediumPublic,
    low_excluded: qualityBuckets.LOW,
    invalid_excluded: qualityBuckets.INVALID_REVIEW,
    duplicate_groups_preserved: dupGroups.length,
    variant_groups_preserved: variantGroups.length,
    legitimate_variants_preserved: variantGroups.filter((v) => v.variant_type !== "category_context").length,
    popularity_status: "INSUFFICIENT_DATA",
    storage,
    errors,
    warnings,
  };

  writeJson(join(libDir, "manifest.json"), manifest);
  mkdirSync(join(libDir, "..", "manifests"), { recursive: true });
  writeJson(getPhase12ManifestPath(rootDir), manifest);
  return { manifest };
}
