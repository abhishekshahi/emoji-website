const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");

fs.writeFileSync(path.join(root, "scripts/kaomoji/run-phase11.ts"), [
  'import { join } from "node:path";',
  'import { fileURLToPath } from "node:url";',
  'import { runPhase11Pipeline } from "@/lib/kaomoji/processing/phase11/pipeline";',
  '',
  'const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");',
  '',
  'function main(): void {',
  '  console.log("Phase 11 — canonical library composition audit (analysis only)");',
  '  const { manifest } = runPhase11Pipeline(rootDir);',
  '  console.log("\\n=== Phase 11 Complete ===");',
  '  console.log("RAW:", manifest.raw_before, "removed:", manifest.raw_removed);',
  '  console.log("Canonical:", manifest.canonical_candidates);',
  '  console.log("Public:", manifest.public_candidates);',
  '  console.log("Unique:", manifest.unique_records);',
  '}',
  'main();',
  '',
].join("\n"), "utf8");

const reports = [
  'import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";',
  'import { join } from "node:path";',
  'import { fileURLToPath } from "node:url";',
  'import type { Phase11Manifest } from "@/lib/kaomoji/processing/phase11/types";',
  'import { getPhase11ManifestPath } from "@/lib/kaomoji/storage/paths";',
  '',
  'const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");',
  'const exportDir = join(rootDir, "r2-export");',
  'const manifestDir = join(exportDir, "manifests");',
  '',
  'function readManifest(): Phase11Manifest {',
  '  const p = getPhase11ManifestPath(rootDir);',
  '  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase11 first");',
  '  return JSON.parse(readFileSync(p, "utf8")) as Phase11Manifest;',
  '}',
  '',
  'function write(name: string, body: string): void {',
  '  mkdirSync(exportDir, { recursive: true });',
  '  writeFileSync(join(exportDir, name), body, "utf8");',
  '  console.log("Wrote", name);',
  '}',
  '',
  'function main(): void {',
  '  const m = readManifest();',
  '  const verdict = m.raw_removed === 0 && m.raw_before === m.raw_after && m.errors.length === 0 ? "PASS" : "FAIL";',
  '  write("PHASE-11-CANONICAL-DEFINITION.md", "# Phase 11 Definition\\n\\n" + m.canonical_definition.definition + "\\n\\nCount: " + m.canonical_candidates);',
  '  write("PHASE-11-CONTENT-TYPE.md", "# Content Type\\n\\n" + JSON.stringify(m.primary_content_type, null, 2) + "\\n\\nSecondary labels: " + m.secondary_content_type_labels);',
  '  write("PHASE-11-STYLE.md", "# Style\\n\\n" + JSON.stringify(m.style_primary, null, 2));',
  '  write("PHASE-11-EMOTION.md", "# Emotion\\n\\n" + JSON.stringify(m.emotion, null, 2));',
  '  write("PHASE-11-RELATIONSHIP.md", "# Relationship\\n\\n" + JSON.stringify(m.relationship, null, 2));',
  '  write("PHASE-11-CUTE-KAWAII.md", "# Cute/Kawaii\\n\\n" + JSON.stringify(m.cute_kawaii, null, 2));',
  '  write("PHASE-11-ANIMALS.md", "# Animals\\n\\n" + JSON.stringify(m.animals, null, 2));',
  '  write("PHASE-11-ACTIONS.md", "# Actions\\n\\n" + JSON.stringify(m.actions, null, 2));',
  '  write("PHASE-11-VARIANTS.md", "# Variants\\n\\n" + JSON.stringify(m.variant_composition, null, 2));',
  '  write("PHASE-11-UNIQUE-RECORDS.md", "# Unique\\n\\n" + JSON.stringify(m.unique_composition, null, 2));',
  '  write("PHASE-11-QUALITY.md", "# Quality\\n\\n" + JSON.stringify(m.quality_buckets, null, 2));',
  '  write("PHASE-11-SCORES.md", "# Scores\\n\\nBeauty: " + JSON.stringify(m.beauty_distribution) + "\\nOverall: " + JSON.stringify(m.overall_distribution));',
  '  write("PHASE-11-PUBLICATION.md", "# Publication\\n\\n" + JSON.stringify(m.publication, null, 2));',
  '  write("PHASE-11-NO-LOSS.md", "# No Loss\\n\\nRAW: " + m.raw_before + " -> " + m.raw_after);',
  '  write("PHASE-11-FINAL.md", "# Phase 11 Final\\n\\n**Verdict: " + verdict + "**\\n\\nCanonical: " + m.canonical_candidates + "\\nPublic: " + m.public_candidates);',
  '  mkdirSync(manifestDir, { recursive: true });',
  '  writeFileSync(join(manifestDir, "phase-11-composition.json"), JSON.stringify(m, null, 2));',
  '  writeFileSync(join(manifestDir, "phase-11-final.json"), JSON.stringify(m, null, 2));',
  '  console.log("Verdict:", verdict);',
  '}',
  'main();',
  '',
].join("\n");

