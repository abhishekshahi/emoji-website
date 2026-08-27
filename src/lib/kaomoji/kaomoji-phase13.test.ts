import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runPhase13Pipeline } from "@/lib/kaomoji/processing/phase13/pipeline";
import { auditRawDrift } from "@/lib/kaomoji/processing/phase13/raw-drift";
import { validatePublicContent } from "@/lib/kaomoji/processing/phase13/content-validation";
import { formatBytes } from "@/lib/kaomoji/processing/phase13/storage-audit";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import {
  getPhase12PublicQualityDir,
  getPhase13ManifestPath,
  getPhase13RootDir,
  getKaomojiRawRecordsPath,
} from "@/lib/kaomoji/storage/paths";

describe("phase 13 final audit", () => {
  const root = process.cwd();
  const m = () => JSON.parse(readFileSync(getPhase13ManifestPath(root), "utf8"));
  const lib = () => getPhase12PublicQualityDir(root);

  it("1 canonical 63248", () => assert.equal(m().canonical_candidates, 63248));
  it("2 quality qualified 63181", () => assert.equal(m().quality_qualified, 63181));
  it("3 public 51338", () => assert.equal(m().publication_eligible, 51338));
  it("4 excellent public 3046", () => assert.equal(m().excellent_public, 3046));
  it("5 high public 40357", () => assert.equal(m().high_public, 40357));
  it("6 good public 4306", () => assert.equal(m().good_public, 4306));
  it("7 medium public 3629", () => assert.equal(m().medium_public, 3629));
  it("8 low excluded 1", () => assert.equal(m().low_excluded, 1));
  it("9 invalid excluded 66", () => assert.equal(m().invalid_excluded, 66));
  it("10 publication blocked 11843", () => assert.equal(m().publication_blocked, 11843));
  it("11 raw current 236508", () => assert.equal(m().raw_after, 236508));
  it("12 raw drift 3825", () => assert.equal(m().raw_drift.drift, 3825));
  it("13 raw immutability", () => {
    assert.equal(m().raw_removed, 0);
    assert.equal(m().raw_modified, 0);
  });
  it("14 duplicate groups 49885", () => assert.equal(m().duplicate_groups, 49885));
  it("15 variant groups 15143", () => assert.equal(m().variant_groups, 15143));
  it("16 legitimate variants 2533", () => assert.equal(m().legitimate_variants, 2533));
  it("17 relationships 395833", () => assert.equal(m().relationships, 395833));
  it("18 provenance coverage 100pct", () => assert.equal(m().provenance_coverage_pct, 100));
  it("19 license audit present", () => assert.ok(Object.keys(m().license).length > 0));
  it("20 content validation mostly valid", () => {
    const cv = m().content_validation;
    assert.ok(cv.valid >= 50000);
    assert.equal(cv.valid + cv.review + cv.invalid, 51338);
  });
  it("21 search pass rate", () => assert.ok(m().search_pass_rate >= 0.9));
  it("22 storage public production", () => assert.ok(m().storage.public_production_bytes > 1000000));
  it("23 storage quality dataset", () => assert.ok(m().storage.quality_dataset_bytes > 1000000));
  it("24 storage full raw", () => assert.ok(m().storage.full_raw_bytes > 1000000));
  it("25 drift report file", () => {
    const p = join(getPhase13RootDir(root), "raw-drift", "drift-report.json");
    assert.ok(existsSync(p));
  });
  it("26 raw drift audit function", () => {
    const d = auditRawDrift(root);
    assert.equal(d.drift, 3825);
    assert.equal(d.outside_canonical_layer, 3825);
  });
  it("27 editorial all public", () => {
    const ed = JSON.parse(readFileSync(join(lib(), "editorial.json"), "utf8"));
    assert.equal(ed.length, 51338);
    assert.ok(ed.every((r: { is_public: boolean }) => r.is_public));
  });
  it("28 scores unchanged from phase10", () => {
    const s = JSON.parse(readFileSync(join(lib(), "scores.json"), "utf8"));
    assert.equal(s.length, 51338);
  });
  it("29 relationships file size", () => {
    const r = JSON.parse(readFileSync(join(lib(), "relationships.json"), "utf8"));
    assert.equal(r.length, 395833);
  });
  it("30 collections exist", () => {
    const c = JSON.parse(readFileSync(join(lib(), "collections.json"), "utf8"));
    assert.ok(c.length > 0);
  });
  it("31 search index records", () => {
    const idx = JSON.parse(readFileSync(join(lib(), "search-index.json"), "utf8"));
    assert.equal(idx.records.length, 51338);
  });
  it("32 categories count", () => {
    const c = JSON.parse(readFileSync(join(lib(), "categories.json"), "utf8"));
    assert.equal(c.length, 51338);
  });
  it("33 keywords count", () => {
    const k = JSON.parse(readFileSync(join(lib(), "keywords.json"), "utf8"));
    assert.equal(k.length, 51338);
  });
  it("34 names count", () => {
    const n = JSON.parse(readFileSync(join(lib(), "names.json"), "utf8"));
    assert.equal(n.length, 51338);
  });
  it("35 meanings count", () => {
    const mn = JSON.parse(readFileSync(join(lib(), "meanings.json"), "utf8"));
    assert.equal(mn.length, 51338);
  });
  it("36 content validation function", () => {
    const ed = JSON.parse(readFileSync(join(lib(), "editorial.json"), "utf8"));
    const cv = validatePublicContent(ed.slice(0, 500));
    assert.ok(cv.valid > 400);
  });
  it("37 format bytes helper", () => assert.ok(formatBytes(1048576).includes("MB")));
  it("38 manifest phase 13", () => assert.equal(m().phase, 13));
  it("39 no pipeline errors", () => assert.equal(m().errors.length, 0));
  it("40 deterministic rerun", () => {
    const before = m().publication_eligible;
    const after = runPhase13Pipeline(root).manifest.publication_eligible;
    assert.equal(before, after);
  });
  it("41 raw sha256 stable", () => {
    const p = getKaomojiRawRecordsPath(root);
    assert.equal(hashRawFile(p).sha256, "fcf0b80437171e933470e83d899821c5d7910c677c3431683d56199d1e670aaf");
  });
  it("42 cloudflare readiness doc after reports", () => {
    assert.ok(existsSync(join(root, "r2-export", "PHASE-13-CLOUDFLARE-READINESS.md")));
  });
});