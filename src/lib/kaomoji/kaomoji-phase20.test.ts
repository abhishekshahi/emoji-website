import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, before } from "node:test";
import {
  kaomojiCollectionsCacheHeaders,
  kaomojiDetailCacheHeaders,
  kaomojiSearchCacheHeaders,
} from "@/lib/kaomoji/cloudflare/cache";
import {
  checkKaomojiSearchRateLimit,
  resetKaomojiSearchRateLimits,
  KAOMOJI_SEARCH_RATE_LIMIT,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { sanitizeSearchRequest } from "@/lib/kaomoji/processing/phase14/security";
import {
  auditCacheHeaders,
  auditKaomojiRoutes,
  auditNoSecretsInClient,
  auditParameterizedQueries,
  auditRateLimit,
  auditReducedMotion,
  auditSearchBenchmark,
  auditSearchSanitization,
  countSchemaIndexes,
} from "@/lib/kaomoji/processing/phase20/audits";
import { runPhase20Pipeline } from "@/lib/kaomoji/processing/phase20/pipeline";
import { PHASE20_HARDENING_VERSION } from "@/lib/kaomoji/processing/phase20/types";
import { getPhase20ManifestPath, getPhase20RootDir, PHASE20_PIPELINE_VERSION } from "@/lib/kaomoji/storage/paths";

describe("phase 20 production hardening", () => {
  const root = process.cwd();

  before(() => {
    runPhase20Pipeline(root);
  });

  const m = () => JSON.parse(readFileSync(getPhase20ManifestPath(root), "utf8"));

  it("1 manifest exists", () => assert.ok(existsSync(getPhase20ManifestPath(root))));
  it("2 phase number", () => assert.equal(m().phase, 20));
  it("3 pipeline version", () => assert.match(m().pipeline_version, /^20\./));
  it("4 hardening version", () => assert.equal(m().hardening_version, PHASE20_HARDENING_VERSION));
  it("5 parameterized queries", () => assert.equal(auditParameterizedQueries(), true));
  it("6 rate limit audit", () => assert.equal(auditRateLimit(), true));
  it("7 search sanitization", () => assert.equal(auditSearchSanitization(), true));
  it("8 cache headers audit", () => assert.equal(auditCacheHeaders(), true));
  it("9 schema indexes >= 5", () => assert.ok(countSchemaIndexes(root) >= 5));
  it("10 search benchmark 122/122", () => {
    const b = auditSearchBenchmark(root);
    assert.equal(b.pass, true);
    assert.match(b.score, /122\/122/);
  });
  it("11 no secrets in client", () => assert.equal(auditNoSecretsInClient(root), true));
  it("12 kaomoji routes found", () => assert.ok(auditKaomojiRoutes(root) >= 1));
  it("13 reduced motion css", () => assert.equal(auditReducedMotion(root), true));
  it("14 raw unchanged flag", () => assert.equal(m().raw_unchanged, true));
  it("15 raw sha256 set", () => assert.equal(m().raw_sha256.length, 64));
  it("16 security parameterized", () => assert.equal(m().security.parameterized_queries, true));
  it("17 security rate limit", () => assert.equal(m().security.rate_limit_enabled, true));
  it("18 security sanitization", () => assert.equal(m().security.search_sanitization, true));
  it("19 security no secrets", () => assert.equal(m().security.no_secrets_in_client, true));
  it("20 security xss controls", () => assert.equal(m().security.xss_controls, true));
  it("21 performance benchmark pass", () => assert.equal(m().performance.search_benchmark_pass, true));
  it("22 performance cache headers", () => assert.equal(m().performance.cache_headers_configured, true));
  it("23 accessibility aria", () => assert.equal(m().accessibility.aria_patterns, true));
  it("24 failure graceful search", () => assert.equal(m().failure_handling.graceful_search_empty, true));
  it("25 failure rate limit response", () => assert.equal(m().failure_handling.rate_limit_response, true));
  it("26 search cache control set", () => assert.ok(kaomojiSearchCacheHeaders()["Cache-Control"]));
  it("27 detail cache s-maxage", () => assert.match(kaomojiDetailCacheHeaders()["Cache-Control"], /s-maxage/));
  it("28 collections stale-while-revalidate", () =>
    assert.match(kaomojiCollectionsCacheHeaders()["Cache-Control"], /stale-while-revalidate/));
  it("29 sanitize control chars rejected", () => assert.equal(sanitizeSearchRequest("\x01", 24, 0).rejected, true));
  it("30 sanitize limit capped", () => assert.ok(sanitizeSearchRequest("test", 999).limit <= 48));
  it("31 sanitize offset capped", () => assert.ok(sanitizeSearchRequest("test", 24, 99999).offset <= 10000));
  it("32 rate limit max 120", () => assert.equal(KAOMOJI_SEARCH_RATE_LIMIT, 120));
  it("33 rate limit blocks after max", () => {
    resetKaomojiSearchRateLimits();
    const k = "phase20-test";
    for (let i = 0; i < KAOMOJI_SEARCH_RATE_LIMIT; i++) assert.ok(checkKaomojiSearchRateLimit(k));
    assert.equal(checkKaomojiSearchRateLimit(k), false);
  });
  it("34 config file written", () => assert.ok(existsSync(join(getPhase20RootDir(root), "manifest.json"))));
  it("35 pipeline version constant", () => assert.match(PHASE20_PIPELINE_VERSION, /^20\./));
  it("36 no errors on clean run", () => assert.equal(m().errors.length, 0));
  it("37 deterministic rerun", () => {
    const before = m().performance.search_benchmark_score;
    const after = runPhase20Pipeline(root).manifest.performance.search_benchmark_score;
    assert.equal(before, after);
  });
  it("38 schema file exists", () => assert.ok(existsSync(join(root, "migrations/kaomoji/0001_schema.sql"))));
  it("39 relationship index exists", () => {
    const sql = readFileSync(join(root, "migrations/kaomoji/0001_schema.sql"), "utf8");
    assert.match(sql, /idx_relationship_from/);
  });
  it("40 kaomoji slug index", () => {
    const sql = readFileSync(join(root, "migrations/kaomoji/0001_schema.sql"), "utf8");
    assert.match(sql, /idx_kaomoji_slug/);
  });
  it("41 search api route exists", () => assert.ok(existsSync(join(root, "src/app/api/kaomoji/search/route.ts"))));
  it("42 search route uses rate limit import", () => {
    const src = readFileSync(join(root, "src/app/api/kaomoji/search/route.ts"), "utf8");
    assert.match(src, /checkKaomojiSearchRateLimit/);
  });
  it("43 search route uses sanitize", () => {
    const src = readFileSync(join(root, "src/app/api/kaomoji/search/route.ts"), "utf8");
    assert.match(src, /sanitizeSearchRequest/);
  });
  it("44 search route 429 on limit", () => {
    const src = readFileSync(join(root, "src/app/api/kaomoji/search/route.ts"), "utf8");
    assert.match(src, /429/);
  });
  it("45 reduced motion support flag", () => assert.equal(m().accessibility.reduced_motion_support, true));
  it("46 performance indexes counted", () => assert.ok(m().performance.schema_indexes >= 5));
  it("47 accessibility routes counted", () => assert.ok(m().accessibility.semantic_html_routes >= 1));
  it("48 benchmark score in manifest", () => assert.match(m().performance.search_benchmark_score, /\//));
  it("49 warnings array present", () => assert.ok(Array.isArray(m().warnings)));
  it("50 timestamp iso", () => assert.ok(!Number.isNaN(Date.parse(m().timestamp))));
});
