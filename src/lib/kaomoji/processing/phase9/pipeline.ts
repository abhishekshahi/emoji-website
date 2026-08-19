import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalRecord } from "../phase8/types";
import { hashRawFile } from "../phase7/raw-snapshot";
import { EXPECTED_RAW_BASELINE } from "../phase7/pipeline";
import {
  getKaomojiRawRecordsPath,
  getPhase8ManifestPath,
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase9ManifestPath,
  getPhase9RootDir,
  PHASE9_PIPELINE_VERSION,
  PHASE9_QUALITY_VERSION,
} from "../../storage/paths";
import { assignCategories } from "./taxonomy";
import { buildSourceKeywords, buildEmojiquickKeywords } from "./keywords";
import { assignName, buildSeoDescription, buildSeoTitle } from "./names";
import { assignMeaning, assignPriority, assignTier, isPublicCandidate } from "./editorial-priority";
import { computeBeautyScore, BEAUTY_VERSION } from "./beauty-score";
import { canonicalIdToSlug } from "./slug";
import { buildRelationships } from "./relationships";
import { buildCollections } from "./collections";
import { buildSearchIndex, searchKaomoji } from "./search-index";
import { SEARCH_QUALITY_DATASET } from "./search-quality";
import type { KaomojiEditorialRecord, Phase9Manifest } from "./types";

function writeJson(path: string, data: unknown): void {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", "utf8");
}

export interface Phase9PipelineResult {
  readonly manifest: Phase9Manifest;
  readonly searchPassRate: number;
}

