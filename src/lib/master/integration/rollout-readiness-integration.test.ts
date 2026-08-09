import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  isMasterSearchIntegrationEnabled,
  isMasterSeoIntegrationEnabled,
  runWithIntegrationFlags,
  searchMasterIntegrated,
  searchProductionEmojis,
} from "@/lib/master/integration";
import { ROLLOUT_READINESS_PHASE } from "@/lib/master/integration/config";
import {
  ROLLOUT_BASELINES,
  buildRolloutReadinessPackage,
  classifySlugMismatch,
} from "@/lib/master/integration/rollout-readiness/build";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();
const searchable = [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];

describe("phase 8.12 rollout readiness audit", () => {
  const rolloutPackage = buildRolloutReadinessPackage(rootDir);

  it("keeps all feature flags disabled after rollout audit", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterSearchIntegrationEnabled(), false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  it("verifies production mapping 4486/4486", () => {
    assert.equal(rolloutPackage.productionMappingAudit.status, "PASS");
    assert.equal(rolloutPackage.productionMappingAudit.counts.total, PRODUCTION_BASELINES.totalSearchable);
    assert.equal(rolloutPackage.productionMappingAudit.counts.unmapped, 0);
  });

  it("verifies frozen release integrity", () => {
    const checksums = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
    ) as FileChecksumEntry[];
    const result = verifyFrozenChecksums(rootDir, checksums);
    assert.equal(result.status, "PASS");
    assert.equal(rolloutPackage.rolloutReadinessAudit.frozenRelease, "PASS");
  });

  it("passes artwork rollout audit", () => {
    assert.equal(rolloutPackage.artworkRolloutAudit.status, "PASS");
    assert.equal(rolloutPackage.artworkRolloutAudit.counts.productionRecords, 4486);
  });

  it("passes metadata provenance rollout audit", () => {
    assert.equal(rolloutPackage.metadataRolloutAudit.status, "PASS");
    assert.equal(rolloutPackage.metadataRolloutAudit.checks.unicodeNamingAuthority, true);
    assert.equal(rolloutPackage.metadataRolloutAudit.checks.notoUnavailable, true);
  });

  it("passes search rollout safety with hot ambiguity", () => {
    assert.equal(rolloutPackage.searchRolloutAudit.status, "PASS");
    assert.equal(rolloutPackage.searchRolloutAudit.checks.hotAmbiguous, true);
    assert.equal(rolloutPackage.searchRolloutAudit.checks.hotNotFireOnly, true);
    runWithIntegrationFlags({ masterSearchEnabled: true }, () => {
      const hot = searchMasterIntegrated("hot", rootDir, 20);
      assert.ok(hot.results.length > 1);
    });
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
  });

  it("verifies SEO slug mismatch counts independently", () => {
    assert.equal(rolloutPackage.seoMigrationAudit.status, "PASS");
    assert.equal(rolloutPackage.seoMigrationAudit.counts.mismatches, ROLLOUT_BASELINES.expectedSlugMismatches);
    assert.equal(rolloutPackage.seoMigrationAudit.counts.totalSlugIssues, ROLLOUT_BASELINES.expectedSlugIssues);
    assert.equal(rolloutPackage.seoMigrationAudit.counts.duplicateSlugCollisions, 0);
  });

  it("classifies slug mismatches without auto-migration", () => {
    assert.equal(rolloutPackage.slugMismatchClassification.status, "PASS");
    assert.equal(rolloutPackage.slugMismatchClassification.counts.slugMismatches, 2934);
    const extraMismatch = classifySlugMismatch(
      "unicode:1F525",
      "extra-fire",
      "fire",
      "extra",
    );
    assert.equal(extraMismatch, "route-compatibility-issue");
  });

  it("passes sitemap safety audit", () => {
    assert.equal(rolloutPackage.sitemapAudit.status, "PASS");
    assert.equal(
      rolloutPackage.sitemapAudit.counts["existing-production-page"],
      ROLLOUT_BASELINES.sitemapEligible,
    );
  });

  it("passes indexation safety audit", () => {
    assert.equal(rolloutPackage.indexationSafetyAudit.status, "PASS");
  });

  it("passes client/server isolation checks", () => {
    assert.equal(rolloutPackage.performanceRolloutAudit.checks.noNodeFsInClient, true);
    assert.equal(rolloutPackage.performanceRolloutAudit.checks.noMasterReaderInClient, true);
    assert.equal(rolloutPackage.performanceRolloutAudit.checks.noExternalFetch, true);
  });

  it("restores production behavior after rollback audit", () => {
    assert.equal(rolloutPackage.rollbackAudit.status, "PASS");
    const productionSearch = searchEmojis(searchable, "fire", 5);
    const bridgedSearch = searchProductionEmojis(searchable, "fire", 5);
    assert.deepEqual(
      productionSearch.map((entry) => entry.emoji.hexcode),
      bridgedSearch.map((entry) => entry.emoji.hexcode),
    );
  });

  it("records risk register and rollout recommendation", () => {
    assert.equal(rolloutPackage.riskRegister.risks.length > 0, true);
    assert.equal(
      rolloutPackage.rolloutRecommendation.conclusion,
      "READY AFTER REQUIRED FIXES",
    );
    assert.ok(rolloutPackage.rolloutRecommendation.blockers.length > 0);
  });

  it("passes overall rollout readiness audit package", () => {
    assert.equal(rolloutPackage.rolloutReadinessAudit.phase, ROLLOUT_READINESS_PHASE);
    assert.equal(rolloutPackage.rolloutReadinessAudit.releaseId, "master-8.10-20260809");
    assert.equal(rolloutPackage.rolloutReadinessAudit.status, "PASS");
    assert.equal((emojis as BrowsableEmoji[]).length, 3944);
    assert.equal((extras as BrowsableEmoji[]).length, 542);
  });
});
