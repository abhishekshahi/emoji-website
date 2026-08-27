import "server-only";
import { evaluateLiveRankingReadiness } from "@/lib/content/analytics/readiness-gate";
import { readKaomojiActivityWindow } from "@/lib/content/analytics/server-ingest";
import { resolveKaomojiD1Binding } from "./d1-binding";
import {
  D1_GET_KAOMOJI_PUBLIC_BY_ID,
  D1_LIST_BY_CATEGORY_RANKED,
  D1_LIST_EDITORIAL_FEATURED,
} from "./d1-queries";
import { rankByScore, windowToDays } from "../rankings/scoring";
import type {
  KaomojiActivityKind,
  KaomojiRankingItem,
  KaomojiRankingResult,
  KaomojiRankingWindow,
} from "../rankings/types";

interface D1RankRow {
  canonical_id: string;
  slug: string;
  content: string;
  editorial_name: string | null;
  accessible_name: string;
  quality_score: number;
}

async function resolvePublicRows(ids: readonly string[]): Promise<Map<string, D1RankRow>> {
  const db = await resolveKaomojiD1Binding();
  const map = new Map<string, D1RankRow>();
  if (!db) return map;
  for (const id of ids) {
    const row = await db.prepare(D1_GET_KAOMOJI_PUBLIC_BY_ID).bind(id).all<D1RankRow>();
    const hit = row.results?.[0];
    if (hit) map.set(id, hit);
  }
  return map;
}

function editorialFeaturedItems(rows: readonly D1RankRow[]): KaomojiRankingItem[] {
  return rows.map((row, index) => ({
    rank: index + 1,
    canonical_id: row.canonical_id,
    slug: row.slug,
    content: row.content,
    name: row.editorial_name,
    accessible_name: row.accessible_name,
    score: row.quality_score,
    source: "featured" as const,
  }));
}

async function featuredFallback(limit: number, description: string): Promise<KaomojiRankingResult> {
  const readiness = await evaluateLiveRankingReadiness();
  const db = await resolveKaomojiD1Binding();
  const rows = db
    ? (await db.prepare(D1_LIST_EDITORIAL_FEATURED).bind(limit).all<D1RankRow>()).results ?? []
    : [];
  return {
    status: "INSUFFICIENT_DATA",
    label: "Featured Kaomoji",
    description,
    window: "all",
    items: editorialFeaturedItems(rows),
    totalEvents: readiness.totalEvents,
    minimumRequired: readiness.minimumRequired,
  };
}

async function liveRanking(params: {
  window: KaomojiRankingWindow;
  limit: number;
  label: string;
  description: string;
  metric?: KaomojiActivityKind;
  compareRising?: boolean;
}): Promise<KaomojiRankingResult> {
  const readiness = await evaluateLiveRankingReadiness();
  if (!readiness.ready) {
    return featuredFallback(
      params.limit,
      "Live popularity data is still gathering. These are editorial featured picks — not user popularity rankings.",
    );
  }

  const days = windowToDays(params.window) as 1 | 7 | 30;
  const recent = await readKaomojiActivityWindow(days);

  let ranked = rankByScore(recent, params.limit * 2, params.metric);

  if (params.compareRising && days === 7) {
    const prior = await readKaomojiActivityWindow(7, 7);
    const recentRanked = rankByScore(recent, params.limit * 3);
    ranked = recentRanked
      .map((entry) => {
        const recentKinds = recent.get(entry.canonical_id) ?? {};
        const priorKinds = prior.get(entry.canonical_id) ?? {};
        const recentScore = params.metric
          ? (recentKinds[params.metric] ?? 0)
          : Object.entries(recentKinds).reduce((s, [, c]) => s + (c ?? 0), 0);
        const priorScore = params.metric
          ? (priorKinds[params.metric] ?? 0)
          : Object.entries(priorKinds).reduce((s, [, c]) => s + (c ?? 0), 0);
        const delta = recentScore - priorScore;
        return { canonical_id: entry.canonical_id, score: delta > 0 ? delta : 0 };
      })
      .filter((e) => e.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, params.limit);
  } else {
    ranked = ranked.slice(0, params.limit);
  }

  if (ranked.length === 0) {
    return featuredFallback(params.limit, "No measurable activity yet for this window.");
  }

  const rows = await resolvePublicRows(ranked.map((r) => r.canonical_id));
  const items: KaomojiRankingItem[] = [];
  for (const entry of ranked) {
    const row = rows.get(entry.canonical_id);
    if (!row) continue;
    items.push({
      rank: items.length + 1,
      canonical_id: row.canonical_id,
      slug: row.slug,
      content: row.content,
      name: row.editorial_name,
      accessible_name: row.accessible_name,
      score: entry.score,
      source: "live",
    });
    if (items.length >= params.limit) break;
  }

  if (items.length === 0) {
    return featuredFallback(params.limit, "Activity was recorded but no public kaomoji matched.");
  }

  return {
    status: "LIVE",
    label: params.label,
    description: params.description,
    window: params.window,
    items,
    totalEvents: readiness.totalEvents,
    minimumRequired: readiness.minimumRequired,
  };
}

