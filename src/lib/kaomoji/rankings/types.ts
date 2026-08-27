import type { AnalyticsEventKind } from "@/lib/content/analytics/events";

export type KaomojiRankingSource = "live" | "featured";
export type KaomojiRankingStatus = "LIVE" | "INSUFFICIENT_DATA";

export type KaomojiRankingWindow = "24h" | "7d" | "30d" | "all";

export type KaomojiPopularKind = "popular" | "most_copied";
export type KaomojiTrendingKind = "trending" | "rising";

export interface KaomojiRankingItem {
  readonly rank: number;
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly name: string | null;
  readonly accessible_name: string;
  /** Internal score for ordering — never shown as a fabricated view count. */
  readonly score: number;
  readonly source: KaomojiRankingSource;
}

export interface KaomojiRankingResult {
  readonly status: KaomojiRankingStatus;
  readonly label: string;
  readonly description: string;
  readonly window: KaomojiRankingWindow;
  readonly items: readonly KaomojiRankingItem[];
  readonly totalEvents: number;
  readonly minimumRequired: number;
}

export const KAOMOJI_ACTIVITY_KINDS = [
  "kaomoji_copy",
  "kaomoji_view",
  "kaomoji_favorite",
  "kaomoji_share",
  "kaomoji_search",
] as const satisfies readonly AnalyticsEventKind[];

export type KaomojiActivityKind = (typeof KAOMOJI_ACTIVITY_KINDS)[number];

export const KAOMOJI_RANKING_WEIGHTS: Readonly<Record<KaomojiActivityKind, number>> = {
  kaomoji_copy: 3,
  kaomoji_view: 1,
  kaomoji_favorite: 2,
  kaomoji_share: 2,
  kaomoji_search: 0.5,
};
