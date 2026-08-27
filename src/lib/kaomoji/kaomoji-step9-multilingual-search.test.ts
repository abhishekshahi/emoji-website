import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { detectQueryLanguage } from "@/lib/kaomoji/localization/language-detect";
import {
  getMultilingualSearchSuggestions,
  resolveMultilingualSearchQuery,
} from "@/lib/kaomoji/localization/multilingual-search";
import {
  LOCALIZED_SEARCH_TERMS,
  lookupLocalizedEnglishTokens,
  parseKaomojiSearchLocale,
  resolveLocalizedSearchQuery,
} from "@/lib/kaomoji/localization/search-terms";
import { getPhase14SearchIndexPath } from "@/lib/kaomoji/storage/paths";

const searchIndexPath = getPhase14SearchIndexPath(process.cwd());
const hasSearchIndex = existsSync(searchIndexPath);
const idx = hasSearchIndex ? JSON.parse(readFileSync(searchIndexPath, "utf8")) : null;

describe("Step 9 — Multilingual kaomoji search", () => {
  it("detects Hindi Devanagari script", () => {
    assert.equal(detectQueryLanguage("खुश"), "hi");
  });

  it("detects Japanese script", () => {
    assert.equal(detectQueryLanguage("嬉しい"), "ja");
  });

  it("detects Korean script", () => {
    assert.equal(detectQueryLanguage("행복"), "ko");
  });

  it("resolves Chinese script via multi-locale lookup", () => {
    assert.equal(detectQueryLanguage("开心"), null);
    const resolved = resolveMultilingualSearchQuery("开心", "auto");
    assert.ok(resolved.resolvedQuery.includes("happy"));
  });

  it("maps Hindi खुश to happy tokens", () => {
    const resolved = resolveMultilingualSearchQuery("खुश", "auto");
    assert.ok(resolved.resolvedQuery.includes("happy"));
  });

  it("maps Spanish feliz to happy", () => {
    const resolved = resolveMultilingualSearchQuery("feliz", "es");
    assert.ok(resolved.resolvedQuery.includes("happy"));
  });

  it("maps Japanese 愛 to love", () => {
    const resolved = resolveMultilingualSearchQuery("愛", "auto");
    assert.ok(resolved.resolvedQuery.includes("love"));
  });

  it("maps Korean 사랑 to love", () => {
    const resolved = resolveMultilingualSearchQuery("사랑", "auto");
    assert.ok(resolved.resolvedQuery.includes("love"));
  });

  it("maps Chinese 拥抱 to hug", () => {
    const resolved = resolveMultilingualSearchQuery("拥抱", "auto");
    assert.ok(resolved.resolvedQuery.includes("hug"));
  });

  it("supports mixed-language cute + Hindi token", () => {
    const resolved = resolveMultilingualSearchQuery("cute kaomoji प्यार", "auto");
    assert.ok(resolved.resolvedQuery.includes("cute"));
    assert.ok(resolved.resolvedQuery.includes("love"));
  });

  it("parseKaomojiSearchLocale rejects invalid locale", () => {
    assert.equal(parseKaomojiSearchLocale("xx"), "auto");
    assert.equal(parseKaomojiSearchLocale("ja"), "ja");
  });

  it("suggestions are taxonomy-only", () => {
    const suggestions = getMultilingualSearchSuggestions("", "es", 5);
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.every((s) => s.englishTokens.length > 0));
  });

  it("localized terms have controlled confidence only", () => {
    assert.ok(LOCALIZED_SEARCH_TERMS.every((t) => t.confidence === "CONTROLLED"));
    assert.ok(LOCALIZED_SEARCH_TERMS.length >= 80);
  });

  it("lookup returns empty for unknown mapping", () => {
    assert.deepEqual(lookupLocalizedEnglishTokens("not-a-real-word-xyz", "hi"), []);
  });

  it("resolveLocalizedSearchQuery keeps English passthrough", () => {
    assert.equal(resolveLocalizedSearchQuery("happy", "en"), "happy");
  });

  it("English benchmark remains 122/122 when index exists", () => {
    if (!hasSearchIndex || !idx) return;
    const bench = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
    assert.equal(bench.pass, 122);
    assert.equal(bench.total, 122);
  });

  it("multilingual resolved queries return results for es lindo", () => {
    if (!hasSearchIndex || !idx) return;
    const resolved = resolveMultilingualSearchQuery("lindo", "es");
    assert.ok(searchKaomojiV2(idx, resolved.resolvedQuery, 5).length >= 3);
  });

  it("multilingual resolved queries return results for ja 嬉しい", () => {
    if (!hasSearchIndex || !idx) return;
    const resolved = resolveMultilingualSearchQuery("嬉しい", "auto");
    assert.ok(searchKaomojiV2(idx, resolved.resolvedQuery, 5).length >= 3);
  });
});