fs.writeFileSync(path.join(root, "scripts/kaomoji/write-phase11-reports.ts"), reports, "utf8");

const test = `import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { CANONICAL_CANDIDATE_DEFINITION } from "@/lib/kaomoji/processing/phase11/composition-audit";
import { runPhase11Pipeline } from "@/lib/kaomoji/processing/phase11/pipeline";
import { EXPECTED_RAW_BASELINE } from "@/lib/kaomoji/processing/phase7/pipeline";
import { hashRawFile } from "@/lib/kaomoji/processing/phase7/raw-snapshot";
import { getKaomojiRawRecordsPath, getPhase7RawSnapshotPath, getPhase11ManifestPath } from "@/lib/kaomoji/storage/paths";

describe("phase 11 composition audit", () => {
  it("RAW immutability sha256", () => {
    const p7 = JSON.parse(readFileSync(getPhase7RawSnapshotPath(process.cwd()), "utf8")) as { file_sha256: string };
    assert.equal(hashRawFile(getKaomojiRawRecordsPath(process.cwd())).sha256, p7.file_sha256);
  });
  it("RAW count 232683", () => {
    assert.equal((JSON.parse(readFileSync(getKaomojiRawRecordsPath(process.cwd()), "utf8")) as unknown[]).length, EXPECTED_RAW_BASELINE);
  });
  it("full pipeline analysis only", () => {
    const { manifest } = runPhase11Pipeline(process.cwd());
    assert.equal(manifest.raw_removed, 0);
    assert.equal(manifest.raw_before, EXPECTED_RAW_BASELINE);
  });
  it("canonical count exactly 63248", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { canonical_candidates: number };
    assert.equal(m.canonical_candidates, 63248);
  });
  it("public candidates 50980", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { public_candidates: number };
    assert.equal(m.public_candidates, 50980);
  });
  it("review 12202", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { review: number };
    assert.equal(m.review, 12202);
  });
  it("remove candidates 66", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { remove_candidates: number };
    assert.equal(m.remove_candidates, 66);
  });
  it("duplicate groups 49885", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { duplicate_groups: number };
    assert.equal(m.duplicate_groups, 49885);
  });
  it("variant groups 15143", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { variant_groups: number };
    assert.equal(m.variant_groups, 15143);
  });
  it("unique records 13363", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { unique_records: number };
    assert.equal(m.unique_records, 13363);
  });
  it("primary content types sum to canonical total", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { primary_content_type: Record<string, number>; canonical_candidates: number };
    const sum = Object.values(m.primary_content_type).reduce((a, b) => a + b, 0);
    assert.equal(sum, m.canonical_candidates);
  });
  it("canonical definition is explicit", () => {
    assert.ok(CANONICAL_CANDIDATE_DEFINITION.definition.includes("normalized_content"));
  });
  it("inventory has 63248 records", () => {
    const inv = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-11/composition/canonical-inventory.json"), "utf8")) as unknown[];
    assert.equal(inv.length, 63248);
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
  it("unique composition totals 13363", () => {
    const u = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-11/composition/unique-composition.json"), "utf8")) as { total: number };
    assert.equal(u.total, 13363);
  });
  it("legitimate variants 2533", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { legitimate_variants: number };
    assert.equal(m.legitimate_variants, 2533);
  });
  it("phase 8 unchanged", () => {
    const p8 = JSON.parse(readFileSync(join(process.cwd(), "data/kaomoji/processed/phase-8/manifests/phase-8-final.json"), "utf8")) as { canonical_candidates: number };
    assert.equal(p8.canonical_candidates, 63248);
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
  it("keep candidate 50980", () => {
    const m = JSON.parse(readFileSync(getPhase11ManifestPath(process.cwd()), "utf8")) as { curation: { KEEP_CANDIDATE: number } };
    assert.equal(m.curation.KEEP_CANDIDATE, 50980);
  });
  it("analysis does not delete data", () => {
    const raw = JSON.parse(readFileSync(getKaomojiRawRecordsPath(process.cwd()), "utf8")) as unknown[];
    assert.equal(raw.length, 232683);
  });
});
`;

fs.writeFileSync(path.join(root, "src/lib/kaomoji/kaomoji-phase11.test.ts"), test, "utf8");
console.log("batch3 scripts and tests done");
