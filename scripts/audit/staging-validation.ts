import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import {
  MASTER_ARTWORK_RECORD_COUNT,
  MASTER_IDENTITY_COUNT,
  PUBLIC_SEO_EMOJI_PAGE_COUNT,
  PUBLIC_SITEMAP_URL_COUNT,
} from "../../src/lib/master/r2/catalog";
import { parseMasterR2Mode, R2_EXPORT_DIR } from "../../src/lib/master/r2/config";
import { verifyR2Export } from "../../src/lib/master/r2/export/verify";
import { parseArtworkApiPath, R2KeyValidationError } from "../../src/lib/master/r2/keys";
import { artworkResponseHeaders, jsonResponseHeaders, R2_ARTWORK_CACHE_CONTROL } from "../../src/lib/master/r2/http";
import { isProviderPubliclyServed } from "../../src/lib/master/r2/licenses";
import { LocalMasterDataProvider } from "../../src/lib/master/r2/provider/local";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { searchMasterIntegrated } from "../../src/lib/master/integration/search/adapter";
import {
  getCatalogStats,
  queryCatalog,
  resetCatalogCache,
} from "../../src/lib/master/public/catalog-service";
import { buildPublicIdentityResponse } from "../../src/lib/master/public/identity-service";
import { getArtworkProviderPolicy } from "../../src/lib/master/public/license-registry";
import { parsePublicMasterPlatformMode } from "../../src/lib/master/public/config";
import { resolvePublicVisibility } from "../../src/lib/master/public/visibility";
import { getAllBrowsableEmojis, getAllBrowsableSlugs } from "../../src/lib/emoji/browsable-data";
import { getAllCategorySlugs } from "../../src/lib/emoji/data";
import { getActiveEmojiSitemapSlugs } from "../../src/lib/master/integration/seo-canary/active-migration";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportRootDir = join(rootDir, R2_EXPORT_DIR, "emojiquick");

interface CheckResult {
  readonly name: string;
  readonly status: "PASS" | "FAIL";
  readonly detail: string;
  readonly ms?: number;
}

const results: CheckResult[] = [];

function record(name: string, status: "PASS" | "FAIL", detail: string, ms?: number): void {
  results.push({ name, status, detail, ms });
}

function runCheck(name: string, fn: () => void): void {
  const start = performance.now();
  try {
    fn();
    record(name, "PASS", "ok", performance.now() - start);
  } catch (error) {
    record(name, "FAIL", error instanceof Error ? error.message : String(error), performance.now() - start);
  }
}

async function runAsyncCheck(name: string, fn: () => Promise<void>): Promise<void> {
  const start = performance.now();
  try {
    await fn();
    record(name, "PASS", "ok", performance.now() - start);
  } catch (error) {
    record(name, "FAIL", error instanceof Error ? error.message : String(error), performance.now() - start);
  }
}

