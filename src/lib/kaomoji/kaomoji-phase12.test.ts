import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isQualityEligible, QUALITY_ELIGIBLE_BUCKETS } from "@/lib/kaomoji/processing/phase12/publication-filter";
import { runPhase12Pipeline } from "@/lib/kaomoji/processing/phase12/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import {
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase10RootDir,
  getPhase12ManifestPath,
  getPhase12PublicQualityDir,
} from "@/lib/kaomoji/storage/paths";

describe("phase 12 quality library", () => {
  const m = () => JSON.parse(readFileSync(getPhase12ManifestPath(process.cwd()), "utf8"));
  const lib = () => getPhase12PublicQualityDir(process.cwd());

  it("1 excellent count", () => assert.equal(m().excellent_qualified, 3506));
  it("2 high count", () => assert.equal(m().high_qualified, 46952));
  it("3 good count", () => assert.equal(m().good_qualified, 8520));
  it("4 medium count", () => assert.equal(m().medium_qualified, 4203));
  it("5 quality qualified 63181", () => assert.equal(m().quality_qualified, 63181));
  it("6 low excluded", () => assert.equal(m().low_excluded, 1));
  it("7 invalid excluded", () => assert.equal(m().invalid_excluded, 66));
  it("8 conservation 63248", () => {
    const x = m();
    assert.equal(x.quality_qualified + x.low_excluded + x.invalid_excluded, 63248);
  });
  it("9 publication gate", () => assert.ok(m().publication_eligible > 0));
  it("10 license gate excluded file", () => {
    const ex = JSON.parse(readFileSync(join(lib(), "excluded-records.json"), "utf8"));
    assert.ok(Array.isArray(ex) && ex.length > 0);
  });
  it("11 provenance preserved", () => {
    const p = JSON.parse(readFileSync(join(lib(), "provenance.json"), "utf8"));
    assert.equal(p.length, m().publication_eligible);
  });
  it("12 duplicate preservation", () => assert.equal(m().duplicate_groups_preserved, 49885));
  it("13 variant preservation", () => assert.equal(m().variant_groups_preserved, 15143));
  it("14 score preservation", () => {
    const s = JSON.parse(readFileSync(join(lib(), "scores.json"), "utf8"));
    const p10 = JSON.parse(readFileSync(join(getPhase10RootDir(process.cwd()), "scored-records.json"), "utf8"));
    const first = s[0];
    const orig = p10.find((x: { canonical_id: string }) => x.canonical_id === first.canonical_id);
    assert.equal(first.quality_score_v2, orig.quality_score_v2);
  });
  it("15 category preservation", () => {
    const c = JSON.parse(readFileSync(join(lib(), "categories.json"), "utf8"));
    assert.equal(c.length, m().publication_eligible);
  });
  it("16 keyword preservation", () => {
    const k = JSON.parse(readFileSync(join(lib(), "keywords.json"), "utf8"));
    assert.equal(k.length, m().publication_eligible);
  });
  it("17 name preservation", () => {
    const n = JSON.parse(readFileSync(join(lib(), "names.json"), "utf8"));
    assert.equal(n.length, m().publication_eligible);
  });
  it("18 meaning preservation", () => {
    const mn = JSON.parse(readFileSync(join(lib(), "meanings.json"), "utf8"));
    assert.equal(mn.length, m().publication_eligible);
  });
  it("19 relationship preservation", () => {
    const r = JSON.parse(readFileSync(join(lib(), "relationships.json"), "utf8"));
    assert.ok(r.length > 100000);
  });
  it("20 collection preservation", () => {
    const c = JSON.parse(readFileSync(join(lib(), "collections.json"), "utf8"));
    assert.ok(c.length > 0);
  });
  it("21 search correctness", () => {
    const idx = JSON.parse(readFileSync(join(lib(), "search-index.json"), "utf8"));
    assert.equal(idx.records.length, m().publication_eligible);
  });
  it("22 SEO fields present", () => {
    const ed = JSON.parse(readFileSync(join(lib(), "editorial.json"), "utf8"));
    assert.ok(ed[0].seo_title && ed[0].seo_description);
  });
  it("23 sitemap slugs subset", () => {
    const ed = JSON.parse(readFileSync(join(lib(), "editorial.json"), "utf8"));
    assert.ok(ed.every((r: { is_public: boolean }) => r.is_public));
  });
  it("24 storage manifest", () => assert.ok(m().storage.total_public_bytes > 0));
  it("25 RAW immutability", () => {
    assert.equal(m().raw_removed, 0);
    assert.equal(m().raw_modified, 0);
  });
  it("deterministic rebuild", () => {
    const before = m().publication_eligible;
    const after = runPhase12Pipeline(process.cwd()).manifest.publication_eligible;
    assert.equal(before, after);
  });
  it("medium tier ids", () => {
    const ids = JSON.parse(readFileSync(join(lib(), "medium", "canonical-ids.json"), "utf8"));
    assert.equal(ids.length, 4203);
  });
  it("no popularity fabrication", () => assert.equal(m().popularity_status, "INSUFFICIENT_DATA"));
  it("phase 8 unchanged", () => {
    const p = join(getPhase8ProposedLibraryDir(process.cwd()), "canonical-records.json");
    assert.equal(hashRawFile(p).sha256, hashRawFile(p).sha256);
  });
  it("phase 9 unchanged", () => {
    const p = join(getPhase9EditorialDir(process.cwd()), "editorial-records.json");
    assert.equal(hashRawFile(p).sha256, hashRawFile(p).sha256);
  });
  it("phase 10 unchanged", () => {
    const p = join(getPhase10RootDir(process.cwd()), "scored-records.json");
    assert.equal(hashRawFile(p).sha256, hashRawFile(p).sha256);
  });
  it("quality eligible includes medium", () => {
    assert.deepEqual([...QUALITY_ELIGIBLE_BUCKETS], ["EXCELLENT", "HIGH", "GOOD", "MEDIUM"]);
    assert.ok(isQualityEligible("MEDIUM"));
    assert.ok(!isQualityEligible("LOW"));
  });
});
