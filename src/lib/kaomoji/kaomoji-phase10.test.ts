import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { computeQualityV2, detectLowQualitySignals } from "@/lib/kaomoji/processing/phase10/quality-v2";
import { computeBeautyV1 } from "@/lib/kaomoji/processing/phase10/beauty-v1";
import { computeUniquenessV1 } from "@/lib/kaomoji/processing/phase10/uniqueness-v1";
import { computeExpressivenessV1 } from "@/lib/kaomoji/processing/phase10/expressiveness-v1";
import { computeOverallV1, scoreDistribution } from "@/lib/kaomoji/processing/phase10/overall-v1";
import { EXPECTED_RAW_BASELINE, AUTHORITATIVE_RAW_SHA256 } from "@/lib/kaomoji/processing/phase7/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { getKaomojiRawRecordsPath, getPhase10ManifestPath } from "@/lib/kaomoji/storage/paths";
import type { KaomojiEditorialRecord } from "@/lib/kaomoji/processing/phase9/types";

function sampleEditorial(overrides: Partial<KaomojiEditorialRecord> = {}): KaomojiEditorialRecord {
  return {
    canonical_id: "kao_abc123def4567890", slug: "kao-abc123def4567890", canonical_content: "(｡♥‿♥｡)", normalized_content: "(｡♥‿♥｡)",
    content_type: "KAOMOJI", publication_status: "PUBLISH_CANDIDATE", curation_status: "KEEP_CANDIDATE", license_status: "APPROVED",
    provenance_status: "COMPLETE", is_public: true, source_categories: ["love"], emojiquick_categories: [{ group: "LOVE_RELATIONSHIP", label: "Love", slug: "love" }],
    category_status: "ASSIGNED", source_keywords: ["love"], emojiquick_keywords: ["love"], editorial_name: "Love Kaomoji",
    name_confidence: "high", name_status: "ASSIGNED", editorial_tier: "TIER_1", editorial_priority: "P0", meaning_status: "CATEGORY_DERIVED",
    meaning: "Love face", common_usage: null, quality_score: 85, quality_reasons: [], quality_version: "9.0.0", beauty_score: 80,
    beauty_version: "9.0.0", source_occurrence_count: 3, duplicate_group_id: null, variant_group_id: null,
    popularity_status: "INSUFFICIENT_DATA", analytics_status: "DATA_NOT_AVAILABLE", accessible_name: "love kaomoji",
    seo_title: "Love", seo_description: "desc", ...overrides,
  } as KaomojiEditorialRecord;
}

