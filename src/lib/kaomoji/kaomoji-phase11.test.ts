import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CANONICAL_CANDIDATE_DEFINITION } from "@/lib/kaomoji/processing/phase11/composition-audit";
import { runPhase11Pipeline } from "@/lib/kaomoji/processing/phase11/pipeline";
import { EXPECTED_RAW_BASELINE, AUTHORITATIVE_RAW_SHA256 } from "@/lib/kaomoji/processing/phase7/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { getKaomojiRawRecordsPath, getPhase11ManifestPath } from "@/lib/kaomoji/storage/paths";

describe("phase 11 composition audit", () => {
  it("RAW immutability sha256", () => {
    assert.equal(hashRawFile(getKaomojiRawRecordsPath(process.cwd())).sha256, AUTHORITATIVE_RAW_SHA256);
  });
  it("RAW count 236508", () => {
    assert.equal((JSON.parse(readFileSync(getKaomojiRawRecordsPath(process.cwd()), "utf8")) as unknown[]).length, EXPECTED_RAW_BASELINE);
  });
  it("full pipeline analysis only", () => {
    const { manifest } = runPhase11Pipeline(process.cwd());
    assert.equal(manifest.raw_removed, 0);
    assert.equal(manifest.raw_before, EXPECTED_RAW_BASELINE);
  });
  it("canonical count exactly 63811", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { canonical_candidates: number };
    // Live analysis layer tracks regenerated Phase 8 (236508 RAW). Frozen Phase 12/13 remains 63248.
    assert.equal(m.canonical_candidates, 63811);
  });
  it("public candidates 50994", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { public_candidates: number };
    assert.equal(m.public_candidates, 50994);
  });
  it("review 12751", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { review: number };
    assert.equal(m.review, 12751);
  });
  it("remove candidates 66", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { remove_candidates: number };
    assert.equal(m.remove_candidates, 66);
  });
  it("duplicate groups 52066", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { duplicate_groups: number };
    assert.equal(m.duplicate_groups, 52066);
  });
  it("variant groups 15146", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { variant_groups: number };
    assert.equal(m.variant_groups, 15146);
  });
  it("unique records 11745", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { unique_records: number };
    assert.equal(m.unique_records, 11745);
  });
  it("primary content types sum to canonical total", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { primary_content_type: Record<string, number>; canonical_candidates: number };
    const sum = Object.values(m.primary_content_type).reduce((a, b) => a + b, 0);
    assert.equal(sum, m.canonical_candidates);
  });
  it("canonical definition is explicit", () => {
    assert.ok(CANONICAL_CANDIDATE_DEFINITION.definition.includes("normalized_content"));
  });
  it("inventory has 63811 records", () => {
    const inv = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-11/composition/canonical-inventory.json"), "utf8")) as unknown[];
    assert.equal(inv.length, 63811);
  });
  it("no popularity fabrication", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { popularity_status: string };
    assert.equal(m.popularity_status, "INSUFFICIENT_DATA");
  });
  it("curation totals match", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { curation: Record<string, number>; canonical_candidates: number };
    const sum = Object.values(m.curation).reduce((a, b) => a + b, 0);
    assert.equal(sum, m.canonical_candidates);
  });
  it("publication totals match", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { publication: Record<string, number>; canonical_candidates: number };
    const sum = Object.values(m.publication).reduce((a, b) => a + b, 0);
    assert.equal(sum, m.canonical_candidates);
  });
  it("quality buckets sum to canonical", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { quality_buckets: Record<string, number>; canonical_candidates: number };
    const sum = Object.values(m.quality_buckets).reduce((a, b) => a + b, 0);
    assert.equal(sum, m.canonical_candidates);
  });
  it("unique composition totals 11745", () => {
    const u = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-11/composition/unique-composition.json"), "utf8")) as { total: number };
    assert.equal(u.total, 11745);
  });
  it("legitimate variants 2533", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { legitimate_variants: number };
    assert.equal(m.legitimate_variants, 2533);
  });
  it("phase 8 unchanged", () => {
    const p8 = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8")) as { canonical_candidates: number };
    assert.equal(p8.canonical_candidates, 63811);
  });
  it("no raw modification", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { raw_modified: number };
    assert.equal(m.raw_modified, 0);
  });
  it("emotion breakdown exists", () => {
    const e = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-11/composition/emotion-breakdown.json"), "utf8"));
    assert.ok(typeof e === "object");
  });
  it("style breakdown exists", () => {
    const s = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-11/composition/style-breakdown.json"), "utf8")) as { primary: object };
    assert.ok(Object.keys(s.primary).length > 0);
  });
  it("keep candidate 50994", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { curation: { KEEP_CANDIDATE: number } };
    assert.equal(m.curation.KEEP_CANDIDATE, 50994);
  });
  it("analysis does not delete data", () => {
    const raw = JSON.parse(readFileSync(getKaomojiRawRecordsPath(process.cwd()), "utf8")) as unknown[];
    assert.equal(raw.length, EXPECTED_RAW_BASELINE);
  });
});
