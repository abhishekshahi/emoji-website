import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getAllBrowsableSlugs, getBrowsableEmojiBySlug } from "@/lib/emoji/browsable-data";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  isMasterSeoIntegrationEnabled,
} from "@/lib/master/integration";
import {
  APPROVED_REDIRECT_BASELINE,
  EXCLUDED_URL_BASELINE,
  PRESERVED_URL_BASELINE,
  REDIRECT_HTTP_STATUS,
  buildApprovedRedirectsDataset,
  buildMigrationImplementationPackage,
  buildPreservedUrlList,
  validateApprovedRedirectsDataset,
} from "@/lib/master/integration/seo-migration-implementation/build";
import {
  getApprovedRedirectRecords,
  getCanonicalEmojiSitemapSlugs,
  isApprovedRedirectSourceSlug,
  isApprovedRedirectTargetSlug,
  measureRedirectLookupPerformance,
  resolveApprovedEmojiRedirect,
  resolveEmojiPageSlug,
  resolveProductionSlugForRedirectTarget,
} from "@/lib/master/integration/seo-migration/redirects";
import { buildCanaryOfflinePackage } from "@/lib/master/integration/seo-migration-production-qa/build";
import { resolveActiveEmojiRedirect } from "@/lib/master/integration/seo-canary/active-migration";
import {
  getSeoRolloutMode,
  isSeoMigrationRolloutActive,
  parseSeoRolloutMode,
  runWithSeoRolloutMode,
} from "@/lib/master/integration/seo-canary/rollout";
import { SEO_CANARY_PHASE } from "@/lib/master/integration/config";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();

