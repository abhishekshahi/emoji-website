import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { buildCanonicalId, buildCanonicalLibrary } from "@/lib/kaomoji/processing/phase8/canonical-build";
import { repairProvenance, explainProvenanceDiscrepancy } from "@/lib/kaomoji/processing/phase8/provenance-repair";
import { EXPECTED_RAW_BASELINE, hashCanonicalOutput, runPhase8Pipeline } from "@/lib/kaomoji/processing/phase8/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { getKaomojiRawRecordsPath, getPhase7RawSnapshotPath } from "@/lib/kaomoji/storage/paths";
import type { RawKaomojiRecord } from "@/lib/kaomoji/types";

function sampleRaw(overrides: Partial<RawKaomojiRecord> = {}): RawKaomojiRecord {
  return {
    raw_id: "raw-a",
    source_id: "generate-kaomoji",
    source_url: "https://github.com/xav-ie/generate-kaomoji",
    source_record_id: "gk:0",
    source_page: null,
    source_category: "joy",
    source_title: null,
    original_kaomoji: "(｡♥‿♥｡)",
    raw_text: "(｡♥‿♥｡)",
    raw_html_context_if_needed: null,
    collection_timestamp: "2026-08-19T00:00:00.000Z",
    collector_version: "test",
    license_status: "REVIEW_REQUIRED",
    provenance: ["generate-kaomoji", "https://github.com/xav-ie/generate-kaomoji", "direct", "gk:0", "run-1"],
    content_type: "KAOMOJI",
    run_id: "run-1",
    ...overrides,
  } as RawKaomojiRecord;
}

