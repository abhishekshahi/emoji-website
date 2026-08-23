import { ANALYTICS_MATURITY } from "@/lib/content/analytics/events";
import { getTopCanonicalIds } from "@/lib/content/analytics/store";

export type KaomojiTrendingStatus = "INSUFFICIENT_DATA" | "LIVE";

export interface KaomojiTrendingItem {
  readonly canonicalId: string;
  readonly slug: string;
  readonly score: number;
  readonly source: "live" | "curated";
}

export interface KaomojiTrendingResult {
  readonly status: KaomojiTrendingStatus;
  readonly label: string;
  readonly items: readonly KaomojiTrendingItem[];
}

/** No fabricated kaomoji popularity — curated empty until live threshold. */
export function getKaomojiTrending(limit = 10): KaomojiTrendingResult {
  if (!ANALYTICS_MATURITY.liveEventsEnabled) {
    return { status: "INSUFFICIENT_DATA", label: "TRENDING / CURATED", items: [] };
  }
  const live = getTopCanonicalIds("kaomoji_copy", limit)
    .filter((item) => item.canonicalId.startsWith("kaomoji:"))
    .map((item) => ({
      canonicalId: item.canonicalId,
      slug: item.canonicalId.replace(/^kaomoji:/, ""),
      score: item.count,
      source: "live" as const,
    }));
  if (live.length === 0) {
    return { status: "INSUFFICIENT_DATA", label: "TRENDING / CURATED", items: [] };
  }
  return { status: "LIVE", label: "LIVE ANALYTICS", items: live };
}
