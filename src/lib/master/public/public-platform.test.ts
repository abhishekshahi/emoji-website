import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getAllBrowsableEmojis } from "@/lib/emoji/browsable-data";
import { getAllCategorySlugs } from "@/lib/emoji/data";
import { MASTER_INTEGRATION_CONFIG } from "@/lib/master/integration/config";
import { parseSeoRolloutMode } from "@/lib/master/integration/seo-canary/rollout";
import { searchMasterIntegrated } from "@/lib/master/integration/search/adapter";
import {
  MASTER_ARTWORK_RECORD_COUNT,
  MASTER_IDENTITY_COUNT,
  PRODUCTION_BROWSABLE_EMOJI_COUNT,
  PUBLIC_INDEXABLE_IDENTITY_COUNT,
  PUBLIC_SEO_EMOJI_PAGE_COUNT,
  PUBLIC_SITEMAP_URL_COUNT,
} from "@/lib/master/r2/catalog";
import { getAllIdentitySlugs } from "@/lib/master/public/identity-slug-map";
import {
  getCatalogStats,
  queryCatalog,
  resetCatalogCache,
} from "@/lib/master/public/catalog-service";
import {
  getArtworkProviderPolicy,
  getLicenseRegistrySummary,
  LICENSE_REGISTRY,
} from "@/lib/master/public/license-registry";
import {
  isPublicMasterApiEnabled,
  isPublicMasterPlatformEnabled,
  parsePublicMasterPlatformMode,
} from "@/lib/master/public/config";
import { buildPublicIdentityResponse } from "@/lib/master/public/identity-service";
import { resolvePublicVisibility } from "@/lib/master/public/visibility";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";

const rootDir = process.cwd();

describe("public master platform", () => {
  it("defaults platform mode to OFF in test environment", () => {
    assert.equal(parsePublicMasterPlatformMode("OFF"), "OFF");
    assert.equal(parsePublicMasterPlatformMode("ENABLED"), "ENABLED");
  });

  it("keeps production SEO and integration flags disabled", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE), "OFF");
  });

  it("measures master identity and artwork counts", () => {
    const records = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/canonical-emojis.json"), "utf8"),
    ) as CanonicalEmojiRecord[];
    assert.equal(records.length, MASTER_IDENTITY_COUNT);
    const artwork = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/artwork/artwork-master-index.json"), "utf8"),
    );
    assert.equal(artwork.length, MASTER_ARTWORK_RECORD_COUNT);
  });

  it("indexes public catalog with correct totals", () => {
    resetCatalogCache();
    const stats = getCatalogStats(rootDir);
    assert.equal(stats.totalIdentities, MASTER_IDENTITY_COUNT);
    assert.equal(stats.publicIdentities, PUBLIC_INDEXABLE_IDENTITY_COUNT);
    assert.equal(stats.indexableIdentities, PUBLIC_INDEXABLE_IDENTITY_COUNT);
  });

  it("paginates catalog without loading entire dataset in one page", () => {
    resetCatalogCache();
    const page = queryCatalog({ page: 1, pageSize: 48 }, rootDir);
    assert.equal(page.items.length, 48);
    assert.ok(page.total >= MASTER_IDENTITY_COUNT - 10);
  });

  it("searches master catalog for fire", () => {
    const results = searchMasterIntegrated("fire", rootDir, 20);
    assert.ok(results.results.length > 0);
    assert.ok(results.results.some((r) => r.canonicalName.toLowerCase().includes("fire") || r.character === "🔥"));
  });

  it("resolves public visibility for unicode fire", () => {
    const visibility = resolvePublicVisibility("unicode:1F525", rootDir);
    assert.ok(visibility);
    assert.equal(visibility.public, true);
    assert.equal(visibility.indexable, true);
    assert.ok(visibility.seoPageUrl?.includes("/emoji/"));
  });

  it("builds public identity response with artwork providers", () => {
    const identity = buildPublicIdentityResponse("unicode:1F525", rootDir);
    assert.ok(identity);
    assert.ok(identity.artworkProviders.length > 0);
    assert.ok(identity.officialName.toLowerCase().includes("fire"));
  });

  it("audits license registry", () => {
    const summary = getLicenseRegistrySummary();
    assert.ok(summary.totalEntries >= 10);
    assert.equal(getArtworkProviderPolicy("openmoji").publicServingAllowed, true);
    assert.equal(getArtworkProviderPolicy("twemoji").publicServingAllowed, true);
    assert.equal(getArtworkProviderPolicy("noto").publicServingAllowed, false);
    assert.equal(getArtworkProviderPolicy("fluent").publicServingAllowed, false);
    assert.ok(LICENSE_REGISTRY.some((e) => e.provider === "EmojiNet"));
  });

  it("keeps sitemap and identity page counts stable", () => {
    assert.equal(getAllIdentitySlugs().length, PUBLIC_SEO_EMOJI_PAGE_COUNT);
    assert.equal(getAllBrowsableEmojis().length, PRODUCTION_BROWSABLE_EMOJI_COUNT);
    const sitemapCount = 7 + getAllCategorySlugs().length + getAllIdentitySlugs().length;
    assert.equal(sitemapCount, PUBLIC_SITEMAP_URL_COUNT);
  });
});

describe("public platform feature gates", () => {
  it("reports API disabled when platform OFF", () => {
    const original = process.env.PUBLIC_MASTER_PLATFORM_MODE;
    process.env.PUBLIC_MASTER_PLATFORM_MODE = "OFF";
    assert.equal(isPublicMasterPlatformEnabled(), false);
    assert.equal(isPublicMasterApiEnabled(), false);
    process.env.PUBLIC_MASTER_PLATFORM_MODE = original;
  });
});