async function main(): Promise<void> {
  process.env.MASTER_R2_MODE = "DATA_READY";
  process.env.PUBLIC_MASTER_PLATFORM_MODE = "LOCAL";
  delete process.env.MASTER_SEO_ROLLOUT_MODE;
  resetCatalogCache();

  const provider = new LocalMasterDataProvider({ exportRootDir });

  console.log("Phase 8.38 - Local Staging Validation");
  console.log(`MASTER_R2_MODE=${process.env.MASTER_R2_MODE}`);
  console.log(`PUBLIC_MASTER_PLATFORM_MODE=${process.env.PUBLIC_MASTER_PLATFORM_MODE}`);
  console.log("");

  runCheck("staging env MASTER_R2_MODE", () => {
    assert.equal(parseMasterR2Mode(process.env.MASTER_R2_MODE), "DATA_READY");
  });

  runCheck("staging env PUBLIC_MASTER_PLATFORM_MODE", () => {
    assert.equal(parsePublicMasterPlatformMode(process.env.PUBLIC_MASTER_PLATFORM_MODE), "LOCAL");
  });

  runCheck("production flags remain disabled", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE), "OFF");
  });

  await runAsyncCheck("GET identity unicode:1F525", async () => {
    const identity = await provider.getIdentity("unicode:1F525");
    assert.ok(identity);
    assert.equal(identity.canonicalId, "unicode:1F525");
    assert.equal(identity.emoji, "\uD83D\uDD25");
  });

  await runAsyncCheck("GET artwork keys for unicode:1F525", async () => {
    const artwork = await provider.listArtworkKeysForCanonical("unicode:1F525");
    assert.ok(artwork.length > 0);
    assert.ok(artwork.some((entry) => entry.provider === "openmoji"));
  });

  await runAsyncCheck("GET openmoji artwork bytes", async () => {
    const artwork = await provider.listArtworkKeysForCanonical("unicode:1F525");
    const openmoji = artwork.find((entry) => entry.provider === "openmoji");
    assert.ok(openmoji);
    const bytes = await provider.getArtworkBytes(openmoji.storageKey);
    assert.ok(bytes && bytes.length > 0);
    assert.ok(!openmoji.storageKey.includes(".."));
  });

  runCheck("noto public serving blocked", () => {
    assert.equal(isProviderPubliclyServed("noto"), false);
    assert.equal(getArtworkProviderPolicy("noto").publicServingAllowed, false);
  });

  runCheck("fluent public serving blocked", () => {
    assert.equal(isProviderPubliclyServed("fluent"), false);
    assert.equal(getArtworkProviderPolicy("fluent").publicServingAllowed, false);
  });

  runCheck("openmoji public serving allowed", () => {
    assert.equal(isProviderPubliclyServed("openmoji"), true);
  });

  runCheck("twemoji public serving allowed", () => {
    assert.equal(isProviderPubliclyServed("twemoji"), true);
  });

  runCheck("security path traversal rejected", () => {
    assert.throws(() => parseArtworkApiPath("openmoji", ["..", "secret.svg"]), R2KeyValidationError);
    assert.throws(() => parseArtworkApiPath("evil", ["file.svg"]), R2KeyValidationError);
    assert.throws(() => parseArtworkApiPath("openmoji", ["%2e%2e", "secret.svg"]), R2KeyValidationError);
  });

  runCheck("cache headers for public artwork", () => {
    const headers = artworkResponseHeaders("image/svg+xml", true);
    assert.equal((headers as Record<string, string>)["Cache-Control"], R2_ARTWORK_CACHE_CONTROL);
  });

  runCheck("cache headers for restricted artwork", () => {
    const headers = artworkResponseHeaders("application/json", false);
    assert.match((headers as Record<string, string>)["Cache-Control"], /no-store/);
  });

  runCheck("json API cache headers", () => {
    const headers = jsonResponseHeaders();
    assert.ok((headers as Record<string, string>)["Cache-Control"]);
  });

  runCheck("catalog pagination", () => {
    const page = queryCatalog({ page: 1, pageSize: 48 }, rootDir);
    assert.equal(page.items.length, 48);
    assert.equal(page.total, 6953);
  });

  runCheck("catalog search fire", () => {
    const page = queryCatalog({ search: "fire", pageSize: 20 }, rootDir);
    assert.ok(page.items.length > 0);
  });

  runCheck("catalog filter counts", () => {
    const stats = getCatalogStats(rootDir);
    assert.equal(stats.publicIdentities, 6953);
    assert.equal(stats.indexableIdentities, PUBLIC_SEO_EMOJI_PAGE_COUNT);
    assert.equal(stats.withArtwork, 5330);
    assert.equal(stats.withMetadata, 4759);
  });

  runCheck("utility identities excluded from public catalog", () => {
    const stats = getCatalogStats(rootDir);
    assert.equal(MASTER_IDENTITY_COUNT - stats.publicIdentities, 2);
  });

  runCheck("master search fire", () => {
    const results = searchMasterIntegrated("fire", rootDir, 20);
    assert.ok(results.results.length > 0);
  });

  runCheck("public identity response unicode:1F525", () => {
    const identity = buildPublicIdentityResponse("unicode:1F525", rootDir);
    assert.ok(identity);
    assert.ok(identity.artworkProviders.length > 0);
    const body = JSON.stringify(identity);
    assert.ok(!body.includes("src/data/master"));
    assert.ok(!body.includes(".r2-export"));
  });

  runCheck("visibility fire indexable", () => {
    const visibility = resolvePublicVisibility("unicode:1F525", rootDir);
    assert.ok(visibility);
    assert.equal(visibility.indexable, true);
    assert.equal(visibility.public, true);
  });

  runCheck("sitemap URL count stable", () => {
    const sitemapCount = 7 + getAllCategorySlugs().length + getAllBrowsableEmojis().length;
    assert.equal(sitemapCount, PUBLIC_SITEMAP_URL_COUNT);
    assert.equal(getActiveEmojiSitemapSlugs(getAllBrowsableSlugs()).length, PUBLIC_SEO_EMOJI_PAGE_COUNT);
  });

  runCheck("local optimized export verify", () => {
    const verify = verifyR2Export(exportRootDir);
    assert.equal(verify.status, "PASS", verify.errors.join("; "));
    assert.equal(verify.manifest.totals.identities, MASTER_IDENTITY_COUNT);
    assert.equal(verify.manifest.totals.artworkRecords, MASTER_ARTWORK_RECORD_COUNT);
    assert.equal(verify.manifest.totals.objects, 39710);
  });

  runCheck("enrichment files present", () => {
    assert.ok(existsSync(join(rootDir, "src/data/emoji-enrichment.json")));
    assert.ok(existsSync(join(rootDir, "src/data/emoji-search-enrichment.json")));
  });

  runCheck("no secrets in public identity JSON", () => {
    const identity = buildPublicIdentityResponse("unicode:1F525", rootDir);
    const serialized = JSON.stringify(identity);
    assert.ok(!/AKIA|secret|password|api[_-]?key/i.test(serialized));
  });

  const failed = results.filter((r) => r.status === "FAIL");
  const passed = results.filter((r) => r.status === "PASS");

  console.log(JSON.stringify({ phase: "8.38", passed: passed.length, failed: failed.length, results }, null, 2));

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});