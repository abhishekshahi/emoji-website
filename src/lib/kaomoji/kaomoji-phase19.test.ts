import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, before } from "node:test";
import {
  PRODUCTION_VERSION,
  SCHEMA_VERSION,
  parseKaomojiCloudflareMode,
  getKaomojiR2Prefix,
  KAOMOJI_D1_BATCH_SIZE,
  KAOMOJI_D1_KAOMOJI_BATCH_SIZE,
} from "@/lib/kaomoji/cloudflare/config";
import {
  buildKaomojiR2Key,
  buildKaomojiManifestKey,
  buildKaomojiSearchIndexKey,
  buildKaomojiLocaleRegistryKey,
  buildKaomojiChecksumsKey,
  buildKaomojiRollbackManifestKey,
  assertSafeKaomojiR2Key,
} from "@/lib/kaomoji/cloudflare/r2-keys";
import { sha256Buffer, sha256File, verifyChecksum } from "@/lib/kaomoji/cloudflare/checksum";
import {
  kaomojiSearchCacheHeaders,
  kaomojiDetailCacheHeaders,
  kaomojiCollectionsCacheHeaders,
  KAOMOJI_SEARCH_CACHE_CONTROL,
} from "@/lib/kaomoji/cloudflare/cache";
import {
  checkKaomojiSearchRateLimit,
  resetKaomojiSearchRateLimits,
  KAOMOJI_SEARCH_RATE_LIMIT,
  KAOMOJI_SEARCH_RATE_WINDOW_MS,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import {
  D1_GET_KAOMOJI_BY_SLUG,
  D1_COUNT_PUBLIC_KAOMOJI,
  D1_GET_RELATED_KAOMOJI,
} from "@/lib/kaomoji/cloudflare/d1-queries";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  IMPORT_TABLE_ORDER,
  BACKOFF_MS,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { validatePhase19Export, validatePhase19Manifest, validatePhase19Checksums } from "@/lib/kaomoji/cloudflare/validation";
import { measurePhase19Storage } from "@/lib/kaomoji/cloudflare/storage-measure";
import { runPhase19Pipeline } from "@/lib/kaomoji/processing/phase19/pipeline";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import {
  getPhase19ManifestPath,
  getPhase19ExportDir,
  getPhase14SearchIndexPath,
  getPhase15LocaleRegistryPath,
  PHASE19_PIPELINE_VERSION,
} from "@/lib/kaomoji/storage/paths";

describe("phase 19 cloudflare production", () => {
  const root = process.cwd();
  let manifestExists = false;

  before(() => {
    manifestExists = existsSync(getPhase19ManifestPath(root));
    if (!manifestExists) runPhase19Pipeline(root);
    manifestExists = existsSync(getPhase19ManifestPath(root));
  });

  const m = () => JSON.parse(readFileSync(getPhase19ManifestPath(root), "utf8"));
  const schemaSql = () => readFileSync(join(root, "migrations/kaomoji/0001_schema.sql"), "utf8");

  it("1 schema file exists", () => assert.ok(existsSync(join(root, "migrations/kaomoji/0001_schema.sql"))));
  it("2 schema has kaomoji table", () => assert.match(schemaSql(), /CREATE TABLE IF NOT EXISTS kaomoji/));
  it("3 schema has relationship table", () => assert.match(schemaSql(), /CREATE TABLE IF NOT EXISTS relationship/));
  it("4 schema has production_release", () => assert.match(schemaSql(), /CREATE TABLE IF NOT EXISTS production_release/));
  it("5 schema has source_attribution", () => assert.match(schemaSql(), /CREATE TABLE IF NOT EXISTS source_attribution/));
  it("6 schema version constant", () => assert.equal(SCHEMA_VERSION, "19.0.0"));
  it("7 production version constant", () => assert.equal(PRODUCTION_VERSION, "2026-08-19-v1"));
  it("8 parse staging mode", () => assert.equal(parseKaomojiCloudflareMode("STAGING"), "STAGING"));
  it("9 parse off mode", () => assert.equal(parseKaomojiCloudflareMode(undefined), "OFF"));
  it("10 r2 prefix emojiquick", () => assert.equal(getKaomojiR2Prefix(), "emojiquick"));
  it("11 build r2 key", () => assert.equal(buildKaomojiR2Key("kaomoji", "test"), "emojiquick/kaomoji/test"));
  it("12 manifest key", () => assert.match(buildKaomojiManifestKey(), /manifest\.json$/));
  it("13 search index key", () => assert.match(buildKaomojiSearchIndexKey(), /search-index-v2\.json$/));
  it("14 locale registry key", () => assert.match(buildKaomojiLocaleRegistryKey(), /locale-registry\.json$/));
  it("15 checksums key", () => assert.match(buildKaomojiChecksumsKey(), /checksums\.json$/));
  it("16 rollback manifest key", () => assert.match(buildKaomojiRollbackManifestKey("prev"), /rollback-manifest\.json$/));
  it("17 safe r2 key", () => assert.doesNotThrow(() => assertSafeKaomojiR2Key(buildKaomojiManifestKey())));
  it("18 sha256 buffer", () => assert.equal(sha256Buffer("test").length, 64));
  it("19 sha256 file locale registry", () => assert.ok(sha256File(getPhase15LocaleRegistryPath(root)).bytes > 0));
  it("20 verify checksum search index export", () => {
    runPhase19Pipeline(root);
    assert.ok(validatePhase19Checksums(root));
  });
  it("21 d1 kaomoji batch size 25", () => assert.equal(KAOMOJI_D1_KAOMOJI_BATCH_SIZE, 25));
  it("21b d1 default batch size 500", () => assert.equal(KAOMOJI_D1_BATCH_SIZE, 500));
  it("22 d1 slug query", () => assert.match(D1_GET_KAOMOJI_BY_SLUG, /WHERE slug = \?1/));
  it("23 d1 count query", () => assert.match(D1_COUNT_PUBLIC_KAOMOJI, /COUNT\(\*\)/));
  it("24 d1 related query joins", () => assert.match(D1_GET_RELATED_KAOMOJI, /JOIN kaomoji/));
  it("25 search cache headers", () => assert.equal(kaomojiSearchCacheHeaders()["Cache-Control"], KAOMOJI_SEARCH_CACHE_CONTROL));
  it("26 detail cache headers", () => assert.ok(kaomojiDetailCacheHeaders()["Cache-Control"].includes("s-maxage")));
  it("27 collections cache headers", () => assert.ok(kaomojiCollectionsCacheHeaders()["Cache-Control"].includes("stale-while-revalidate")));
  it("28 rate limit allows first request", () => {
    resetKaomojiSearchRateLimits();
    assert.ok(checkKaomojiSearchRateLimit("test-ip"));
  });
  it("29 rate limit max 120", () => assert.equal(KAOMOJI_SEARCH_RATE_LIMIT, 120));
  it("30 rate limit window 60s", () => assert.equal(KAOMOJI_SEARCH_RATE_WINDOW_MS, 60_000));
  it("31 manifest exists", () => assert.ok(manifestExists));
  it("32 phase number 19", () => assert.equal(m().phase, 19));
  it("33 pipeline version", () => assert.match(m().pipeline_version, /^19\./));
  it("34 public records 50979", () => assert.equal(m().public_records, 50979));
  it("35 relationships 392904", () => assert.equal(m().relationships, 392904));
  it("36 no broken relationships exported", () => assert.equal(m().relationships_rejected, 0));
  it("37 collections > 0", () => assert.ok(m().collections > 0));
  it("38 d1 batches >= 2000", () => assert.ok(m().d1_batches >= 2000));
  it("39 d1 sql files > 0", () => assert.ok(m().d1_sql_files > 0));
  it("40 raw not modified", () => assert.equal(m().raw_modified, 0));
  it("41 validation valid", () => assert.equal(m().validation.valid, true));
  it("42 export validation helper", () => {
    const v = validatePhase19Export(root);
    assert.equal(v.counts.public_records, 50979);
    assert.equal(v.valid, true);
  });
  it("43 manifest validation helper", () => assert.equal(validatePhase19Manifest(m()).valid, true));
  it("44 storage measure total > 0", () => assert.ok(measurePhase19Storage(root).total_bytes > 0));
  it("45 export dir exists", () => assert.ok(existsSync(getPhase19ExportDir(root))));
  it("46 r2 public search index copied", () => assert.ok(existsSync(join(getPhase19ExportDir(root), "r2", "public", "search-index-v2.json"))));
  it("47 r2 manifest exists", () => assert.ok(existsSync(join(getPhase19ExportDir(root), "r2", "rebuildable", "manifest.json"))));
  it("48 rollback manifest exists", () => assert.ok(existsSync(join(getPhase19ExportDir(root), "r2", "backup", "rollback-manifest.json"))));
  it("49 locale registry sha256 set", () => assert.equal(m().locale_registry_sha256.length, 64));
  it("50 search index sha256 set", () => assert.equal(m().search_index_sha256.length, 64));
  it("51 pipeline version constant", () => assert.match(PHASE19_PIPELINE_VERSION, /^19\./));
  it("52 search regression anime", () => {
    const idx = JSON.parse(readFileSync(getPhase14SearchIndexPath(root), "utf8"));
    assert.ok(searchKaomojiV2(idx, "anime", 5).length >= 3);
  });
  it("53 search regression love", () => {
    const idx = JSON.parse(readFileSync(getPhase14SearchIndexPath(root), "utf8"));
    assert.ok(searchKaomojiV2(idx, "love", 5).length >= 5);
  });
  it("54 no pipeline errors", () => assert.equal(m().errors.length, 0));
  it("55 deterministic rerun public count", () => {
    const before = m().public_records;
    const after = runPhase19Pipeline(root).manifest.public_records;
    assert.equal(before, after);
  });
  it("56 d1 import expected kaomoji", () => assert.equal(EXPECTED_KAOMOJI, 50979));
  it("57 d1 import expected relationships", () => assert.equal(EXPECTED_RELATIONSHIPS, 392904));
  it("58 d1 import table order kaomoji before relationship", () => {
    assert.ok(IMPORT_TABLE_ORDER.indexOf("kaomoji") < IMPORT_TABLE_ORDER.indexOf("relationship"));
  });
  it("59 d1 backoff schedule", () => assert.deepEqual(BACKOFF_MS, [0, 2000, 5000, 10000, 20000, 30000, 60000]));
  it("60 d1 import order ends production_release", () =>
    assert.equal(IMPORT_TABLE_ORDER[IMPORT_TABLE_ORDER.length - 1], "production_release"));
});
