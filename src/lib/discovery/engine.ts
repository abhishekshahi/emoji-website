import { getEmojiBySlug } from "@/lib/emoji/data";
import {
  DISCOVERY_PAYLOAD_LIMIT,
  getBaselineContextSlugs,
  getBaselinePopularSlugs,
  getBaselineTrendingSlugs,
  VALID_DISCOVERY_CONTEXTS,
  VALID_DISCOVERY_PERIODS,
  VALID_POPULAR_SORTS,
} from "./baseline-rankings";
import { getCachedDiscovery, setCachedDiscovery } from "./cache";
import type {
  DiscoveryContext,
  DiscoveryEmojiEntry,
  DiscoveryPeriod,
  DiscoveryResponse,
  PopularSort,
} from "./types";

const PERIOD_LABELS: Record<DiscoveryPeriod, string> = {
  today: "Trending Today",
  week: "Trending This Week",
  month: "Trending This Month",
};

const SORT_LABELS: Record<PopularSort, string> = {
  copied: "Most Copied",
  searched: "Most Searched",
  saved: "Most Saved",
  viewed: "Most Viewed",
};

const CONTEXT_LABELS: Record<DiscoveryContext, string> = {
  instagram: "Instagram",
  discord: "Discord",
  tiktok: "TikTok",
  whatsapp: "WhatsApp",
  x: "X (Twitter)",
  gaming: "Gaming",
  work: "Work & Productivity",
};

function resolveSlugsToEntries(slugs: readonly string[]): DiscoveryEmojiEntry[] {
  const entries: DiscoveryEmojiEntry[] = [];
  for (let i = 0; i < slugs.length && entries.length < DISCOVERY_PAYLOAD_LIMIT; i++) {
    const emoji = getEmojiBySlug(slugs[i]!);
    if (!emoji) continue;
    entries.push(
      Object.freeze({
        slug: emoji.slug,
        name: emoji.name,
        emoji: emoji.emoji,
        hexcode: emoji.hexcode,
        score: DISCOVERY_PAYLOAD_LIMIT - entries.length,
        rank: entries.length + 1,
      }),
    );
  }
  return entries;
}

function buildResponse(
  key: string,
  label: string,
  items: DiscoveryEmojiEntry[],
  extra: Partial<DiscoveryResponse>,
): DiscoveryResponse {
  const cached = getCachedDiscovery(key);
  if (cached) return cached;

  const response: DiscoveryResponse = Object.freeze({
    label,
    source: "baseline",
    items: Object.freeze(items),
    generatedAt: new Date().toISOString(),
    cached: false,
    ...extra,
  });

  setCachedDiscovery(key, response);
  return response;
}

export function getTrendingDiscovery(period: DiscoveryPeriod): DiscoveryResponse {
  const key = `trending:${period}`;
  return buildResponse(key, PERIOD_LABELS[period], resolveSlugsToEntries(getBaselineTrendingSlugs(period)), { period });
}

export function getPopularDiscovery(sort: PopularSort): DiscoveryResponse {
  const key = `popular:${sort}`;
  return buildResponse(key, SORT_LABELS[sort], resolveSlugsToEntries(getBaselinePopularSlugs(sort)), { sort });
}

export function getContextDiscovery(context: DiscoveryContext): DiscoveryResponse {
  const key = `context:${context}`;
  return buildResponse(key, `${CONTEXT_LABELS[context]} Context`, resolveSlugsToEntries(getBaselineContextSlugs(context)), { context });
}

export function parseDiscoveryPeriod(value: string | null): DiscoveryPeriod | null {
  if (!value) return "today";
  return VALID_DISCOVERY_PERIODS.includes(value as DiscoveryPeriod) ? (value as DiscoveryPeriod) : null;
}

export function parsePopularSort(value: string | null): PopularSort | null {
  if (!value) return "copied";
  return VALID_POPULAR_SORTS.includes(value as PopularSort) ? (value as PopularSort) : null;
}

export function parseDiscoveryContext(value: string): DiscoveryContext | null {
  return VALID_DISCOVERY_CONTEXTS.includes(value as DiscoveryContext) ? (value as DiscoveryContext) : null;
}
