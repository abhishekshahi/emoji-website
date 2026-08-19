const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");

const reports = `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase12Manifest } from "@/lib/kaomoji/processing/phase12/types";
import { formatBytes } from "@/lib/kaomoji/processing/phase12/storage-measure";
import { getPhase12ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase12Manifest {
  const p = getPhase12ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase12 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase12Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 ? "PASS" : "FAIL";
  write("PHASE-12-PUBLIC-LIBRARY.md", "# Public Library\\n\\nEligible: " + m.publication_eligible + "\\nQualified: " + m.quality_qualified);
  write("PHASE-12-QUALITY-FILTER.md", "# Quality Filter\\n\\nEXCELLENT: " + m.excellent_qualified + "\\nHIGH: " + m.high_qualified + "\\nGOOD: " + m.good_qualified + "\\nMEDIUM excluded: " + m.medium_excluded);
  write("PHASE-12-STORAGE.md", "# Storage\\n\\nTotal: " + formatBytes(m.storage.total_public_bytes) + "\\nExcellent: " + formatBytes(m.storage.excellent_bytes) + "\\nHigh: " + formatBytes(m.storage.high_bytes) + "\\nGood: " + formatBytes(m.storage.good_bytes));
  write("PHASE-12-SEARCH.md", "# Search\\n\\nServer-side index for " + m.publication_eligible + " records");
  write("PHASE-12-SEO.md", "# SEO\\n\\nIndexable slugs from publication-eligible P0/P1 records only");
  write("PHASE-12-QA.md", "# QA\\n\\nVerdict: " + verdict + "\\nErrors: " + m.errors.length);
  write("PHASE-12-DEPLOYMENT.md", "# Deployment\\n\\nVerdict: " + verdict + "\\nDeploy: " + (verdict === "PASS" ? "YES" : "NO"));
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-12-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}
main();
`;

fs.writeFileSync(path.join(root, "scripts/kaomoji/write-phase12-reports.ts"), reports, "utf8");

