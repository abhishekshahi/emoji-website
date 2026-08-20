import type { AnalyticsEvent, AnalyticsEventKind } from "./events";

const STORAGE_KEY = "emojiquick-analytics-v1";
const MAX_EVENTS = 500;

export interface StoredAnalyticsSnapshot {
  readonly events: readonly AnalyticsEvent[];
  readonly aggregated: Readonly<Record<AnalyticsEventKind, Readonly<Record<string, number>>>>;
}

function emptyAggregated(): Record<AnalyticsEventKind, Record<string, number>> {
  return {
    emoji_search: {},
    emoji_view: {},
    emoji_copy: {},
    emoji_favorite: {},
    emoji_unfavorite: {},
    emoji_share: {},
    kaomoji_search: {},
    kaomoji_view: {},
    kaomoji_copy: {},
    kaomoji_favorite: {},
    kaomoji_share: {},
    related_click: {},
    collection_view: {},
    collection_click: {},
    combination_view: {},
    combination_copy: {},
    generator_use: {},
  };
}

/** Privacy-safe in-browser event buffer — no PII, no message content. */
export function readStoredEvents(): StoredAnalyticsSnapshot {
  if (typeof window === "undefined") {
    return { events: [], aggregated: emptyAggregated() };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { events: [], aggregated: emptyAggregated() };
    return JSON.parse(raw) as StoredAnalyticsSnapshot;
  } catch {
    return { events: [], aggregated: emptyAggregated() };
  }
}

export function appendStoredEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined") return;
  const snapshot = readStoredEvents();
  const events = [...snapshot.events, event].slice(-MAX_EVENTS);
  const aggregated = { ...emptyAggregated(), ...snapshot.aggregated };
  const bucket = { ...(aggregated[event.kind] ?? {}) };
  bucket[event.canonicalId] = (bucket[event.canonicalId] ?? 0) + 1;
  aggregated[event.kind] = bucket;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ events, aggregated }));
}

export function getTopCanonicalIds(
  kind: AnalyticsEventKind,
  limit = 10,
): readonly { canonicalId: string; count: number }[] {
  const snapshot = readStoredEvents();
  const bucket = snapshot.aggregated[kind] ?? {};
  return Object.entries(bucket)
    .map(([canonicalId, count]) => ({ canonicalId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getEventCountForCanonical(kind: AnalyticsEventKind, canonicalId: string): number {
  const snapshot = readStoredEvents();
  return snapshot.aggregated[kind]?.[canonicalId] ?? 0;
}
