import type { KaomojiRankingResult } from "@/lib/kaomoji/rankings/types";

interface KaomojiRankingBadgeProps {
  readonly popularRank: number | null;
  readonly trendingRank: number | null;
  readonly status: "LIVE" | "INSUFFICIENT_DATA";
}

/** Shows rank labels only — never fabricated view/copy counts. */
export function KaomojiRankingBadge({ popularRank, trendingRank, status }: KaomojiRankingBadgeProps) {
  if (status !== "LIVE") return null;
  if (trendingRank !== null && trendingRank <= 20) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium">
        Trending #{trendingRank}
      </span>
    );
  }
  if (popularRank !== null && popularRank <= 50) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-xs font-medium">
        Popular #{popularRank}
      </span>
    );
  }
  return null;
}

export function rankingPageIntro(result: KaomojiRankingResult): string {
  if (result.status === "LIVE") {
    return result.description;
  }
  return `${result.description} Showing editorial featured picks until enough real activity is collected.`;
}
