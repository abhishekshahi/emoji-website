import { ANALYTICS_MATURITY } from "./events";
import { getTopCanonicalIds } from "./store";

export type TrendingPeriod = "today" | "week" | "month";

export interface TrendingItem {
  readonly canonicalId: string;
  readonly slug: string;
  readonly score: number;
  readonly source: "live" | "curated";
}

/** Curated fallback until live events exceed threshold. */
const CURATED_TRENDING: readonly TrendingItem[] = [
  { canonicalId: "unicode:1F602", slug: "face-with-tears-of-joy", score: 100, source: "curated" },
  { canonicalId: "unicode:2764", slug: "red-heart", score: 95, source: "curated" },
  { canonicalId: "unicode:1F525", slug: "fire", score: 90, source: "curated" },
  { canonicalId: "unicode:1F44D", slug: "thumbs-up", score: 85, source: "curated" },
  { canonicalId: "unicode:1F389", slug: "party-popper", score: 80, source: "curated" },
];

export function getTrendingItems(_period: TrendingPeriod, limit = 10): readonly TrendingItem[] {
  if (!ANALYTICS_MATURITY.liveEventsEnabled) {
    return CURATED_TRENDING.slice(0, limit);
  }

  const live = getTopCanonicalIds("emoji_copy", limit).map((item, index) => ({
    canonicalId: item.canonicalId,
    slug: item.canonicalId.replace(/^unicode:/, "").toLowerCase(),
    score: item.count,
    source: "live" as const,
  }));

  return live.length > 0 ? live : CURATED_TRENDING.slice(0, limit);
}

export const TRENDING_LABEL = ANALYTICS_MATURITY.liveEventsEnabled
  ? "LIVE ANALYTICS"
  : "TRENDING / CURATED";
