import { listPublishedCollections } from "../collections/registry";
import { SEARCH_QUALITY_DATASET } from "../search-intent/quality-dataset";
import {
  getBaselineContextSlugs,
  getBaselinePopularSlugs,
  getBaselineTrendingSlugs,
} from "@/lib/discovery/baseline-rankings";
import { getMeaningBySlug } from "./registry";

export type ContentPriorityBand = "P0" | "P1" | "P2" | "P3";

export interface ContentPriorityEntry {
  readonly slug: string;
  readonly band: ContentPriorityBand;
  readonly score: number;
  readonly signals: readonly string[];
}

const P0_SLUGS = new Set([
  "fire",
  "red-heart",
  "face-with-tears-of-joy",
  "thumbs-up",
  "party-popper",
  "skull",
  "sparkles",
  "grinning-face",
  "crying-face",
  "folded-hands",
]);

function slugFrequencyInDataset(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of SEARCH_QUALITY_DATASET) {
    const slug = row.expectedTopSlug ?? row.acceptableSlugs?.[0];
    if (!slug) continue;
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  return counts;
}

function collectionSlugs(): Set<string> {
  const slugs = new Set<string>();
  for (const col of listPublishedCollections()) {
    for (const s of col.emojiSlugs) slugs.add(s);
  }
  return slugs;
}

/** Deterministic editorial priority — no fabricated traffic. */
export function computeContentPriorities(limit = 200): readonly ContentPriorityEntry[] {
  const datasetFreq = slugFrequencyInDataset();
  const inCollections = collectionSlugs();
  const signals = new Map<string, Set<string>>();
  const scores = new Map<string, number>();

  function bump(slug: string, weight: number, signal: string) {
    scores.set(slug, (scores.get(slug) ?? 0) + weight);
    const set = signals.get(slug) ?? new Set<string>();
    set.add(signal);
    signals.set(slug, set);
  }

  for (const slug of P0_SLUGS) bump(slug, 100, "P0 baseline");
  for (const sort of ["copied", "searched", "saved", "viewed"] as const) {
    for (const slug of getBaselinePopularSlugs(sort)) bump(slug, 25, `popular:${sort}`);
  }
  for (const period of ["today", "week", "month"] as const) {
    for (const slug of getBaselineTrendingSlugs(period)) bump(slug, 15, `trending:${period}`);
  }
  for (const ctx of ["instagram", "discord", "tiktok", "whatsapp", "x", "gaming", "work"] as const) {
    for (const slug of getBaselineContextSlugs(ctx)) bump(slug, 10, `context:${ctx}`);
  }
  for (const [slug, count] of datasetFreq) bump(slug, Math.min(20, count), "search-dataset");
  for (const slug of inCollections) bump(slug, 12, "collection-member");

  const entries: ContentPriorityEntry[] = [];
  for (const [slug, score] of scores) {
    const band: ContentPriorityBand =
      P0_SLUGS.has(slug) || score >= 80
        ? "P0"
        : score >= 50
          ? "P1"
          : score >= 25
            ? "P2"
            : "P3";
    entries.push({
      slug,
      band,
      score,
      signals: [...(signals.get(slug) ?? [])],
    });
  }

  return Object.freeze(entries.sort((a, b) => b.score - a.score).slice(0, limit));
}

export function getPriorityOpportunities(limit = 24): readonly ContentPriorityEntry[] {
  return computeContentPriorities(500)
    .filter((e) => {
      const m = getMeaningBySlug(e.slug);
      return !m || m.contentTier === "medium" || m.provenance.qualityStatus !== "complete";
    })
    .slice(0, limit);
}
