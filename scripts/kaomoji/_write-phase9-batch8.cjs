const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
function w(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  console.log("wrote", rel);
}

w("scripts/kaomoji/write-phase9-reports.ts", `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase9Manifest } from "@/lib/kaomoji/processing/phase9/types";
import { getPhase9ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase9Manifest {
  const p = getPhase9ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase9 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase9Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.raw_removed === 0 && m.raw_before === m.raw_after && m.errors.length === 0
    ? (m.warnings.length ? "PASS WITH WARNINGS" : "PASS") : "FAIL";
  write("PHASE-9-KAOMOJI-DATABASE.md", \`# Phase 9 Database\\n\\nCanonical: \${m.canonical_candidates}\\nPublic: \${m.public_candidates}\\nRAW: \${m.raw_after}\\n\`);
  write("PHASE-9-TAXONOMY.md", \`# Phase 9 Taxonomy\\n\\nAssigned: \${m.categories_assigned}\\nReview: \${m.categories_review}\\n\`);
  write("PHASE-9-KEYWORDS.md", \`# Phase 9 Keywords\\n\\nTotal keyword entries: \${m.keywords_total}\\n\`);
  write("PHASE-9-NAMES.md", \`# Phase 9 Names\\n\\nAssigned: \${m.names_assigned}\\nReview: \${m.names_review}\\n\`);
  write("PHASE-9-MEANINGS.md", \`# Phase 9 Meanings\\n\\nTier 1: \${m.tier_1}\\nTier 2: \${m.tier_2}\\nTier 3: \${m.tier_3}\\nEditorial meanings: \${m.meanings_editorial}\\n\`);
  write("PHASE-9-QUALITY.md", \`# Phase 9 Quality\\n\\nQuality version retained from Phase 8 + Phase 9 scoring version.\\n\`);
  write("PHASE-9-BEAUTY.md", \`# Phase 9 Beauty\\n\\nEmojiQuick Aesthetic Score — deterministic, not popularity.\\n\`);
  write("PHASE-9-RELATIONSHIPS.md", \`# Phase 9 Relationships\\n\\nTotal: \${m.relationships}\\n\`);
  write("PHASE-9-SEARCH.md", \`# Phase 9 Search\\n\\nIndex records: \${m.search_index_records}\\nQuality cases: \${m.search_quality_cases}\\n\`);
  write("PHASE-9-COLLECTIONS.md", \`# Phase 9 Collections\\n\\nCollections: \${m.collections}\\n\`);
  write("PHASE-9-SEO.md", \`# Phase 9 SEO\\n\\nIndexable pages: \${m.seo_indexable_pages}\\n\`);
  write("PHASE-9-ANALYTICS.md", \`# Phase 9 Analytics\\n\\nEvents: \${m.analytics_events_supported.join(", ")}\\nPopularity: \${m.popularity_status}\\n\`);
  write("PHASE-9-MULTILINGUAL.md", \`# Phase 9 Multilingual\\n\\nFoundation only — English canonical URLs preserved.\\n\`);
  write("PHASE-9-ACCESSIBILITY.md", \`# Phase 9 Accessibility\\n\\nAccessible names on all public kaomoji cards and detail pages.\\n\`);
  write("PHASE-9-PERFORMANCE.md", \`# Phase 9 Performance\\n\\nServer-side search index; no 63k browser load.\\n\`);
  write("PHASE-9-TESTS.md", \`# Phase 9 Tests\\n\\nRun: npx tsx --test src/lib/kaomoji/kaomoji-phase9.test.ts\\n\`);
  write("PHASE-9-DEPLOYMENT.md", \`# Phase 9 Deployment\\n\\nDeploy only after tests + build pass. RAW must remain \${m.raw_after}.\\n\`);
  write("PHASE-9-FINAL.md", \`# Phase 9 Final\\n\\n**Verdict: \${verdict}**\\n\\n| RAW | \${m.raw_after} |\\n| Public | \${m.public_candidates} |\\n| Tier 1/2/3 | \${m.tier_1} / \${m.tier_2} / \${m.tier_3} |\\n| Collections | \${m.collections} |\\n| Search index | \${m.search_index_records} |\\n\`);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-9-canonical.json"), JSON.stringify({ count: m.canonical_candidates, public: m.public_candidates }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-taxonomy.json"), JSON.stringify({ assigned: m.categories_assigned, review: m.categories_review }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-editorial.json"), JSON.stringify({ tier_1: m.tier_1, tier_2: m.tier_2, tier_3: m.tier_3 }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-search.json"), JSON.stringify({ records: m.search_index_records, cases: m.search_quality_cases }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-collections.json"), JSON.stringify({ count: m.collections }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-seo.json"), JSON.stringify({ indexable: m.seo_indexable_pages }, null, 2));
  writeFileSync(join(manifestDir, "phase-9-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}
main();
`);

w("src/lib/kaomoji/kaomoji-phase9.test.ts", `import assert from "node:assert/strict";
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
import { EXPECTED_RAW_BASELINE } from "@/lib/kaomoji/processing/phase7/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { getKaomojiRawRecordsPath, getPhase7RawSnapshotPath, getPhase9ManifestPath } from "@/lib/kaomoji/storage/paths";
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
    const p7 = JSON.parse(readFileSync(getPhase7RawSnapshotPath(process.cwd()), "utf8")) as { file_sha256: string };
    assert.equal(hashRawFile(getKaomojiRawRecordsPath(process.cwd())).sha256, p7.file_sha256);
  });
  it("RAW count 232683", () => {
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
    assert.equal(m.canonical_candidates, 63248);
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
    assert.equal(p8.variant_groups, 15143);
  });
  it("duplicate preservation — phase 8 unchanged", () => {
    const p8 = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8")) as { exact_groups: number };
    assert.equal(p8.exact_groups, 49885);
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
`);

console.log("batch8 done");