export async function getKaomojiPopularRanking(
  window: KaomojiRankingWindow = "30d",
  limit = 24,
): Promise<KaomojiRankingResult> {
  return liveRanking({
    window,
    limit,
    label: window === "7d" ? "Popular This Week" : "Popular Kaomoji",
    description: "Ranked by real copy, view, favorite, and share activity. Counts are not displayed.",
  });
}

export async function getKaomojiMostCopiedRanking(
  window: KaomojiRankingWindow = "7d",
  limit = 24,
): Promise<KaomojiRankingResult> {
  return liveRanking({
    window,
    limit,
    label: "Most Copied",
    description: "Ranked by verified copy events only.",
    metric: "kaomoji_copy",
  });
}

export async function getKaomojiTrendingRanking(limit = 24): Promise<KaomojiRankingResult> {
  return liveRanking({
    window: "7d",
    limit,
    label: "Trending Kaomoji",
    description: "Strongest recent activity in the last 7 days.",
  });
}

export async function getKaomojiRisingRanking(limit = 24): Promise<KaomojiRankingResult> {
  return liveRanking({
    window: "7d",
    limit,
    label: "Rising Kaomoji",
    description: "Kaomoji gaining activity compared to the prior week.",
    compareRising: true,
  });
}

export async function getKaomojiCategoryFeatured(
  categorySlug: string,
  limit = 24,
): Promise<KaomojiRankingResult> {
  const readiness = await evaluateLiveRankingReadiness();
  const db = await resolveKaomojiD1Binding();
  if (!db) {
    return featuredFallback(limit, "Editorial picks for this category.");
  }

  if (readiness.ready) {
    const days = 7 as const;
    const recent = await readKaomojiActivityWindow(days);
    const categoryRows =
      (await db.prepare(D1_LIST_BY_CATEGORY_RANKED).bind(categorySlug, 200).all<D1RankRow>()).results ?? [];
    const allowed = new Set(categoryRows.map((r) => r.canonical_id));
    const ranked = rankByScore(recent, limit * 3)
      .filter((e) => allowed.has(e.canonical_id))
      .slice(0, limit);
    if (ranked.length >= 3) {
      const rows = await resolvePublicRows(ranked.map((r) => r.canonical_id));
      const items: KaomojiRankingItem[] = [];
      for (const entry of ranked) {
        const row = rows.get(entry.canonical_id);
        if (!row) continue;
        items.push({
          rank: items.length + 1,
          canonical_id: row.canonical_id,
          slug: row.slug,
          content: row.content,
          name: row.editorial_name,
          accessible_name: row.accessible_name,
          score: entry.score,
          source: "live",
        });
      }
      if (items.length >= 3) {
        return {
          status: "LIVE",
          label: "Trending in category",
          description: "Recent activity within this category.",
          window: "7d",
          items,
          totalEvents: readiness.totalEvents,
          minimumRequired: readiness.minimumRequired,
        };
      }
    }
  }

  const rows =
    (await db.prepare(D1_LIST_BY_CATEGORY_RANKED).bind(categorySlug, limit).all<D1RankRow>()).results ?? [];
  return {
    status: "INSUFFICIENT_DATA",
    label: "Featured in category",
    description: "Editorial quality picks in this category.",
    window: "all",
    items: editorialFeaturedItems(rows),
    totalEvents: readiness.totalEvents,
    minimumRequired: readiness.minimumRequired,
  };
}

export async function getKaomojiRecordRank(canonicalId: string): Promise<{
  popularRank: number | null;
  trendingRank: number | null;
  status: "LIVE" | "INSUFFICIENT_DATA";
}> {
  const readiness = await evaluateLiveRankingReadiness();
  if (!readiness.ready) {
    return { popularRank: null, trendingRank: null, status: "INSUFFICIENT_DATA" };
  }
  const popular = await getKaomojiPopularRanking("30d", 100);
  const trending = await getKaomojiTrendingRanking(100);
  const popularRank = popular.items.find((i) => i.canonical_id === canonicalId)?.rank ?? null;
  const trendingRank = trending.items.find((i) => i.canonical_id === canonicalId)?.rank ?? null;
  return {
    popularRank,
    trendingRank,
    status: popular.status === "LIVE" || trending.status === "LIVE" ? "LIVE" : "INSUFFICIENT_DATA",
  };
}
