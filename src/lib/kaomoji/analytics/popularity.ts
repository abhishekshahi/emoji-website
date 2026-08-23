import { ANALYTICS_MATURITY } from "@/lib/content/analytics/events";
import { getEventCountForCanonical } from "@/lib/content/analytics/store";

export type KaomojiPopularityStatus = "INSUFFICIENT_DATA" | "LIVE";

export interface KaomojiPopularityResult {
  readonly status: KaomojiPopularityStatus;
  readonly label: string;
  readonly copyCount?: number;
  readonly viewCount?: number;
}

export function getKaomojiPopularity(canonicalId: string): KaomojiPopularityResult {
  if (!ANALYTICS_MATURITY.liveEventsEnabled) {
    return { status: "INSUFFICIENT_DATA", label: "POPULAR / CURATED" };
  }
  const copyCount = getEventCountForCanonical("kaomoji_copy", canonicalId);
  const viewCount = getEventCountForCanonical("kaomoji_view", canonicalId);
  const total = copyCount + viewCount;
  if (total < ANALYTICS_MATURITY.minimumEventsForTrending) {
    return { status: "INSUFFICIENT_DATA", label: "POPULAR / CURATED", copyCount, viewCount };
  }
  return { status: "LIVE", label: "LIVE ANALYTICS", copyCount, viewCount };
}