describe("phase 8.12C approved SEO redirect implementation", () => {
  const implementationPackage = buildMigrationImplementationPackage(rootDir);
  const approvedRedirects = getApprovedRedirectRecords();
  const preserved = buildPreservedUrlList(rootDir);

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

  it("loads exactly 2280 approved redirects from the frozen dataset", () => {
    assert.equal(approvedRedirects.length, APPROVED_REDIRECT_BASELINE);
    assert.equal(implementationPackage.approvedRedirects.count, APPROVED_REDIRECT_BASELINE);
    for (const record of approvedRedirects) {
      assert.equal(record.decision, "SAFE_TO_REDIRECT");
      assert.equal(record.permanent, true);
      assert.ok(record.from.startsWith("/emoji/"));
      assert.ok(record.to.startsWith("/emoji/"));
      assert.notEqual(record.from, record.to);
    }
  });

  it("validates every approved redirect candidate field", () => {
    const validation = validateApprovedRedirectsDataset(buildApprovedRedirectsDataset(rootDir), rootDir);
    assert.equal(validation.errors.length, 0);
    assert.equal(validation.redirectLoops, 0);
    assert.equal(validation.redirectChains, 0);
    assert.equal(validation.duplicateSources, 0);
  });

  it("resolves approved redirects with permanent 301 semantics only", () => {
    for (const record of approvedRedirects) {
      const resolved = resolveApprovedEmojiRedirect(record.from);
      assert.ok(resolved);
      assert.equal(resolved?.to, record.to);
      assert.equal(resolved?.canonicalId, record.canonicalId);
      assert.equal(resolved?.permanent, true);
      assert.equal(resolved?.status, REDIRECT_HTTP_STATUS);
    }
    assert.equal(resolveApprovedEmojiRedirect("/emoji/unknown-slug-test"), null);
    assert.equal(resolveApprovedEmojiRedirect("/search"), null);
  });

  it("ensures redirect targets resolve to the correct production emoji identity", () => {
    for (const record of approvedRedirects) {
      const sourceSlug = record.from.replace("/emoji/", "");
      const targetSlug = record.to.replace("/emoji/", "");
      const productionSlug = resolveProductionSlugForRedirectTarget(targetSlug);
      assert.equal(productionSlug, sourceSlug);
      const sourceEmoji = getBrowsableEmojiBySlug(sourceSlug);
      const targetEmoji = getBrowsableEmojiBySlug(resolveEmojiPageSlug(targetSlug).lookupSlug);
      assert.ok(sourceEmoji);
      assert.ok(targetEmoji);
      assert.equal(sourceEmoji?.hexcode, targetEmoji?.hexcode);
    }
  });

  it("detects no redirect loops, chains, duplicate sources, or cross-identity targets", () => {
    const sources = new Set<string>();
    const targets = new Map<string, string>();
    for (const record of approvedRedirects) {
      assert.equal(sources.has(record.from), false);
      sources.add(record.from);
      const existing = targets.get(record.to);
      if (existing) {
        assert.equal(existing, record.canonicalId);
      } else {
        targets.set(record.to, record.canonicalId);
      }
      assert.equal(resolveApprovedEmojiRedirect(record.to), null);
      assert.equal(record.to.includes("openmoji"), false);
      assert.equal(record.to.startsWith("http"), false);
    }
  });

  it("preserves 644 URLs without redirects and excludes 10 permanently", () => {
    assert.equal(preserved.count, PRESERVED_URL_BASELINE);
    assert.equal(preserved.excludedCount, EXCLUDED_URL_BASELINE);
    for (const entry of [...preserved.entries, ...preserved.excluded]) {
      assert.equal(resolveApprovedEmojiRedirect(entry.url), null);
      const slug = entry.url.replace("/emoji/", "");
      assert.ok(getBrowsableEmojiBySlug(slug));
    }
  });

  it("keeps variation selector identities distinct", () => {
    const smiling = getBrowsableEmojiBySlug("smiling-face");
    assert.ok(smiling);
    const fe0fEntry = approvedRedirects.find((record) => record.canonicalId === "unicode:263A-FE0F");
    if (fe0fEntry) {
      assert.equal(resolveApprovedEmojiRedirect("/emoji/white-smiling-face"), null);
    }
  });

  it("keeps skin tone and ZWJ identities distinct", () => {
    const thumbs = ["thumbs-up", "thumbs-up-light-skin-tone", "thumbs-up-dark-skin-tone"];
    for (const slug of thumbs) {
      const emoji = getBrowsableEmojiBySlug(slug);
      if (emoji) {
        const redirect = approvedRedirects.find((record) => record.from === `/emoji/${slug}`);
        if (redirect) {
          assert.notEqual(redirect.to, `/emoji/${thumbs.find((other) => other !== slug)}`);
        }
      }
    }
    const manTech = getBrowsableEmojiBySlug("man-technologist");
    const womanTech = getBrowsableEmojiBySlug("woman-technologist");
    assert.ok(manTech);
    assert.ok(womanTech);
    assert.notEqual(manTech?.hexcode, womanTech?.hexcode);
  });

  it("preserves extras and source-specific URLs", () => {
    const extraPreserved = preserved.entries.filter((entry) => entry.decision === "KEEP_EXTRA_URL");
    assert.equal(extraPreserved.length, 179);
    for (const entry of extraPreserved) {
      assert.match(entry.url, /^\/emoji\/extra-/);
    }
    const sourcePreserved = preserved.entries.filter((entry) => entry.decision === "KEEP_SOURCE_URL");
    assert.equal(sourcePreserved.length, 353);
  });

  it("uses canonical sitemap slugs for 4486 production pages", () => {
    const canonicalSlugs = getCanonicalEmojiSitemapSlugs(getAllBrowsableSlugs());
    assert.equal(canonicalSlugs.length, PRODUCTION_BASELINES.totalSearchable);
    for (const record of approvedRedirects) {
      const sourceSlug = record.from.replace("/emoji/", "");
      assert.equal(canonicalSlugs.includes(sourceSlug), false);
      assert.equal(canonicalSlugs.includes(record.to.replace("/emoji/", "")), true);
    }
  });

  it("performs constant-time redirect lookup", () => {
    const performance = measureRedirectLookupPerformance();
    assert.equal(performance.lookupComplexity, "O(1)");
    assert.ok(performance.warmLookupMs < 1);
  });

  it("passes migration implementation audit package", () => {
    assert.equal(implementationPackage.migrationImplementationAudit.status, "PASS");
    assert.equal(implementationPackage.seoSafetyAudit.status, "PASS");
    assert.equal(implementationPackage.preservedUrlAudit.status, "PASS");
    assert.equal(implementationPackage.sitemapAudit.status, "PASS");
  });

  it("confirms production datasets remain unchanged", () => {
    assert.equal((emojis as BrowsableEmoji[]).length, PRODUCTION_BASELINES.standardRecords);
    assert.equal((extras as BrowsableEmoji[]).length, PRODUCTION_BASELINES.extrasRecords);
  });
});

describe("phase 8.12E SEO canary rollout", () => {
  const offlinePackage = buildCanaryOfflinePackage(rootDir);

  it("defaults SEO rollout to OFF and keeps masterSEOEnabled false", () => {
    assert.equal(parseSeoRolloutMode(undefined), "OFF");
    assert.equal(getSeoRolloutMode(), "OFF");
    assert.equal(isSeoMigrationRolloutActive(), false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  it("activates approved redirects only when rollout mode is CANARY", () => {
    const sample = resolveApprovedEmojiRedirect("/emoji/smiling-face");
    assert.ok(sample);
    runWithSeoRolloutMode("OFF", () => {
      assert.equal(resolveActiveEmojiRedirect("/emoji/smiling-face"), null);
    });
    runWithSeoRolloutMode("CANARY", () => {
      assert.equal(resolveActiveEmojiRedirect("/emoji/smiling-face")?.to, sample?.to);
    });
  });

  it("passes offline canary audits", () => {
    assert.equal(offlinePackage.canaryConfigAudit.status, "PASS");
    assert.equal(offlinePackage.failureSafetyAudit.status, "PASS");
    assert.equal(offlinePackage.productionSafetyAudit.status, "PASS");
    assert.equal(offlinePackage.sitemapCanaryAudit.status, "PASS");
    assert.equal(offlinePackage.redirectBundleAudit.status, "PASS");
    assert.equal(offlinePackage.canaryManifest.phase, SEO_CANARY_PHASE);
  });
});
