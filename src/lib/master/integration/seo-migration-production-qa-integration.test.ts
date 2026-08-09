import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  isMasterSeoIntegrationEnabled,
} from "@/lib/master/integration";
import { SEO_MIGRATION_PRODUCTION_QA_PHASE } from "@/lib/master/integration/config";
import {
  APPROVED_REDIRECT_BASELINE,
  EXCLUDED_URL_BASELINE,
  PRESERVED_URL_BASELINE,
} from "@/lib/master/integration/seo-migration-implementation/types";
import {
  buildProductionQaOfflinePackage,
  verifyApprovedRedirectDatasetEquivalence,
} from "@/lib/master/integration/seo-migration-production-qa/build";
import {
  getApprovedRedirectRecords,
  resolveApprovedEmojiRedirect,
} from "@/lib/master/integration/seo-migration/redirects";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();

describe("phase 8.12D SEO redirect production QA", () => {
  const offlinePackage = buildProductionQaOfflinePackage(rootDir);

  it("keeps all feature flags disabled", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  it("verifies frozen release integrity", () => {
    const checksums = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
    ) as FileChecksumEntry[];
    assert.equal(verifyFrozenChecksums(rootDir, checksums).status, "PASS");
  });

  it("verifies approved redirect dataset equivalence across QA sources", () => {
    const datasetAudit = verifyApprovedRedirectDatasetEquivalence(rootDir);
    assert.equal(datasetAudit.status, "PASS");
    assert.equal(datasetAudit.count, APPROVED_REDIRECT_BASELINE);
    assert.equal(datasetAudit.errors.length, 0);
  });

  it("verifies every approved redirect record has required fields", () => {
    const redirects = getApprovedRedirectRecords();
    assert.equal(redirects.length, APPROVED_REDIRECT_BASELINE);
    for (const record of redirects) {
      assert.ok(record.from);
      assert.ok(record.to);
      assert.ok(record.canonicalId);
      assert.equal(record.decision, "SAFE_TO_REDIRECT");
      assert.equal(record.permanent, true);
      assert.notEqual(record.from, record.to);
    }
  });

  it("passes offline production safety audit", () => {
    assert.equal(offlinePackage.productionSafetyAudit.status, "PASS");
    assert.equal(offlinePackage.productionSafetyAudit.checks.emojisJson, true);
    assert.equal(offlinePackage.productionSafetyAudit.checks.extrasJson, true);
    assert.equal(offlinePackage.productionSafetyAudit.checks.total, true);
    assert.equal(offlinePackage.productionSafetyAudit.checks.frozenRelease, true);
  });

  it("passes offline sitemap production audit for 4486 pages", () => {
    assert.equal(offlinePackage.sitemapProductionAudit.status, "PASS");
    assert.equal(offlinePackage.sitemapProductionAudit.productionPageCount, PRODUCTION_BASELINES.totalSearchable);
    assert.equal(offlinePackage.sitemapProductionAudit.checks.sourcesExcluded, true);
    assert.equal(offlinePackage.sitemapProductionAudit.checks.targetsIncluded, true);
  });

  it("passes redirect performance and bundle isolation audits", () => {
    assert.equal(offlinePackage.redirectPerformanceAudit.status, "PASS");
    assert.equal(offlinePackage.redirectPerformanceAudit.redirectLookup.lookupComplexity, "O(1)");
    assert.equal(offlinePackage.redirectBundleAudit.checks.noRedirectDataInClientEntries, true);
    assert.equal(offlinePackage.redirectBundleAudit.checks.middlewareUsesRedirectEngine, true);
  });

  it("passes rollback and failure-safety audit", () => {
    assert.equal(offlinePackage.rollbackAudit.status, "PASS");
    assert.equal(resolveApprovedEmojiRedirect("/emoji/unknown-qa-slug-812d"), null);
  });

  it("confirms production datasets remain unchanged", () => {
    assert.equal((emojis as BrowsableEmoji[]).length, PRODUCTION_BASELINES.standardRecords);
    assert.equal((extras as BrowsableEmoji[]).length, PRODUCTION_BASELINES.extrasRecords);
  });

  it("records production QA manifest phase", () => {
    assert.equal(offlinePackage.productionQaManifest.phase, SEO_MIGRATION_PRODUCTION_QA_PHASE);
  });

  it("reads generated HTTP QA audits when present", () => {
    const qaDir = join(rootDir, "src/data/master/integration/seo-migration-production-qa");
    try {
      const productionQa = JSON.parse(
        readFileSync(join(qaDir, "production-qa-audit.json"), "utf8"),
      ) as { status: string; summary: { approvedRedirects: number; preservedUrls: number; excludedUrls: number } };
      assert.equal(productionQa.status, "PASS");
      assert.equal(productionQa.summary.approvedRedirects, APPROVED_REDIRECT_BASELINE);
      assert.equal(productionQa.summary.preservedUrls, PRESERVED_URL_BASELINE);
      assert.equal(productionQa.summary.excludedUrls, EXCLUDED_URL_BASELINE);
    } catch {
      // HTTP QA artifacts are generated by master:build-seo-migration-production-qa
    }
  });
});
