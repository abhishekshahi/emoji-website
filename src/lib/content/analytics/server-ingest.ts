import { resolveMasterR2Binding } from "@/lib/r2/binding";
import type { AnalyticsEventKind } from "./events";
import type { ValidatedAnalyticsEvent } from "./validation";

const ANALYTICS_PREFIX = "private/analytics/v1/daily";

type DayAggregate = Record<AnalyticsEventKind, Record<string, number>>;

function emptyDay(): DayAggregate {
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

function dayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function aggregatePath(dateKey: string): string {
  return `${ANALYTICS_PREFIX}/${dateKey}.json`;
}

async function readAggregate(bucket: NonNullable<Awaited<ReturnType<typeof resolveMasterR2Binding>>>, path: string): Promise<DayAggregate> {
  try {
    const existing = await bucket.get(path);
    if (!existing?.body) return emptyDay();
    const text = await new Response(existing.body).text();
    const parsed = JSON.parse(text) as Partial<DayAggregate>;
    return { ...emptyDay(), ...parsed };
  } catch {
    return emptyDay();
  }
}

export async function ingestAnalyticsEvents(events: readonly ValidatedAnalyticsEvent[]): Promise<number> {
  if (events.length === 0) return 0;
  const bucket = await resolveMasterR2Binding();
  if (!bucket?.put) return 0;

  const path = aggregatePath(dayKey());
  const aggregate = await readAggregate(bucket, path);

  for (const event of events) {
    const bucketMap = { ...(aggregate[event.kind] ?? {}) };
    bucketMap[event.canonicalId] = (bucketMap[event.canonicalId] ?? 0) + 1;
    aggregate[event.kind] = bucketMap;
  }

  await bucket.put(path, JSON.stringify(aggregate), {
    httpMetadata: { contentType: "application/json" },
  });

  return events.length;
}

export async function readAggregateTotals(): Promise<{ total: number; byKind: Record<string, number> }> {
  const bucket = await resolveMasterR2Binding();
  if (!bucket) return { total: 0, byKind: {} };

  const path = aggregatePath(dayKey());
  const data = await readAggregate(bucket, path);
  let total = 0;
  const byKind: Record<string, number> = {};
  for (const [kind, map] of Object.entries(data)) {
    const sum = Object.values(map ?? {}).reduce((a, b) => a + b, 0);
    byKind[kind] = sum;
    total += sum;
  }
  return { total, byKind };
}

function dateKeysForWindow(days: number, end = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - offset);
    keys.push(dayKey(d));
  }
  return keys;
}

function dateKeysForPriorWindow(days: number, skipDays: number, end = new Date()): string[] {
  const keys: string[] = [];
  for (let offset = skipDays; offset < skipDays + days; offset += 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - offset);
    keys.push(dayKey(d));
  }
  return keys;
}

/** Sum daily aggregates across a rolling window — weekly (7) or monthly (30). */
export async function readAggregateWindowTotals(
  days: 7 | 30,
): Promise<{ total: number; byKind: Record<string, number>; daysScanned: number }> {
  const bucket = await resolveMasterR2Binding();
  if (!bucket) return { total: 0, byKind: {}, daysScanned: 0 };

  const keys = dateKeysForWindow(days);
  let total = 0;
  const byKind: Record<string, number> = {};

  for (const key of keys) {
    const data = await readAggregate(bucket, aggregatePath(key));
    for (const [kind, map] of Object.entries(data)) {
      const sum = Object.values(map ?? {}).reduce((a, b) => a + b, 0);
      byKind[kind] = (byKind[kind] ?? 0) + sum;
      total += sum;
    }
  }

  return { total, byKind, daysScanned: keys.length };
}

/** Per-canonical kaomoji activity counts across a rolling day window. */
export async function readKaomojiActivityWindow(
  days: 1 | 7 | 30,
  skipDays = 0,
): Promise<Map<string, Partial<Record<AnalyticsEventKind, number>>>> {
  const bucket = await resolveMasterR2Binding();
  const merged = new Map<string, Partial<Record<AnalyticsEventKind, number>>>();
  if (!bucket) return merged;

  const keys = skipDays > 0 ? dateKeysForPriorWindow(days, skipDays) : dateKeysForWindow(days);

  for (const key of keys) {
    const data = await readAggregate(bucket, aggregatePath(key));
    for (const [kind, map] of Object.entries(data)) {
      if (!kind.startsWith("kaomoji_")) continue;
      for (const [canonicalId, count] of Object.entries(map ?? {})) {
        if (!/^kao_[a-f0-9]{16}$/.test(canonicalId)) continue;
        const existing = merged.get(canonicalId) ?? {};
        const k = kind as AnalyticsEventKind;
        existing[k] = (existing[k] ?? 0) + count;
        merged.set(canonicalId, existing);
      }
    }
  }
  return merged;
}
