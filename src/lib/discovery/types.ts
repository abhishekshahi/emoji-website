export type DiscoveryPeriod = "today" | "week" | "month";

export type PopularSort = "copied" | "searched" | "saved" | "viewed";

export type DiscoveryContext =
  | "instagram"
  | "discord"
  | "tiktok"
  | "whatsapp"
  | "x"
  | "gaming"
  | "work";

export interface DiscoveryEmojiEntry {
  readonly slug: string;
  readonly name: string;
  readonly emoji: string;
  readonly hexcode: string;
  readonly score: number;
  readonly rank: number;
}

export interface DiscoveryResponse {
  readonly label: string;
  readonly source: "baseline" | "aggregate";
  readonly period?: DiscoveryPeriod;
  readonly sort?: PopularSort;
  readonly context?: DiscoveryContext;
  readonly items: readonly DiscoveryEmojiEntry[];
  readonly generatedAt: string;
  readonly cached: boolean;
}

/** Privacy-conscious analytics event — aggregate counters only, no PII. */
export interface DiscoveryAnalyticsEvent {
  readonly event: "copy" | "search" | "save" | "view";
  readonly slug: string;
  readonly timestamp: number;
}
