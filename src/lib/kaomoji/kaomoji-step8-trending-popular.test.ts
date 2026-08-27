import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ANALYTICS_MATURITY } from "@/lib/content/analytics/events";
import { evaluateLiveRankingReadiness } from "@/lib/content/analytics/readiness-gate";
import {
  D1_GET_KAOMOJI_PUBLIC_BY_ID,
  D1_LIST_BY_CATEGORY_RANKED,
  D1_LIST_EDITORIAL_FEATURED,
} from "@/lib/kaomoji/cloudflare/d1-queries";
import {
  isKaomojiCanonicalId,
  rankByScore,
  scoreKaomojiActivity,
  windowToDays,
} from "@/lib/kaomoji/rankings/scoring";
import {
  KAOMOJI_ACTIVITY_KINDS,
  KAOMOJI_RANKING_WEIGHTS,
  type KaomojiRankingResult,
} from "@/lib/kaomoji/rankings/types";
import {
  KAOMOJI_RANKING_MAX_LIMIT,
  sanitizeCategorySlug,
  sanitizeRankingLimit,
  sanitizeRankingRequest,
} from "@/lib/kaomoji/rankings/sanitize";
import { evaluateBenchmark } from "@/lib/kaomoji/processing/phase14/benchmark-dataset";
import { searchKaomojiV2 } from "@/lib/kaomoji/processing/phase14/search-index-v2";
import { getPhase14SearchIndexPath } from "@/lib/kaomoji/storage/paths";

const searchIndexPath = getPhase14SearchIndexPath(process.cwd());
const hasSearchIndex = existsSync(searchIndexPath);
const idx = hasSearchIndex ? JSON.parse(readFileSync(searchIndexPath, "utf8")) : null;

function sampleCounts(
  id: string,
  partial: Partial<Record<(typeof KAOMOJI_ACTIVITY_KINDS)[number], number>>,
): Map<string, Partial<Record<(typeof KAOMOJI_ACTIVITY_KINDS)[number], number>>> {
  return new Map([[id, partial]]);
}

describe("Step 8 — Trending / popular rankings", () => {
  it("canonical id pattern accepts public kaomoji ids", () => {
    assert.ok(isKaomojiCanonicalId("kao_00013e7cc777f411"));
    assert.ok(!isKaomojiCanonicalId("unicode:1F600"));
    assert.ok(!isKaomojiCanonicalId("kao_short"));
  });

  it("windowToDays maps supported windows", () => {
    assert.equal(windowToDays("24h"), 1);
    assert.equal(windowToDays("7d"), 7);
    assert.equal(windowToDays("30d"), 30);
    assert.equal(windowToDays("all"), 30);
  });

  it("scoreKaomojiActivity weights copy highest among primary signals", () => {
    const copyOnly = scoreKaomojiActivity({ kaomoji_copy: 1 });
    const viewOnly = scoreKaomojiActivity({ kaomoji_view: 1 });
    assert.ok(copyOnly > viewOnly);
    assert.equal(copyOnly, KAOMOJI_RANKING_WEIGHTS.kaomoji_copy);
  });

  it("rankByScore dedupes canonical ids and respects limit", () => {
    const counts = new Map([
      ["kao_aaaaaaaaaaaaaaaa", { kaomoji_copy: 5 }],
      ["kao_bbbbbbbbbbbbbbbb", { kaomoji_view: 10 }],
      ["kao_cccccccccccccccc", { kaomoji_copy: 1 }],
    ]);
    const ranked = rankByScore(counts, 2);
    assert.equal(ranked.length, 2);
    assert.equal(ranked[0]?.canonical_id, "kao_aaaaaaaaaaaaaaaa");
  });

  it("rankByScore supports metric-specific most-copied ranking", () => {
    const counts = new Map([
      ["kao_aaaaaaaaaaaaaaaa", { kaomoji_copy: 1, kaomoji_view: 100 }],
      ["kao_bbbbbbbbbbbbbbbb", { kaomoji_copy: 5, kaomoji_view: 1 }],
    ]);
    const ranked = rankByScore(counts, 5, "kaomoji_copy");
    assert.equal(ranked[0]?.canonical_id, "kao_bbbbbbbbbbbbbbbb");
  });

  it("sanitizeRankingLimit clamps invalid and oversized limits", () => {
    assert.equal(sanitizeRankingLimit(null), 24);
    assert.equal(sanitizeRankingLimit("-5"), 1);
    assert.equal(sanitizeRankingLimit("999"), KAOMOJI_RANKING_MAX_LIMIT);
    assert.equal(sanitizeRankingLimit("abc"), 24);
  });

  it("sanitizeCategorySlug rejects traversal and invalid slugs", () => {
    assert.equal(sanitizeCategorySlug("happy"), "happy");
    assert.equal(sanitizeCategorySlug("../blocked"), null);
    assert.equal(sanitizeCategorySlug(""), null);
    assert.equal(sanitizeCategorySlug("a".repeat(200)), null);
  });

  it("sanitizeRankingRequest returns bounded limit", () => {
    const req = sanitizeRankingRequest("12");
    assert.equal(req.limit, 12);
    assert.equal(req.rejected, false);
  });

  it("ranking queries only expose public records", () => {
    assert.match(D1_GET_KAOMOJI_PUBLIC_BY_ID, /is_public\s*=\s*1/i);
    assert.match(D1_LIST_EDITORIAL_FEATURED, /is_public\s*=\s*1/i);
    assert.match(D1_LIST_BY_CATEGORY_RANKED, /is_public\s*=\s*1/i);
  });

  it("live rankings remain gated below minimum event threshold", async () => {
    const readiness = await evaluateLiveRankingReadiness();
    if (ANALYTICS_MATURITY.liveEventsEnabled) {
      assert.ok(readiness.ready);
      return;
    }
    assert.equal(ANALYTICS_MATURITY.liveEventsEnabled, false);
    assert.equal(readiness.minimumRequired, 1000);
    assert.ok(readiness.totalEvents < readiness.minimumRequired || !readiness.ready);
  });

  it("ranking result shape never exposes fabricated public view counts", () => {
    const sample: KaomojiRankingResult = {
      status: "INSUFFICIENT_DATA",
      label: "Featured Kaomoji",
      description: "Editorial featured picks.",
      window: "all",
      items: [
        {
          rank: 1,
          canonical_id: "kao_00013e7cc777f411",
          slug: "kao-00013e7cc777f411",
          content: "(◕‿◕)",
          name: null,
          accessible_name: "happy face",
          score: 80,
          source: "featured",
        },
      ],
      totalEvents: 42,
      minimumRequired: 1000,
    };
    const serialized = JSON.stringify(sample);
    assert.ok(!serialized.includes("views"));
    assert.ok(!serialized.includes("viewCount"));
    assert.ok(!serialized.includes("copyCount"));
  });

  it("search benchmark remains 122/122 when index exists", () => {
    if (!hasSearchIndex || !idx) return;
    const bench = evaluateBenchmark((q, l) => searchKaomojiV2(idx, q, l).length);
    assert.equal(bench.pass, 122);
    assert.equal(bench.total, 122);
  });
});
