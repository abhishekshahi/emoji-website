export type AnalyticsEventKind =
  | "emoji_search"
  | "emoji_view"
  | "emoji_copy"
  | "emoji_favorite"
  | "emoji_unfavorite"
  | "emoji_share"
  | "kaomoji_search"
  | "kaomoji_view"
  | "kaomoji_copy"
  | "kaomoji_favorite"
  | "kaomoji_share"
  | "related_click"
  | "collection_view"
  | "collection_click"
  | "combination_view"
  | "combination_copy"
  | "generator_use";

export interface AnalyticsEvent {
  readonly kind: AnalyticsEventKind;
  readonly canonicalId: string;
  readonly slug?: string;
  readonly timestamp: string;
  readonly sessionId?: string;
  readonly locale?: string;
  readonly searchLanguage?: string;
}

export interface AnalyticsAggregation {
  readonly label: string;
  readonly source: "baseline" | "live";
  readonly period?: "today" | "week" | "month";
  readonly items: readonly { canonicalId: string; slug: string; count: number }[];
}

/** Event schema foundation — no PII fields by design. */
export function createAnalyticsEvent(
  kind: AnalyticsEventKind,
  canonicalId: string,
  slug?: string,
  locale?: string,
  searchLanguage?: string,
): AnalyticsEvent {
  return Object.freeze({
    kind,
    canonicalId,
    slug,
    timestamp: new Date().toISOString(),
    ...(locale ? { locale } : {}),
    ...(searchLanguage ? { searchLanguage } : {}),
  });
}

/** Rankings remain editorial until sufficient live aggregate events exist. */
export const ANALYTICS_MATURITY = Object.freeze({
  liveEventsEnabled: false,
  ingestEnabled: true,
  minimumEventsForTrending: 1000,
  rankingLabel: "POPULAR / CURATED" as const,
});