describe("phase 8 canonical library", () => {
  it("repairs legacy single-element provenance to COMPLETE", () => {
    const r = repairProvenance(
      sampleRaw({
        provenance: ["wikipedia:List_of_emoticons-1"],
        source_id: "wikipedia",
        source_record_id: "List_of_emoticons-1",
        source_page: "https://en.wikipedia.org/wiki/List_of_emoticons",
      }),
    );
    assert.equal(r.status, "COMPLETE");
    assert.equal(r.repair_method, "legacy_single_expanded");
  });

  it("explains Phase 7 vs Phase 8 provenance discrepancy", () => {
    const exp = explainProvenanceDiscrepancy({ COMPLETE: 200000, PARTIAL: 32683, MISSING: 0, CONFLICTING: 0, PROVENANCE_UNRESOLVED: 0 }, 232683);
    assert.match(exp, /85\.6%/);
  });

  it("buildCanonicalId is deterministic", () => {
    const a = buildCanonicalId("(｡♥‿♥｡)");
    const b = buildCanonicalId("(｡♥‿♥｡)");
    assert.equal(a, b);
    assert.match(a, /^kao_[a-f0-9]{16}$/);
  });

  it("merges exact duplicates into one canonical with all occurrences", () => {
    const raw1 = sampleRaw({ raw_id: "a", source_id: "generate-kaomoji" });
    const raw2 = sampleRaw({ raw_id: "b", source_id: "kawaii-faces", source_record_id: "kf:0" });
    const norm = "(｡♥‿♥｡)";
    const meta = {
      validation_status: "VALID_KAOMOJI",
      validation_reasons: [],
      content_types: ["KAOMOJI"],
      quality_score: 75,
      quality_status: "KEEP_CANDIDATE",
      license_status: "APPROVED" as const,
      publication_status: "PUBLISH_CANDIDATE",
    };
    const result = buildCanonicalLibrary({
      rawRecords: [raw1, raw2],
      normalizedByRawId: new Map([
        ["a", norm],
        ["b", norm],
      ]),
      metaByRawId: new Map([
        ["a", meta],
        ["b", meta],
      ]),
      repairedByRawId: new Map([
        ["a", repairProvenance(raw1)],
        ["b", repairProvenance(raw2)],
      ]),
      variantGroupByRawId: new Map(),
      nearDuplicateRawIds: new Set(),
    });
    assert.equal(result.canonicalRecords.length, 1);
    assert.equal(result.canonicalRecords[0]!.source_occurrences.length, 2);
    assert.equal(result.rawToCanonical.size, 2);
  });

  it("preserves unique records as separate canonical entries", () => {
    const raw1 = sampleRaw({ raw_id: "a", original_kaomoji: "(^_^)", raw_text: "(^_)" });
    const raw2 = sampleRaw({ raw_id: "b", original_kaomoji: "(T_T)", raw_text: "(T_T)" });
    const meta = {
      validation_status: "VALID_KAOMOJI",
      validation_reasons: [],
      content_types: ["KAOMOJI"],
      quality_score: 70,
      quality_status: "KEEP_CANDIDATE",
      license_status: "APPROVED" as const,
      publication_status: "PUBLISH_CANDIDATE",
    };
    const result = buildCanonicalLibrary({
      rawRecords: [raw1, raw2],
      normalizedByRawId: new Map([
        ["a", "(^_^)"],
        ["b", "(T_T)"],
      ]),
      metaByRawId: new Map([
        ["a", meta],
        ["b", meta],
      ]),
      repairedByRawId: new Map([
        ["a", repairProvenance(raw1)],
        ["b", repairProvenance(raw2)],
      ]),
      variantGroupByRawId: new Map(),
      nearDuplicateRawIds: new Set(),
    });
    assert.equal(result.canonicalRecords.length, 2);
  });

  it("flags near-duplicates for REVIEW not merge", () => {
    const raw1 = sampleRaw({ raw_id: "a", original_kaomoji: "(^_^)", raw_text: "(^_)" });
    const raw2 = sampleRaw({ raw_id: "b", original_kaomoji: "(^o^)", raw_text: "(^o^)" });
    const meta = {
      validation_status: "VALID_KAOMOJI",
      validation_reasons: [],
      content_types: ["KAOMOJI"],
      quality_score: 70,
      quality_status: "KEEP_CANDIDATE",
      license_status: "APPROVED" as const,
      publication_status: "PUBLISH_CANDIDATE",
    };
    const result = buildCanonicalLibrary({
      rawRecords: [raw1, raw2],
      normalizedByRawId: new Map([
        ["a", "(^_^)"],
        ["b", "(^o^)"],
      ]),
      metaByRawId: new Map([
        ["a", meta],
        ["b", meta],
      ]),
      repairedByRawId: new Map([
        ["a", repairProvenance(raw1)],
        ["b", repairProvenance(raw2)],
      ]),
      variantGroupByRawId: new Map(),
      nearDuplicateRawIds: new Set(["a", "b"]),
    });
    assert.equal(result.canonicalRecords.length, 2);
    assert.ok(result.canonicalRecords.every((c) => c.near_duplicate_review));
  });

  it("REMOVE_CANDIDATE does not imply deletion", () => {
    const raw = sampleRaw({ raw_id: "x", original_kaomoji: "https://spam.com", raw_text: "https://spam.com" });
    const result = buildCanonicalLibrary({
      rawRecords: [raw],
      normalizedByRawId: new Map([["x", "https://spam.com"]]),
      metaByRawId: new Map([
        [
          "x",
          {
            validation_status: "INVALID_CANDIDATE",
            validation_reasons: ["contains_url"],
            content_types: ["TEXT_FACE"],
            quality_score: 0,
            quality_status: "REJECT_CANDIDATE",
            license_status: "UNKNOWN",
            publication_status: "REMOVE_CANDIDATE",
          },
        ],
      ]),
      repairedByRawId: new Map([["x", repairProvenance(raw)]]),
      variantGroupByRawId: new Map(),
      nearDuplicateRawIds: new Set(),
    });
    assert.equal(result.canonicalRecords[0]!.curation_status, "REMOVE_CANDIDATE");
    assert.equal(result.rawToCanonical.size, 1);
  });

  it("RAW immutability — sha256 unchanged", () => {
    const path = getKaomojiRawRecordsPath(process.cwd());
    const p7 = JSON.parse(readFileSync(getPhase7RawSnapshotPath(process.cwd()), "utf8")) as { file_sha256: string };
    const now = hashRawFile(path);
    assert.equal(now.sha256, p7.file_sha256);
  });

  it("baseline raw count 232683", () => {
    const raw = JSON.parse(readFileSync(getKaomojiRawRecordsPath(process.cwd()), "utf8")) as unknown[];
    assert.equal(raw.length, EXPECTED_RAW_BASELINE);
  });

  it("full pipeline maps all raw records", () => {
    const { manifest } = runPhase8Pipeline(process.cwd());
    assert.equal(manifest.raw_before, EXPECTED_RAW_BASELINE);
    assert.equal(manifest.raw_after, EXPECTED_RAW_BASELINE);
    assert.equal(manifest.raw_removed, 0);
    assert.equal(manifest.no_loss.all_raw_mapped, true);
    assert.equal(manifest.no_loss.mapped_count, EXPECTED_RAW_BASELINE);
  });

  it("duplicate conservation — all group members map to same canonical", () => {
    const dupGroups = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/duplicate-groups.json"), "utf8"),
    ) as Array<{ members: string[]; canonical_id: string }>;
    const rawMap = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/raw-to-canonical-map.json"), "utf8"),
    ) as Record<string, string>;
    for (const g of dupGroups) {
      for (const mid of g.members) {
        assert.equal(rawMap[mid], g.canonical_id);
      }
    }
  });

  it("variant conservation — variant group members remain mapped", () => {
    const variantGroups = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/variant-groups.json"), "utf8"),
    ) as Array<{ raw_ids: string[] }>;
    const rawMap = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/raw-to-canonical-map.json"), "utf8"),
    ) as Record<string, string>;
    for (const vg of variantGroups) {
      for (const rid of vg.raw_ids) {
        assert.ok(rawMap[rid], `variant member ${rid} must map`);
      }
    }
  });

  it("provenance conservation — every canonical points to raw records", () => {
    const canonical = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/canonical-records.json"), "utf8"),
    ) as Array<{ created_from_raw_ids: string[]; source_occurrences: unknown[] }>;
    for (const c of canonical) {
      assert.ok(c.created_from_raw_ids.length >= 1);
      assert.ok(c.source_occurrences.length >= 1);
    }
  });

  it("deterministic canonical output hash is stable", () => {
    const canonical = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/canonical-records.json"), "utf8"),
    );
    const h1 = hashCanonicalOutput(canonical);
    const h2 = hashCanonicalOutput(canonical);
    assert.equal(h1, h2);
    assert.match(h1, /^[a-f0-9]{64}$/);
  });

  it("license gate assigns valid statuses only", () => {
    const gate = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/license-gate.json"), "utf8"),
    ) as Array<{ license_status: string; publication_status: string }>;
    const validLicense = new Set(["APPROVED", "ATTRIBUTION_REQUIRED", "REVIEW_REQUIRED", "NOT_PERMITTED", "UNKNOWN"]);
    const validPub = new Set([
      "PUBLISH_CANDIDATE",
      "PUBLISH_WITH_ATTRIBUTION",
      "REVIEW_REQUIRED",
      "BLOCKED",
      "REMOVE_CANDIDATE",
    ]);
    for (const g of gate) {
      assert.ok(validLicense.has(g.license_status));
      assert.ok(validPub.has(g.publication_status));
    }
  });

  it("publication gate — REMOVE_CANDIDATE is non-destructive flag only", () => {
    const remove = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/remove-candidates.json"), "utf8"),
    ) as unknown[];
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8"),
    ) as { curation: { REMOVE_CANDIDATE: number }; raw_removed: number };
    assert.equal(remove.length, manifest.curation.REMOVE_CANDIDATE);
    assert.equal(manifest.raw_removed, 0);
  });

  it("source occurrence count equals raw baseline", () => {
    const occurrences = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/source-occurrences.json"), "utf8"),
    ) as unknown[];
    assert.equal(occurrences.length, EXPECTED_RAW_BASELINE);
  });

  it("category duplicates collapse to one canonical per content", () => {
    const canonical = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/canonical-records.json"), "utf8"),
    ) as Array<{ normalized_content: string; canonical_id: string }>;
    const byNorm = new Map<string, string>();
    for (const c of canonical) {
      const existing = byNorm.get(c.normalized_content);
      assert.ok(!existing || existing === c.canonical_id);
      byNorm.set(c.normalized_content, c.canonical_id);
    }
  });

  it("zero raw modifications — sha256 before equals after", () => {
    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8"),
    ) as { raw_sha256_before: string; raw_sha256_after: string; raw_modified: number };
    assert.equal(manifest.raw_sha256_before, manifest.raw_sha256_after);
    assert.equal(manifest.raw_modified, 0);
  });

  it("provenance repair achieves near-complete coverage", () => {
    const audit = JSON.parse(
      readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/proposed-library/provenance-audit.json"), "utf8"),
    ) as { stats: Record<string, number> };
    const covered = (audit.stats.COMPLETE ?? 0) + (audit.stats.PARTIAL ?? 0);
    assert.ok(covered >= EXPECTED_RAW_BASELINE - 1);
    assert.ok((audit.stats.COMPLETE ?? 0) / EXPECTED_RAW_BASELINE > 0.999);
  });
});
