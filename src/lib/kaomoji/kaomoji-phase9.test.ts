import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { assignCategories } from "@/lib/kaomoji/processing/phase9/taxonomy";
import { buildEmojiquickKeywords } from "@/lib/kaomoji/processing/phase9/keywords";
import { assignName } from "@/lib/kaomoji/processing/phase9/names";
import { assignPriority, assignTier, isPublicCandidate, assignMeaning } from "@/lib/kaomoji/processing/phase9/editorial-priority";
import { computeBeautyScore } from "@/lib/kaomoji/processing/phase9/beauty-score";
import { canonicalIdToSlug, isValidKaomojiSlug } from "@/lib/kaomoji/processing/phase9/slug";
import { buildSearchIndex, searchKaomoji } from "@/lib/kaomoji/processing/phase9/search-index";
import { buildCollections } from "@/lib/kaomoji/processing/phase9/collections";
import { SEARCH_QUALITY_DATASET } from "@/lib/kaomoji/processing/phase9/search-quality";
import { runPhase9Pipeline } from "@/lib/kaomoji/processing/phase9/pipeline";
import { EXPECTED_RAW_BASELINE, AUTHORITATIVE_RAW_SHA256 } from "@/lib/kaomoji/processing/phase7/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { getKaomojiRawRecordsPath, getPhase9ManifestPath } from "@/lib/kaomoji/storage/paths";
import type { CanonicalRecord } from "@/lib/kaomoji/processing/phase8/types";
import type { KaomojiEditorialRecord } from "@/lib/kaomoji/processing/phase9/types";
import { isValidCanonicalId } from "@/lib/content/analytics/validation";

function sampleCanonical(overrides: Partial<CanonicalRecord> = {}): CanonicalRecord {
  return {
    canonical_id: "kao_abc123def4567890",
    canonical_content: "(｡♥‿♥｡)",
    normalized_content: "(｡♥‿♥｡)",
    content_type: "KAOMOJI",
    content_type_labels: ["KAOMOJI"],
    duplicate_group_id: null,
    variant_group_id: null,
    variant_type: null,
    source_occurrences: [{ raw_id: "r1", source_id: "test", source_record_id: "1", source_url: "https://example.com", source_page: null, source_category: "love", source_file: null, collection_timestamp: "2026-01-01T00:00:00Z", license_status: "APPROVED", provenance_status: "COMPLETE" }],
    provenance_status: "COMPLETE",
    quality_score: 85,
    quality_status: "HIGH",
    quality_reasons: [],
    license_status: "APPROVED",
    publication_status: "PUBLISH_CANDIDATE",
    curation_status: "KEEP_CANDIDATE",
    confidence: "high",
    representative_raw_id: "r1",
    created_from_raw_ids: ["r1"],
    source_categories: ["love"],
    emojiquick_category_candidates: ["love"],
    popularity_status: "DATA_NOT_AVAILABLE",
    near_duplicate_review: false,
    ...overrides,
  } as CanonicalRecord;
}