export function runPhase9Pipeline(rootDir: string): Phase9PipelineResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const rawHash = hashRawFile(rawPath).sha256;
  const rawRecords = JSON.parse(readFileSync(rawPath, "utf8")) as unknown[];
  const rawCount = rawRecords.length;

  if (rawCount !== EXPECTED_RAW_BASELINE) errors.push(`raw count ${rawCount} != ${EXPECTED_RAW_BASELINE}`);

  const libDir = getPhase8ProposedLibraryDir(rootDir);
  const canonical = JSON.parse(readFileSync(join(libDir, "canonical-records.json"), "utf8")) as CanonicalRecord[];

  const editorial: KaomojiEditorialRecord[] = [];
  let publicCount = 0;
  let reviewCount = 0;
  let blockedCount = 0;
  let removeCount = 0;
  let tier1 = 0, tier2 = 0, tier3 = 0;
  let catAssigned = 0, catReview = 0;
  let namesAssigned = 0, namesReview = 0;
  let meaningsEditorial = 0;
  let keywordsTotal = 0;

  for (const c of canonical) {
    const { categories, category_status, confidence } = assignCategories(c.canonical_content, c.source_categories);
    const sourceKeywords = buildSourceKeywords(c.source_categories);
    const emojiquickKeywords = buildEmojiquickKeywords(c.canonical_content, categories, sourceKeywords);
    keywordsTotal += emojiquickKeywords.length;
    const name = assignName(c.canonical_content, categories, confidence);
    if (name.name_status === "ASSIGNED") namesAssigned++; else namesReview++;
    if (category_status === "ASSIGNED") catAssigned++; else catReview++;
    const priority = assignPriority(c, confidence);
    const tier = assignTier(priority, confidence);
    if (tier === "TIER_1") tier1++; else if (tier === "TIER_2") tier2++; else tier3++;
    const meaning = assignMeaning(tier, categories, confidence);
    if (meaning.meaning) meaningsEditorial++;
    const isPublic = isPublicCandidate(c);
    if (isPublic) publicCount++;
    if (c.curation_status === "REVIEW") reviewCount++;
    if (c.publication_status === "BLOCKED") blockedCount++;
    if (c.curation_status === "REMOVE_CANDIDATE") removeCount++;

    editorial.push({
      canonical_id: c.canonical_id,
      slug: canonicalIdToSlug(c.canonical_id),
      canonical_content: c.canonical_content,
      normalized_content: c.normalized_content,
      content_type: c.content_type,
      publication_status: c.publication_status,
      curation_status: c.curation_status,
      license_status: c.license_status,
      provenance_status: c.provenance_status,
      is_public: isPublic,
      source_categories: c.source_categories,
      emojiquick_categories: categories,
      category_status,
      source_keywords: sourceKeywords,
      emojiquick_keywords: emojiquickKeywords,
      editorial_name: name.editorial_name,
      name_confidence: name.name_confidence,
      name_status: name.name_status,
      editorial_tier: tier,
      editorial_priority: priority,
      meaning_status: meaning.meaning_status,
      meaning: meaning.meaning,
      common_usage: meaning.common_usage,
      quality_score: c.quality_score,
      quality_reasons: c.quality_reasons,
      quality_version: PHASE9_QUALITY_VERSION,
      beauty_score: computeBeautyScore(c.canonical_content, c.quality_score),
      beauty_version: BEAUTY_VERSION,
      source_occurrence_count: c.source_occurrences.length,
      duplicate_group_id: c.duplicate_group_id,
      variant_group_id: c.variant_group_id,
      popularity_status: "INSUFFICIENT_DATA",
      analytics_status: "DATA_NOT_AVAILABLE",
      accessible_name: name.accessible_name,
      seo_title: buildSeoTitle(name.editorial_name, c.canonical_content),
      seo_description: buildSeoDescription(name.editorial_name, c.canonical_content, categories),
    });
  }

  editorial.sort((a, b) => a.canonical_id.localeCompare(b.canonical_id));
  const relationships = buildRelationships(editorial);
  const collections = buildCollections(editorial);
  const searchIndex = buildSearchIndex(editorial);

  const searchQualityResults = SEARCH_QUALITY_DATASET.map((tc) => {
    const hits = searchKaomoji(searchIndex, tc.query, 10);
    return { ...tc, actual_count: hits.length, pass: hits.length >= tc.min_results };
  });
  const searchPassRate = searchQualityResults.filter((r) => r.pass).length / searchQualityResults.length;

  const outDir = getPhase9EditorialDir(rootDir);
  mkdirSync(outDir, { recursive: true });
  writeJson(join(outDir, "editorial-records.json"), editorial);
  writeJson(join(outDir, "relationships.json"), relationships);
  writeJson(join(outDir, "collections.json"), collections);
  writeJson(join(outDir, "search-index.json"), searchIndex);
  writeJson(join(outDir, "search-quality-results.json"), { pass_rate: searchPassRate, results: searchQualityResults });
  writeJson(join(outDir, "slug-map.json"), Object.fromEntries(editorial.map((e) => [e.slug, e.canonical_id])));

  const manifest: Phase9Manifest = {
    phase: 9,
    timestamp: new Date().toISOString(),
    pipeline_version: PHASE9_PIPELINE_VERSION,
    raw_before: rawCount,
    raw_after: rawCount,
    raw_removed: 0,
    raw_modified: 0,
    raw_sha256: rawHash,
    canonical_candidates: canonical.length,
    public_candidates: publicCount,
    review: reviewCount,
    blocked: blockedCount,
    remove_candidates: removeCount,
    tier_1: tier1,
    tier_2: tier2,
    tier_3: tier3,
    categories_assigned: catAssigned,
    categories_review: catReview,
    keywords_total: keywordsTotal,
    names_assigned: namesAssigned,
    names_review: namesReview,
    meanings_editorial: meaningsEditorial,
    relationships: relationships.length,
    collections: collections.length,
    search_index_records: searchIndex.records.length,
    search_quality_cases: searchQualityResults.length,
    seo_indexable_pages: publicCount,
    analytics_events_supported: [
      "kaomoji_search", "kaomoji_view", "kaomoji_copy", "kaomoji_favorite",
      "kaomoji_share", "collection_view", "collection_click", "related_click",
    ],
    popularity_status: "INSUFFICIENT_DATA",
    errors,
    warnings,
  };

  mkdirSync(join(getPhase9RootDir(rootDir), "manifests"), { recursive: true });
  writeJson(getPhase9ManifestPath(rootDir), manifest);

  if (existsSync(getPhase8ManifestPath(rootDir))) {
    const p8 = JSON.parse(readFileSync(getPhase8ManifestPath(rootDir), "utf8")) as { raw_sha256_after: string };
    if (p8.raw_sha256_after !== rawHash) warnings.push("RAW sha256 differs from Phase 8 manifest");
  }

  return { manifest, searchPassRate };
}
