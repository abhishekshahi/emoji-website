"use client";

import { trackClientEvent } from "@/lib/content/analytics/client";
import type { AnalyticsEventKind } from "@/lib/content/analytics/events";

const KAOMOJI_EVENTS = new Set<AnalyticsEventKind>([
  "kaomoji_search",
  "kaomoji_view",
  "kaomoji_copy",
  "kaomoji_favorite",
  "kaomoji_share",
]);

export function trackKaomojiEvent(
  kind: AnalyticsEventKind,
  canonicalId: string,
  slug?: string,
): void {
  if (!KAOMOJI_EVENTS.has(kind)) return;
  trackClientEvent(kind, canonicalId, slug);
}

export function trackKaomojiSearch(canonicalId: string, slug?: string): void {
  trackKaomojiEvent("kaomoji_search", canonicalId, slug);
}

export function trackKaomojiView(canonicalId: string, slug: string): void {
  trackKaomojiEvent("kaomoji_view", canonicalId, slug);
}

export function trackKaomojiCopy(canonicalId: string, slug?: string): void {
  trackKaomojiEvent("kaomoji_copy", canonicalId, slug);
}

export function trackKaomojiFavorite(canonicalId: string, slug?: string): void {
  trackKaomojiEvent("kaomoji_favorite", canonicalId, slug);
}

export function trackKaomojiShare(canonicalId: string, slug: string): void {
  trackKaomojiEvent("kaomoji_share", canonicalId, slug);
}