describe("phase 9 kaomoji knowledge", () => {
  it("assigns taxonomy from source category", () => {
    const r = assignCategories("(｡♥‿♥｡)", ["love"]);
    assert.ok(r.categories.some((c) => c.slug === "love"));
  });
  it("slug is deterministic", () => {
    const s = canonicalIdToSlug("kao_abc123def4567890");
    assert.equal(s, "kao-abc123def4567890");
    assert.ok(isValidKaomojiSlug(s));
  });
  it("publication gate excludes review records", () => {
    assert.equal(isPublicCandidate(sampleCanonical()), true);
    assert.equal(isPublicCandidate(sampleCanonical({ curation_status: "REVIEW" })), false);
    assert.equal(isPublicCandidate(sampleCanonical({ publication_status: "REVIEW_REQUIRED" })), false);
  });
  it("does not fabricate popularity", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { popularity_status: string };
    assert.equal(m.popularity_status, "INSUFFICIENT_DATA");
  });
  it("RAW immutability sha256", () => {
    assert.equal(hashRawFile(getKaomojiRawRecordsPath(process.cwd())).sha256, AUTHORITATIVE_RAW_SHA256);
  });
  it("RAW count 236508", () => {
    const raw = JSON.parse(readFileSync(getKaomojiRawRecordsPath(process.cwd()), "utf8")) as unknown[];
    assert.equal(raw.length, EXPECTED_RAW_BASELINE);
  });
  it("beauty score is deterministic", () => {
    const a = computeBeautyScore("(｡♥‿♥｡)", 80);
    const b = computeBeautyScore("(｡♥‿♥｡)", 80);
    assert.equal(a, b);
  });
  it("search finds love keyword", () => {
    const editorial: KaomojiEditorialRecord[] = [{
      canonical_id: "kao_test0000000001", slug: "kao-test0000000001", canonical_content: "(♥‿♥)", normalized_content: "(♥‿♥)", content_type: "KAOMOJI",
      publication_status: "PUBLISH_CANDIDATE", curation_status: "KEEP_CANDIDATE", license_status: "APPROVED", provenance_status: "COMPLETE", is_public: true,
      source_categories: ["love"], emojiquick_categories: [{ group: "LOVE_RELATIONSHIP", label: "Love", slug: "love" }], category_status: "ASSIGNED",
      source_keywords: ["love"], emojiquick_keywords: ["love", "kaomoji"], editorial_name: "Love Kaomoji", name_confidence: "high", name_status: "ASSIGNED",
      editorial_tier: "TIER_1", editorial_priority: "P0", meaning_status: "CATEGORY_DERIVED", meaning: "Love face", common_usage: null,
      quality_score: 90, quality_reasons: [], quality_version: "9.0.0", beauty_score: 85, beauty_version: "9.0.0", source_occurrence_count: 2,
      duplicate_group_id: null, variant_group_id: null, popularity_status: "INSUFFICIENT_DATA", analytics_status: "DATA_NOT_AVAILABLE",
      accessible_name: "love kaomoji", seo_title: "Love", seo_description: "Copy love kaomoji",
    }];
    const idx = buildSearchIndex(editorial);
    const hits = searchKaomoji(idx, "love");
    assert.ok(hits.length >= 1);
  });
  it("collections are deterministic", () => {
    const editorial: KaomojiEditorialRecord[] = [{
      canonical_id: "kao_test0000000002", slug: "kao-test0000000002", canonical_content: "(^_^)", normalized_content: "(^_^)", content_type: "KAOMOJI",
      publication_status: "PUBLISH_CANDIDATE", curation_status: "KEEP_CANDIDATE", license_status: "APPROVED", provenance_status: "COMPLETE", is_public: true,
      source_categories: ["happy"], emojiquick_categories: [{ group: "EMOTION", label: "Happy", slug: "happy" }], category_status: "ASSIGNED",
      source_keywords: [], emojiquick_keywords: ["happy"], editorial_name: null, name_confidence: "low", name_status: "REVIEW",
      editorial_tier: "TIER_3", editorial_priority: "P2", meaning_status: "NONE", meaning: null, common_usage: null,
      quality_score: 80, quality_reasons: [], quality_version: "9.0.0", beauty_score: 70, beauty_version: "9.0.0", source_occurrence_count: 1,
      duplicate_group_id: null, variant_group_id: null, popularity_status: "INSUFFICIENT_DATA", analytics_status: "DATA_NOT_AVAILABLE",
      accessible_name: "happy kaomoji", seo_title: "Happy", seo_description: "desc",
    }];
    const cols = buildCollections(editorial);
    assert.ok(cols.some((c) => c.slug === "happy-kaomoji"));
  });
  it("kaomoji analytics canonical id accepted", () => {
    assert.ok(isValidCanonicalId("kao_abc123def4567890"));
  });
  it("full pipeline produces manifest", () => {
    const { manifest } = runPhase9Pipeline(process.cwd());
    assert.equal(manifest.raw_removed, 0);
    assert.equal(manifest.raw_before, EXPECTED_RAW_BASELINE);
    assert.ok(manifest.public_candidates > 0);
    assert.ok(manifest.collections >= 10);
  });
  it("phase 9 manifest canonical count", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { canonical_candidates: number };
    // Live Phase 9 editorial layer tracks regenerated Phase 8 proposed library (236508 RAW).
    // Frozen Phase 12/13 publication set remains 63248 / 51338.
    assert.equal(m.canonical_candidates, 63811);
  });
  it("search quality dataset has 30+ cases", () => {
    assert.ok(SEARCH_QUALITY_DATASET.length >= 30);
  });
  it("tier assignment conservative", () => {
    assert.equal(assignTier("P3", "low"), "TIER_3");
  });
  it("meaning none when uncertain", () => {
    assert.equal(assignMeaning("TIER_3", [], "low").meaning_status, "NONE");
  });
  it("name review for non-kaomoji content", () => {
    const n = assignName("hello world", [], "low");
    assert.equal(n.name_status, "REVIEW");
  });
  it("keywords include kaomoji", () => {
    const k = buildEmojiquickKeywords("(^_^)", [{ group: "EMOTION", label: "Happy", slug: "happy" }], []);
    assert.ok(k.includes("kaomoji"));
  });
  it("priority P0 needs quality and sources", () => {
    const p = assignPriority(sampleCanonical({ quality_score: 85, source_occurrences: sampleCanonical().source_occurrences.concat(sampleCanonical().source_occurrences, sampleCanonical().source_occurrences) }), "high");
    assert.equal(p, "P0");
  });
  it("editorial output files exist", () => {
    const base = join(process.cwd(), "data/kaomoji/processed/phase-9/editorial");
    assert.ok(readFileSync(join(base, "editorial-records.json"), "utf8").length > 1000);
    assert.ok(readFileSync(join(base, "search-index.json"), "utf8").length > 1000);
  });
  it("no raw deletion in phase 9", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { raw_removed: number; raw_modified: number };
    assert.equal(m.raw_removed, 0);
    assert.equal(m.raw_modified, 0);
  });
  it("public candidates less than canonical", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { public_candidates: number; canonical_candidates: number };
    assert.ok(m.public_candidates < m.canonical_candidates);
  });
  it("relationships file exists", () => {
    const rel = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-9/editorial/relationships.json"), "utf8")) as unknown[];
    assert.ok(rel.length > 0);
  });
  it("collections file has 20 entries", () => {
    const cols = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-9/editorial/collections.json"), "utf8")) as unknown[];
    assert.equal(cols.length, 20);
  });
  it("slug map covers editorial records", () => {
    const map = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-9/editorial/slug-map.json"), "utf8")) as Record<string, string>;
    assert.ok(Object.keys(map).length >= 63248);
  });
  it("search pass rate above 80%", () => {
    const r = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-9/editorial/search-quality-results.json"), "utf8")) as { pass_rate: number };
    assert.ok(r.pass_rate >= 0.8);
  });
  it("tier counts sum to canonical", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { tier_1: number; tier_2: number; tier_3: number; canonical_candidates: number };
    assert.equal(m.tier_1 + m.tier_2 + m.tier_3, m.canonical_candidates);
  });
  it("analytics events include kaomoji_copy", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { analytics_events_supported: string[] };
    assert.ok(m.analytics_events_supported.includes("kaomoji_copy"));
  });
  it("variant preservation — phase 8 unchanged", () => {
    const p8 = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8")) as { variant_groups: number };
    assert.equal(p8.variant_groups, 15146);
  });
  it("duplicate preservation — phase 8 unchanged", () => {
    const p8 = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8")) as { exact_groups: number };
    assert.equal(p8.exact_groups, 52066);
  });
  it("review records not in public index count", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { review: number; public_candidates: number };
    assert.ok(m.review > 0);
    assert.ok(m.public_candidates > 50000);
  });
  it("remove candidates not deleted", () => {
    const m = JSON.parse(readFileSync(getPhase9ManifestPath(process.cwd()), "utf8")) as { remove_candidates: number; raw_removed: number };
    assert.equal(m.remove_candidates, 66);
    assert.equal(m.raw_removed, 0);
  });
});
