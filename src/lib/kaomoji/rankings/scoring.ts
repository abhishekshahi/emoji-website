import type { AnalyticsEventKind } from "@/lib/content/analytics/events";
import {
  KAOMOJI_ACTIVITY_KINDS,
  KAOMOJI_RANKING_WEIGHTS,
  type KaomojiActivityKind,
  type KaomojiRankingWindow,
} from "./types";

const KAOMOJI_ID_RE = /^kao_[a-f0-9]{16}$/;

export function isKaomojiCanonicalId(id: string): boolean {
  return KAOMOJI_ID_RE.test(id);
}

export function windowToDays(window: KaomojiRankingWindow): number {
  switch (window) {
    case "24h":
      return 1;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "all":
      return 30;
  }
}

export function scoreKaomojiActivity(counts: Readonly<Partial<Record<KaomojiActivityKind, number>>>): number {
  let score = 0;
  for (const kind of KAOMOJI_ACTIVITY_KINDS) {
    score += (counts[kind] ?? 0) * KAOMOJI_RANKING_WEIGHTS[kind];
  }
  return score;
}

export function mergeKindCounts(
  target: Map<string, Partial<Record<KaomojiActivityKind, number>>>,
  kind: AnalyticsEventKind,
  bucket: Record<string, number> | undefined,
): void {
  if (!KAOMOJI_ACTIVITY_KINDS.includes(kind as KaomojiActivityKind)) return;
  const activityKind = kind as KaomojiActivityKind;
  for (const [canonicalId, count] of Object.entries(bucket ?? {})) {
    if (!isKaomojiCanonicalId(canonicalId)) continue;
    const existing = target.get(canonicalId) ?? {};
    existing[activityKind] = (existing[activityKind] ?? 0) + count;
    target.set(canonicalId, existing);
  }
}

export function rankByScore(
  counts: Map<string, Partial<Record<KaomojiActivityKind, number>>>,
  limit: number,
  metric?: KaomojiActivityKind,
): readonly { canonical_id: string; score: number }[] {
  const ranked = [...counts.entries()]
    .map(([canonical_id, kinds]) => ({
      canonical_id,
      score: metric ? (kinds[metric] ?? 0) : scoreKaomojiActivity(kinds),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.canonical_id.localeCompare(b.canonical_id));

  const seen = new Set<string>();
  const out: { canonical_id: string; score: number }[] = [];
  for (const entry of ranked) {
    if (seen.has(entry.canonical_id)) continue;
    seen.add(entry.canonical_id);
    out.push(entry);
    if (out.length >= limit) break;
  }
  return out;
}
