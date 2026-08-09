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
import { SEO_MIGRATION_PHASE } from "@/lib/master/integration/config";
import {
  SEO_MIGRATION_BASELINES,
  buildSeoMigrationPackage,
  mapRolloutToSeoClassification,
} from "@/lib/master/integration/seo-migration/build";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();

describe("phase 8.12A SEO redirect and URL migration planning", () => {
  const migrationPackage = buildSeoMigrationPackage(rootDir);

  it("keeps all feature flags disabled after SEO migration audit", () => {
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
    const result = verifyFrozenChecksums(rootDir, checksums);
    assert.equal(result.status, "PASS");
  });

  it("builds a complete redirect inventory for all 2934 mismatches", () => {
    assert.equal(migrationPackage.redirectInventory.status, "PASS");
    assert.equal(migrationPackage.redirectInventory.mismatchCount, SEO_MIGRATION_BASELINES.slugMismatches);
    assert.equal(migrationPackage.redirectInventory.totalEntries, SEO_MIGRATION_BASELINES.productionPages);
  });

  it("classifies every mismatch correctly", () => {
    const counts = migrationPackage.redirectInventory.counts.mismatches;
    assert.equal(counts.SAFE_REDIRECT, SEO_MIGRATION_BASELINES.safeRedirect);
    assert.equal(counts.MANUAL_REVIEW, SEO_MIGRATION_BASELINES.manualReview);
    assert.equal(counts.EXTRAS_COMPATIBILITY, SEO_MIGRATION_BASELINES.extrasCompatibility);
    assert.equal(counts.SOURCE_SPECIFIC, SEO_MIGRATION_BASELINES.sourceSpecific);
    assert.equal(counts.UNSAFE, SEO_MIGRATION_BASELINES.unsafe);
  });

  it("maps rollout classifications to SEO classifications", () => {
    assert.equal(mapRolloutToSeoClassification("safe-redirect-candidate"), "SAFE_REDIRECT");
    assert.equal(mapRolloutToSeoClassification("requires-manual-review"), "MANUAL_REVIEW");
    assert.equal(mapRolloutToSeoClassification("route-compatibility-issue"), "EXTRAS_COMPATIBILITY");
    assert.equal(mapRolloutToSeoClassification("source-specific"), "SOURCE_SPECIFIC");
    assert.equal(mapRolloutToSeoClassification("safe-no-op"), "NO_REDIRECT_REQUIRED");
    assert.equal(mapRolloutToSeoClassification("unsafe-to-migrate"), "UNSAFE");
  });

  it("ensures every production page has one current URL", () => {
    const entries = migrationPackage.redirectInventory.entries;
    const allProduction = [
      ...(emojis as { slug: string }[]).map((e) => `/emoji/${e.slug}`),
      ...(extras as { slug: string }[]).map((e) => `/emoji/${e.slug}`),
    ];
    assert.equal(allProduction.length, SEO_MIGRATION_BASELINES.productionPages);
    for (const entry of entries) {
      assert.ok(entry.currentUrl.startsWith("/emoji/"));
      assert.ok(entry.currentSlug.length > 0);
    }
  });

  it("analyzes manual-review URLs", () => {
    assert.equal(migrationPackage.manualReview.status, "PASS");
    assert.equal(migrationPackage.manualReview.count, SEO_MIGRATION_BASELINES.manualReview);
    assert.ok(migrationPackage.manualReview.byReason["variation-selector"] > 0);
    assert.equal(migrationPackage.manualReview.autoResolve, false);
  });

  it("analyzes extras compatibility URLs", () => {
    assert.equal(migrationPackage.extrasCompatibility.status, "PASS");
    assert.equal(migrationPackage.extrasCompatibility.count, SEO_MIGRATION_BASELINES.extrasCompatibility);
    assert.equal(migrationPackage.extrasCompatibility.preserveExtraPrefixPolicy, true);
    for (const entry of migrationPackage.extrasCompatibility.entries) {
      assert.equal(entry.oldUrlMustRemainSupported, true);
      assert.equal(entry.redirectSafe, false);
    }
  });

  it("analyzes source-specific cases", () => {
    assert.equal(migrationPackage.sourceSpecificReview.status, "PASS");
    assert.equal(migrationPackage.sourceSpecificReview.count, SEO_MIGRATION_BASELINES.sourceSpecific);
    for (const entry of migrationPackage.sourceSpecificReview.entries) {
      assert.equal(entry.forceUnicodeCanonical, false);
      assert.equal(entry.redirect, false);
    }
  });

  it("verifies safe redirects have exactly one target", () => {
    assert.equal(migrationPackage.safeRedirects.status, "PASS");
    assert.equal(migrationPackage.safeRedirects.count, SEO_MIGRATION_BASELINES.safeRedirect);
    for (const entry of migrationPackage.safeRedirects.entries) {
      assert.equal(entry.redirectRecommendation, "301");
      assert.ok(entry.proposedUrl.length > 0);
      assert.notEqual(entry.currentUrl, entry.proposedUrl);
    }
  });

  it("verifies redirect safety (no loops, chains, collisions)", () => {
    assert.equal(migrationPackage.redirectSafetyAudit.status, "PASS");
    assert.equal(migrationPackage.redirectSafetyAudit.checks.noRedirectLoops, true);
    assert.equal(migrationPackage.redirectSafetyAudit.checks.noRedirectChains, true);
    assert.equal(migrationPackage.redirectSafetyAudit.checks.noCrossIdentityRedirects, true);
    assert.equal(migrationPackage.redirectSafetyAudit.checks.noSelfRedirects, true);
    assert.equal(migrationPackage.redirectSafetyAudit.redirectLoops, 0);
    assert.equal(migrationPackage.redirectSafetyAudit.redirectChains, 0);
    assert.equal(migrationPackage.redirectSafetyAudit.crossIdentityRedirects, 0);
  });

  it("verifies redirect targets have no duplicate destinations", () => {
    assert.equal(migrationPackage.redirectTargetAudit.status, "PASS");
    assert.equal(migrationPackage.redirectTargetAudit.duplicateTargetCount, 0);
  });

  it("verifies SEO preservation and backward compatibility policy", () => {
    assert.equal(migrationPackage.canonicalPreservationAudit.status, "PASS");
    assert.equal(migrationPackage.backwardCompatibilityAudit.status, "PASS");
    assert.equal(migrationPackage.backwardCompatibilityAudit.policy.noMass404Introduction, true);
    assert.equal(migrationPackage.backwardCompatibilityAudit.policy.masterSEOEnabledRemainsFalse, true);
    assert.equal(migrationPackage.backwardCompatibilityAudit.policy.redirectImplementationDeferred, true);
  });

  it("provides final SEO migration recommendation", () => {
    assert.equal(migrationPackage.seoMigrationRecommendation.status, "PASS");
    assert.equal(migrationPackage.seoMigrationRecommendation.conclusion, "REQUIRES MANUAL SEO REVIEW");
    assert.ok(migrationPackage.seoMigrationRecommendation.blockers.length > 0);
    assert.equal(migrationPackage.seoMigrationRecommendation.implementationAllowed, false);
  });

  it("records audit phase and provenance in manifest", () => {
    assert.equal(migrationPackage.seoMigrationManifest.phase, SEO_MIGRATION_PHASE);
    assert.equal(migrationPackage.seoMigrationManifest.auditOnly, true);
    assert.equal(migrationPackage.seoMigrationManifest.featureFlags.masterSEOEnabled, false);
  });
});