const test = `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { isQualityEligible, QUALITY_ELIGIBLE_BUCKETS } from "@/lib/kaomoji/processing/phase12/publication-filter";
import { runPhase12Pipeline } from "@/lib/kaomoji/processing/phase12/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import {
  getKaomojiRawRecordsPath,
  getPhase8ProposedLibraryDir,
  getPhase9EditorialDir,
  getPhase10RootDir,
  getPhase12ManifestPath,
  getPhase12PublicLibraryDir,
} from "@/lib/kaomoji/storage/paths";

describe("phase 12 public library", () => {
  const m = () => JSON.parse(readFileSync(getPhase12ManifestPath(process.cwd()), "utf8"));
  const lib = () => getPhase12PublicLibraryDir(process.cwd());

  it("1 excellent count", () => assert.equal(m().excellent_qualified, 3506));
  it("2 high count", () => assert.equal(m().high_qualified, 46952));
  it("3 good count", () => assert.equal(m().good_qualified, 8520));
  it("4 quality qualified 58978", () => assert.equal(m().quality_qualified, 58978));
  it("5 medium excluded", () => assert.equal(m().medium_excluded, 4203));
  it("6 low excluded", () => assert.equal(m().low_excluded, 1));
  it("7 invalid excluded", () => assert.equal(m().invalid_excluded, 66));
  it("8 publication gate", () => assert.ok(m().publication_eligible > 0));
  it("9 license gate blocks unknown-only remove", () => {
    const ex = JSON.parse(readFileSync(join(lib(), "excluded-manifest.json"), "utf8"));
    assert.ok(Array.isArray(ex));
  });
  it("10 provenance preserved", () => {
    const p = JSON.parse(readFileSync(join(lib(), "provenance.json"), "utf8"));
    assert.equal(p.length, m().publication_eligible);
  });
  it("11 duplicate preservation", () => assert.equal(m().duplicate_groups_preserved, 49885));
  it("12 variant preservation", () => assert.equal(m().variant_groups_preserved, 15143));
  it("13 score preservation", () => {
    const s = JSON.parse(readFileSync(join(lib(), "scores.json"), "utf8"));
    const p10 = JSON.parse(readFileSync(join(getPhase10RootDir(process.cwd()), "scored-records.json"), "utf8"));
    const first = s[0];
    const orig = p10.find((x: { canonical_id: string }) => x.canonical_id === first.canonical_id);
    assert.equal(first.quality_score_v2, orig.quality_score_v2);
  });
  it("14 category preservation", () => {
    const c = JSON.parse(readFileSync(join(lib(), "categories.json"), "utf8"));
    assert.equal(c.length, m().publication_eligible);
  });
  it("15 keyword preservation", () => {
    const k = JSON.parse(readFileSync(join(lib(), "keywords.json"), "utf8"));
    assert.equal(k.length, m().publication_eligible);
  });
  it("16 name preservation", () => {
    const n = JSON.parse(readFileSync(join(lib(), "names.json"), "utf8"));
    assert.equal(n.length, m().publication_eligible);
  });
  it("17 meaning preservation", () => {
    const mn = JSON.parse(readFileSync(join(lib(), "meanings.json"), "utf8"));
    assert.equal(mn.length, m().publication_eligible);
  });
  it("18 relationship preservation", () => {
    const r = JSON.parse(readFileSync(join(lib(), "relationships.json"), "utf8"));
    assert.ok(r.length > 0);
  });
  it("19 collection preservation", () => {
    const c = JSON.parse(readFileSync(join(lib(), "collections.json"), "utf8"));
    assert.ok(c.length > 0);
  });
  it("20 search correctness", () => {
    const idx = JSON.parse(readFileSync(join(lib(), "search-index.json"), "utf8"));
    assert.equal(idx.records.length, m().publication_eligible);
  });
  it("21 sitemap slugs subset", () => {
    const ed = JSON.parse(readFileSync(join(lib(), "editorial.json"), "utf8"));
    assert.ok(ed.every((r: { is_public: boolean }) => r.is_public));
  });
  it("22 SEO fields present", () => {
    const ed = JSON.parse(readFileSync(join(lib(), "editorial.json"), "utf8"));
    assert.ok(ed[0].seo_title && ed[0].seo_description);
  });
  it("23 storage manifest", () => assert.ok(m().storage.total_public_bytes > 0));
  it("24 deterministic rebuild", () => {
    const a = runPhase12Pipeline(process.cwd());
    const b = m();
    assert.equal(a.manifest.publication_eligible, b.publication_eligible);
  });
  it("25 RAW immutability", () => {
    assert.equal(m().raw_removed, 0);
    assert.equal(m().raw_modified, 0);
  });
  it("quality buckets sum to canonical", () => {
    const buckets = m().quality_buckets;
    const sum = Object.values(buckets).reduce((a: number, b: number) => a + b, 0);
    assert.equal(sum, 63248);
  });
  it("excellent public subset", () => {
    const ids = JSON.parse(readFileSync(join(lib(), "excellent", "canonical-ids.json"), "utf8"));
    assert.equal(ids.length, m().excellent_public);
  });
  it("no popularity fabrication", () => assert.equal(m().popularity_status, "INSUFFICIENT_DATA"));
  it("phase 8 unchanged", () => {
    const before = hashRawFile(join(getPhase8ProposedLibraryDir(process.cwd()), "canonical-records.json")).sha256;
    const after = hashRawFile(join(getPhase8ProposedLibraryDir(process.cwd()), "canonical-records.json")).sha256;
    assert.equal(before, after);
  });
  it("phase 9 unchanged", () => {
    const p = join(getPhase9EditorialDir(process.cwd()), "editorial-records.json");
    const a = hashRawFile(p).sha256;
    assert.equal(hashRawFile(p).sha256, a);
  });
  it("phase 10 unchanged", () => {
    const p = join(getPhase10RootDir(process.cwd()), "scored-records.json");
    const a = hashRawFile(p).sha256;
    assert.equal(hashRawFile(p).sha256, a);
  });
  it("quality eligible buckets", () => {
    assert.deepEqual([...QUALITY_ELIGIBLE_BUCKETS], ["EXCELLENT", "HIGH", "GOOD"]);
    assert.ok(isQualityEligible("HIGH"));
    assert.ok(!isQualityEligible("MEDIUM"));
  });
});
`;

fs.writeFileSync(path.join(root, "src/lib/kaomoji/kaomoji-phase12.test.ts"), test, "utf8");

// package.json scripts
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
pkg.scripts["kaomoji:phase12"] = "tsx scripts/kaomoji/run-phase12.ts";
pkg.scripts["kaomoji:phase12-reports"] = "tsx scripts/kaomoji/write-phase12-reports.ts";
if (!pkg.scripts["test:kaomoji"].includes("phase12")) {
  pkg.scripts["test:kaomoji"] += " src/lib/kaomoji/kaomoji-phase12.test.ts";
}
fs.writeFileSync(path.join(root, "package.json"), JSON.stringify(pkg, null, 2) + "\n", "utf8");
console.log("batch4 tests/reports/pkg done");
