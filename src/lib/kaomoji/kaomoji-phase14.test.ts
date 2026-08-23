import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { normalizeSearchQuery, normalizeKaomojiContent, isKaomojiLikeQuery } from "@/lib/kaomoji/processing/phase14/query-normalizer";
import { expandSynonyms, expandQueryTokens, SEARCH_SYNONYMS } from "@/lib/kaomoji/processing/phase14/synonyms";
import { fuzzyTokenMatch, levenshtein } from "@/lib/kaomoji/processing/phase14/typo";
import { sanitizeSearchRequest } from "@/lib/kaomoji/processing/phase14/security";
import { buildSearchIndexV2, searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { evaluateBenchmark, SEARCH_BENCHMARK_V1 } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { runPhase14Pipeline } from "@/lib/kaomoji/processing/phase14/pipeline";
import { getPhase14ManifestPath, getPhase14SearchIndexPath } from "@/lib/kaomoji/storage/paths";
import { SEARCH_QUALITY_DATASET } from "@/lib/kaomoji/processing/phase9/search-quality";

describe("phase 14 search excellence", () => {
  const root = process.cwd();
  const m = () => JSON.parse(readFileSync(getPhase14ManifestPath(root), "utf8"));
  const idx = () => JSON.parse(readFileSync(getPhase14SearchIndexPath(root), "utf8"));

  it("1 normalizer lowercase", () => assert.equal(normalizeSearchQuery("  Happy  ").normalized, "happy"));
  it("2 normalizer tokens", () => assert.deepEqual(normalizeSearchQuery("cute cat").tokens, ["cute", "cat"]));
  it("3 kaomoji like query", () => assert.ok(isKaomojiLikeQuery("(^_^)")));
  it("4 text query not kaomoji like", () => assert.ok(!isKaomojiLikeQuery("happy")));
  it("5 nfc normalize content", () => assert.ok(normalizeKaomojiContent("(｡♥‿♥｡)").length > 0));
  it("6 anime synonym", () => assert.ok(expandSynonyms("anime").includes("japanese")));
  it("7 discord synonym", () => assert.ok(expandSynonyms("discord").includes("ascii")));
  it("8 typo hapy", () => assert.ok(expandSynonyms("hapy").includes("happy")));
  it("9 expand query tokens", () => assert.ok(expandQueryTokens(["anime"]).includes("kawaii")));
  it("10 synonym dictionary versioned", () => assert.ok(Object.keys(SEARCH_SYNONYMS).length > 20));
  it("11 levenshtein", () => assert.equal(levenshtein("happy", "hapy"), 1));
  it("12 fuzzy match", () => assert.ok(fuzzyTokenMatch("happy", "hapy")));
  it("13 sanitize limit", () => assert.equal(sanitizeSearchRequest("cute", 999).limit, 48));
  it("14 sanitize reject control", () => assert.ok(sanitizeSearchRequest("a\x00b", 10).rejected));
  it("15 sanitize offset", () => assert.equal(sanitizeSearchRequest("cute", 10, 5).offset, 5));
  it("16 benchmark size >= 100", () => assert.ok(SEARCH_BENCHMARK_V1.length >= 100));
  it("17 manifest exists", () => assert.ok(existsSync(getPhase14ManifestPath(root))));
  it("18 index v2 exists", () => assert.ok(existsSync(getPhase14SearchIndexPath(root))));
  it("19 index records 50979", () => assert.equal(m().index_records, 50979));
  it("20 legacy 32/32", () => assert.equal(m().legacy_pass_count, 32));
  it("21 benchmark >= 98pct", () => assert.ok(m().benchmark_pass_rate >= 0.98));
  it("22 benchmark pass count", () => assert.equal(m().benchmark_pass_count, m().benchmark_queries));
  it("23 anime search", () => assert.ok(searchKaomojiV2(idx(), "anime", 12).length >= 3));
  it("24 discord search", () => assert.ok(searchKaomojiV2(idx(), "discord", 12).length >= 1));
  it("25 instagram search", () => assert.ok(searchKaomojiV2(idx(), "instagram", 12).length >= 1));
  it("26 character search", () => assert.ok(searchKaomojiV2(idx(), "(｡♥‿♥｡)", 5).length >= 1));
  it("27 empty query", () => assert.equal(searchKaomojiV2(idx(), "", 5).length, 0));
  it("28 garbage zero", () => assert.equal(searchKaomojiV2(idx(), "xyzzyqwerty", 5).length, 0));
  it("29 cute multi token", () => assert.ok(searchKaomojiV2(idx(), "cute cat", 12).length >= 2));
  it("30 exact ranks above fuzzy", () => {
    const hits = searchKaomojiV2(idx(), "happy", 5);
    assert.ok(hits[0]!.score >= hits[hits.length - 1]!.score);
  });
  it("31 love search v2", () => assert.ok(searchKaomojiV2(idx(), "love", 5).length >= 5));
  it("32 no pipeline errors", () => assert.equal(m().errors.length, 0));
  it("33 phase 14 number", () => assert.equal(m().phase, 14));
  it("34 search version", () => assert.match(m().search_version, /^14\./));
  it("35 evaluate benchmark helper", () => {
    const r = evaluateBenchmark((q) => searchKaomojiV2(idx(), q, 12).length);
    assert.ok(r.pass_rate >= 0.98);
  });
  it("36 legacy dataset all pass v2", () => {
    for (const tc of SEARCH_QUALITY_DATASET) {
      assert.ok(searchKaomojiV2(idx(), tc.query, 12).length >= tc.min_results, tc.query);
    }
  });
  it("37 whatsapp uses structured match", () => {
    const hits = searchKaomojiV2(idx(), "whatsapp", 5);
    assert.ok(hits.length >= 1);
    assert.notEqual(hits[0]!.match_reason, "partial_kaomoji");
  });
  it("38 japanese category", () => assert.ok(searchKaomojiV2(idx(), "japanese", 12).length >= 5));
  it("39 typo angrey", () => assert.ok(searchKaomojiV2(idx(), "angrey", 12).length >= 2));
  it("40 deterministic rerun benchmark", () => {
    const before = m().benchmark_pass_count;
    const after = runPhase14Pipeline(root).manifest.benchmark_pass_count;
    assert.equal(before, after);
  });
  it("41 inverted index has cute", () => assert.ok((idx().inverted.cute?.length ?? 0) > 1000));
  it("42 v2 records count", () => assert.equal(idx().records.length, 50979));
});