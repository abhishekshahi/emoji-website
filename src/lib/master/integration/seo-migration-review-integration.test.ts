import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  MASTER_INTEGRATION_CONFIG,
  isMasterSearchIntegrationEnabled,
  isMasterSeoIntegrationEnabled,
} from "@/lib/master/integration";
import { SEO_MIGRATION_REVIEW_PHASE } from "@/lib/master/integration/config";
import { SEO_MIGRATION_BASELINES } from "@/lib/master/integration/seo-migration/build";
import {
  SEO_MIGRATION_REVIEW_BASELINES,
  buildSeoMigrationReviewPackage,
} from "@/lib/master/integration/seo-migration-review/build";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();

describe("phase 8.12B SEO migration review and decision audit", () => {
  const reviewPackage = buildSeoMigrationReviewPackage(rootDir);

  it("keeps all feature flags disabled after SEO review audit", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterSearchIntegrationEnabled(), false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  it("verifies frozen release integrity", () => {
    const checksums = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
    ) as FileChecksumEntry[];
    assert.equal(verifyFrozenChecksums(rootDir, checksums).status, "PASS");
  });

  it("assigns exactly one decision to all 2934 mismatches", () => {
    assert.equal(reviewPackage.finalMigrationMatrix.status, "PASS");
    assert.equal(reviewPackage.finalMigrationMatrix.mismatchCount, SEO_MIGRATION_REVIEW_BASELINES.totalMismatches);
    const canonicalIds = new Set(reviewPackage.finalMigrationMatrix.entries.map((entry) => entry.canonicalId));
    assert.equal(canonicalIds.size, SEO_MIGRATION_REVIEW_BASELINES.totalMismatches);
    for (const entry of reviewPackage.finalMigrationMatrix.entries) {
      assert.ok(entry.decision.length > 0);
      assert.ok(entry.reason.length > 0);
    }
  });

  it("classifies all 131 manual-review cases explicitly", () => {
    assert.equal(reviewPackage.manualReviewDecisions.status, "PASS");
    assert.equal(reviewPackage.manualReviewDecisions.count, SEO_MIGRATION_REVIEW_BASELINES.manualReview);
    const total = Object.values(reviewPackage.manualReviewDecisions.byDecision).reduce(
      (sum, count) => sum + count,
      0,
    );
    assert.equal(total, SEO_MIGRATION_REVIEW_BASELINES.manualReview);
  });

  it("classifies all 179 extras cases explicitly", () => {
    assert.equal(reviewPackage.extrasMigrationDecisions.status, "PASS");
    assert.equal(reviewPackage.extrasMigrationDecisions.count, SEO_MIGRATION_REVIEW_BASELINES.extrasCompatibility);
    assert.equal(
      reviewPackage.extrasMigrationDecisions.byDecision.KEEP_EXTRA_URL,
      SEO_MIGRATION_REVIEW_BASELINES.extrasCompatibility,
    );
  });

  it("classifies all 363 source-specific cases explicitly", () => {
    assert.equal(reviewPackage.sourceSpecificDecisions.status, "PASS");
    assert.equal(reviewPackage.sourceSpecificDecisions.count, SEO_MIGRATION_REVIEW_BASELINES.sourceSpecific);
    assert.equal(
      reviewPackage.sourceSpecificDecisions.byDecision.KEEP_SOURCE_URL +
        (reviewPackage.sourceSpecificDecisions.byDecision.DO_NOT_MIGRATE ?? 0),
      SEO_MIGRATION_REVIEW_BASELINES.sourceSpecific,
    );
    for (const entry of reviewPackage.sourceSpecificDecisions.entries) {
      assert.notEqual(entry.decision, "SAFE_TO_REDIRECT");
    }
  });

  it("keeps variation-selector identities at current URLs", () => {
    const variationCases = reviewPackage.manualReviewDecisions.entries.filter(
      (entry) => entry.reviewReason === "variation-selector",
    );
    assert.ok(variationCases.length > 0);
    for (const entry of variationCases) {
      assert.equal(entry.decision, "KEEP_CURRENT_URL");
      assert.equal(entry.hasVariationSelector, true);
    }
  });

  it("keeps flag identities with degraded proposed slugs at current URLs", () => {
    const aland = reviewPackage.manualReviewDecisions.entries.find((entry) =>
      entry.currentSlug.includes("aland"),
    );
    if (aland) {
      assert.equal(aland.decision, "KEEP_CURRENT_URL");
    }
    const flagCases = reviewPackage.manualReviewDecisions.entries.filter((entry) => entry.reviewReason === "flag");
    assert.equal(flagCases.length, 19);
    for (const entry of flagCases) {
      assert.ok(entry.decision === "KEEP_CURRENT_URL" || entry.decision === "REQUIRES_MANUAL_CONTENT_REVIEW");
    }
  });

  it("preserves distinct smiling-face variation identities in migration matrix", () => {
    const smilingFe0f = reviewPackage.finalMigrationMatrix.entries.find(
      (entry) => entry.canonicalId === "unicode:263A-FE0F",
    );
    assert.ok(smilingFe0f);
    assert.equal(smilingFe0f.decision, "SAFE_TO_REDIRECT");
    assert.notEqual(smilingFe0f.currentUrl, smilingFe0f.proposedUrl);
    const unicode263a = reviewPackage.finalMigrationMatrix.entries.find(
      (entry) => entry.canonicalId === "unicode:263A",
    );
    if (unicode263a) {
      assert.notEqual(unicode263a.canonicalId, smilingFe0f.canonicalId);
    }
  });

  it("verifies redirect approval candidates have no safety violations", () => {
    assert.equal(reviewPackage.redirectApprovalCandidates.status, "PASS");
    assert.equal(reviewPackage.redirectApprovalCandidates.checks.noRedirectLoops, true);
    assert.equal(reviewPackage.redirectApprovalCandidates.checks.noRedirectChains, true);
    assert.equal(reviewPackage.redirectApprovalCandidates.checks.noDuplicateTargets, true);
    assert.equal(reviewPackage.redirectApprovalCandidates.checks.noCrossIdentityRedirects, true);
    assert.equal(reviewPackage.redirectApprovalCandidates.checks.noSelfRedirects, true);
    assert.equal(reviewPackage.redirectApprovalCandidates.redirectLoops, 0);
    assert.equal(reviewPackage.redirectApprovalCandidates.redirectChains, 0);
  });

  it("resolves all 673 deferred cases from phase 8.12A", () => {
    assert.equal(reviewPackage.seoReviewAudit.status, "PASS");
    assert.equal(reviewPackage.seoReviewAudit.checks.deferredCasesResolved, true);
    assert.equal(reviewPackage.seoReviewAudit.checks.manualReviewResolved, true);
    assert.equal(reviewPackage.seoReviewAudit.checks.extrasResolved, true);
    assert.equal(reviewPackage.seoReviewAudit.checks.sourceSpecificResolved, true);
  });

  it("defines canonical SEO policies without enabling implementation", () => {
    assert.equal(reviewPackage.canonicalPolicy.status, "PASS");
    assert.ok(reviewPackage.canonicalPolicy.policies.variationSelectors.rule.includes("Never merge"));
    assert.equal(reviewPackage.canonicalPolicy.policies.extras.defaultDecision, "KEEP_EXTRA_URL");
    assert.equal(reviewPackage.canonicalPolicy.policies.sourceSpecificIdentities.defaultDecision, "KEEP_SOURCE_URL");
    assert.equal(reviewPackage.canonicalPolicy.implementationAllowed, false);
  });

  it("confirms production URLs remain unchanged", () => {
    const productionUrls = new Set([
      ...(emojis as { slug: string }[]).map((emoji) => `/emoji/${emoji.slug}`),
      ...(extras as { slug: string }[]).map((emoji) => `/emoji/${emoji.slug}`),
    ]);
    assert.equal(productionUrls.size, SEO_MIGRATION_BASELINES.productionPages);
    assert.equal(reviewPackage.seoReviewAudit.checks.productionUrlsUnchanged, true);
  });

  it("provides final SEO review recommendation", () => {
    assert.equal(reviewPackage.seoReviewRecommendation.status, "PASS");
    assert.equal(reviewPackage.seoReviewRecommendation.conclusion, "READY FOR HUMAN APPROVAL");
    assert.equal(reviewPackage.seoReviewRecommendation.implementationAllowed, false);
    assert.ok(reviewPackage.seoReviewRecommendation.safeRedirectCandidates > SEO_MIGRATION_BASELINES.safeRedirect);
  });

  it("records audit phase in manifest", () => {
    assert.equal(reviewPackage.seoReviewManifest.phase, SEO_MIGRATION_REVIEW_PHASE);
    assert.equal(reviewPackage.seoReviewManifest.auditOnly, true);
  });
});
