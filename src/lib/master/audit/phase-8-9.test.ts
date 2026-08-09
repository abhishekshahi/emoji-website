import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { runPhase89Audit } from "@/lib/master/audit/phase-8-9";
import type { MasterIntegrityReport } from "@/lib/master/audit/types";

const rootDir = process.cwd();
const outputDir = join(rootDir, "src", "data", "master", "phase-8-9");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

describe("phase 8.9 master audit", () => {
  const result = runPhase89Audit(rootDir);
  const persisted = readJson<MasterIntegrityReport>(join(outputDir, "master-integrity-report.json"));

  it("runs audit without modifying data and produces PASS overall", () => {
    assert.equal(result.integrityReport.overallStatus, "PASS");
    assert.equal(persisted.overallStatus, "PASS");
    assert.equal(result.integrityReport.summary.fail, 0);
  });

  it("verifies master baselines independently", () => {
    assert.equal(result.countAudit.status, "PASS");
    assert.equal(result.countAudit.mismatches.length, 0);
    assert.equal(result.countAudit.calculated.rawSourceRecords, 72228);
    assert.equal(result.countAudit.calculated.canonicalIdentities, 6955);
    assert.equal(result.countAudit.calculated.masterMetadata, 42910);
    assert.equal(result.countAudit.calculated.emojinetSemantic, 15183);
    assert.equal(result.countAudit.calculated.emojinetDefinitions, 17572);
  });

  it("verifies artwork integrity baselines", () => {
    const artwork = result.integrityReport.sections.find((section) => section.name === "Artwork integrity");
    assert.ok(artwork);
    assert.equal(artwork.status, "PASS");
  });

  it("verifies semantic safety for hot term", () => {
    const semantic = result.integrityReport.sections.find((section) => section.name === "Semantic integrity");
    assert.ok(semantic);
    assert.equal(semantic.status, "PASS");
    const hotCheck = semantic.checks.find((check) => check.id === "semantic-hot-ambiguous");
    assert.ok(hotCheck);
    assert.equal(hotCheck.status, "PASS");
  });

  it("verifies cross-layer referential integrity", () => {
    assert.equal(result.referenceIntegrity.status, "PASS");
    assert.equal(result.referenceIntegrity.totals.missingReferences, 0);
    assert.equal(result.referenceIntegrity.totals.invalidReferences, 0);
  });

  it("verifies production safety", () => {
    assert.equal(result.productionSafetyAudit.status, "PASS");
    assert.equal(result.productionSafetyAudit.productionFiles[0].recordCount, 3944);
    assert.equal(result.productionSafetyAudit.productionFiles[1].recordCount, 542);
  });

  it("verifies emoji spot checks for critical identities", () => {
    const fire = result.emojiSpotChecks.find((check) => check.label === "fire");
    const pua = result.emojiSpotChecks.find((check) => check.label === "OpenMoji private-use");
    assert.ok(fire);
    assert.equal(fire.identity, "PASS");
    assert.equal(fire.search, "PASS");
    assert.equal(fire.seo, "PASS");
    assert.ok(pua);
    assert.equal(pua.identity, "PASS");
    assert.equal(pua.canonicalId, "source:openmoji:E000");
  });

  it("verifies no raw data loss across phases", () => {
    assert.equal(result.dataLossAudit.status, "PASS");
  });

  it("audits 676 semantic-difference conflicts", () => {
    assert.equal(result.countAudit.calculated.semanticDifferenceConflicts, 676);
  });
});