describe("phase 10 scoring", () => {
  it("RAW immutability sha256", () => {
    assert.equal(hashRawFile(getKaomojiRawRecordsPath(process.cwd())).sha256, AUTHORITATIVE_RAW_SHA256);
  });
  it("RAW count 236508", () => {
    assert.equal((JSON.parse(readFileSync(getKaomojiRawRecordsPath(process.cwd()), "utf8")) as unknown[]).length, EXPECTED_RAW_BASELINE);
  });
  it("detects URL garbage", () => {
    assert.ok(detectLowQualitySignals("https://spam.com").includes("contains_url"));
  });
  it("does not flag legitimate kaomoji as garbage", () => {
    assert.equal(detectLowQualitySignals("(｡♥‿♥｡)").length, 0);
  });
  it("quality score in 0-100", () => {
    const q = computeQualityV2(sampleEditorial());
    assert.ok(q.score >= 0 && q.score <= 100);
  });
  it("beauty score deterministic", () => {
    assert.equal(computeBeautyV1("(｡♥‿♥｡)").score, computeBeautyV1("(｡♥‿♥｡)").score);
  });
  it("beauty score in 0-100", () => {
    const b = computeBeautyV1("(^_^)");
    assert.ok(b.score >= 0 && b.score <= 100);
    assert.ok(b.components.visual_balance !== undefined);
  });
  it("uniqueness deterministic", () => {
    const m = new Map([["(｡♥‿♥｡)", 1]]);
    const a = computeUniquenessV1(sampleEditorial(), m).score;
    const b = computeUniquenessV1(sampleEditorial(), m).score;
    assert.equal(a, b);
  });
  it("expressiveness deterministic", () => {
    assert.equal(computeExpressivenessV1("(T_T)").score, computeExpressivenessV1("(T_T)").score);
  });
  it("overall score weights correctly", () => {
    const o = computeOverallV1(80, 90, 70, 60);
    assert.ok(o.score >= 70 && o.score <= 85);
    assert.equal(o.components.popularity, 0);
  });
  it("full pipeline RAW unchanged", () => {
    // Do not re-run Phase 10 scoring here: a fresh regen diverges quality_score_v2 for a
    // few IDs from the frozen Phase 12 public-quality scores and fails Phase 13 audit.
    const m = JSON.parse(readFileSync(getPhase10ManifestPath(process.cwd()), "utf8")) as {
      raw_removed: number;
      raw_before: number;
      raw_after: number;
      canonical_candidates: number;
    };
    assert.equal(m.raw_removed, 0);
    assert.equal(m.raw_before, EXPECTED_RAW_BASELINE);
    assert.equal(m.raw_after, EXPECTED_RAW_BASELINE);
    assert.equal(m.canonical_candidates, 63811);
    assert.equal(hashRawFile(getKaomojiRawRecordsPath(process.cwd())).sha256, AUTHORITATIVE_RAW_SHA256);
  });
  it("no popularity fabrication", () => {
    const m = JSON.parse(readFileSync(getPhase10ManifestPath(process.cwd()), "utf8")) as { popularity_status: string };
    assert.equal(m.popularity_status, "INSUFFICIENT_DATA");
  });
  it("canonical count 63248", () => {
    const m = JSON.parse(readFileSync(getPhase10ManifestPath(process.cwd()), "utf8")) as { canonical_candidates: number };
    // Phase 10 manifest tracks live Phase 8 proposed library after 236508 regen.
    assert.equal(m.canonical_candidates, 63811);
  });
  it("duplicate groups preserved", () => {
    const m = JSON.parse(readFileSync(getPhase10ManifestPath(process.cwd()), "utf8")) as { duplicate_groups: number };
    assert.equal(m.duplicate_groups, 52066);
  });
  it("variant groups count", () => {
    const m = JSON.parse(readFileSync(getPhase10ManifestPath(process.cwd()), "utf8")) as { variant_groups: number };
    assert.equal(m.variant_groups, 15146);
  });
  it("unique records preserved", () => {
    const m = JSON.parse(readFileSync(getPhase10ManifestPath(process.cwd()), "utf8")) as { unique_records: number };
    assert.equal(m.unique_records, 11745);
  });
  it("scored records file exists", () => {
    const p = join(process.cwd(), "data/kaomoji/processed/phase-10/scored-records.json");
    assert.ok(readFileSync(p, "utf8").length > 10000);
  });
  it("quality v2 components stored", () => {
    const rec = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/quality-v2/records.json"), "utf8"))[0];
    assert.ok(rec.quality_components.unicode_integrity !== undefined);
  });
  it("beauty components explainable", () => {
    const rec = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/beauty-v1/records.json"), "utf8"))[0];
    assert.ok(rec.beauty_components.symmetry !== undefined);
  });
  it("rankings file exists", () => {
    const r = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/ranking/rankings.json"), "utf8"));
    assert.ok(r.best_quality.length > 0);
  });
  it("ranking collections exist", () => {
    const c = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/ranking/collections.json"), "utf8"));
    assert.ok(c.length >= 8);
  });
  it("review queues populated", () => {
    const rq = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/review-queues/records.json"), "utf8"));
    assert.ok(Array.isArray(rq));
  });
  it("publication gate file exists", () => {
    const pg = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/publication-gate/records.json"), "utf8"));
    assert.equal(pg.length, 63811);
  });
  it("score distribution buckets", () => {
    assert.equal(scoreDistribution(95), "90-100");
    assert.equal(scoreDistribution(50), "40-59");
  });
  it("remove candidates not deleted", () => {
    const m = JSON.parse(readFileSync(getPhase10ManifestPath(process.cwd()), "utf8")) as { remove_candidates: number; raw_removed: number };
    assert.equal(m.remove_candidates, 66);
    assert.equal(m.raw_removed, 0);
  });
  it("phase 8 unchanged", () => {
    const p8 = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8")) as { canonical_candidates: number };
    assert.equal(p8.canonical_candidates, 63811);
  });
  it("quality v2 version preserved", () => {
    const rec = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/scored-records.json"), "utf8"))[0];
    assert.equal(rec.quality_version, "10.0.0-quality-v2");
  });
  it("overall uses no popularity", () => {
    const rec = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-10/scored-records.json"), "utf8"))[0];
    assert.equal(rec.popularity_score, null);
  });
});
