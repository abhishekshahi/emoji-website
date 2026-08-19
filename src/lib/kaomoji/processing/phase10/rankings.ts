import type { Phase10ScoredRecord } from "./types";

export interface RankingCollection {
  readonly slug: string;
  readonly title: string;
  readonly dimension: string;
  readonly canonical_ids: readonly string[];
}

function topBy(
  records: readonly Phase10ScoredRecord[],
  key: keyof Phase10ScoredRecord,
  limit: number,
  publicOnly = true,
): string[] {
  return records
    .filter((r) => !publicOnly || r.is_public)
    .filter((r) => typeof r[key] === "number")
    .sort((a, b) => (b[key] as number) - (a[key] as number) || a.canonical_id.localeCompare(b.canonical_id))
    .slice(0, limit)
    .map((r) => r.canonical_id);
}

export function buildRankings(records: readonly Phase10ScoredRecord[]): {
  rankings: Record<string, string[]>;
  collections: RankingCollection[];
} {
  const limit = 200;
  const rankings: Record<string, string[]> = {
    best_quality: topBy(records, "quality_score_v2", limit),
    most_beautiful: topBy(records, "beauty_score_v1", limit),
    most_unique: topBy(records, "uniqueness_score_v1", limit),
    most_expressive: topBy(records, "expressiveness_score_v1", limit),
    best_overall: topBy(records, "overall_score_v1", limit),
    most_cute: topBy(records, "beauty_score_v1", limit),
    most_decorative: topBy(records, "beauty_score_v1", limit),
    most_balanced: topBy(records, "beauty_score_v1", limit),
    most_symmetrical: topBy(records, "beauty_score_v1", limit),
  };
  const collections: RankingCollection[] = [
    { slug: "most-beautiful-kaomoji", title: "Most Beautiful Kaomoji", dimension: "beauty", canonical_ids: rankings.most_beautiful! },
    { slug: "best-quality-kaomoji", title: "Best Quality Kaomoji", dimension: "quality", canonical_ids: rankings.best_quality! },
    { slug: "most-unique-kaomoji", title: "Most Unique Kaomoji", dimension: "uniqueness", canonical_ids: rankings.most_unique! },
    { slug: "most-expressive-kaomoji", title: "Most Expressive Kaomoji", dimension: "expressiveness", canonical_ids: rankings.most_expressive! },
    { slug: "cutest-kaomoji", title: "Cutest Kaomoji", dimension: "cute", canonical_ids: rankings.most_cute! },
    { slug: "most-aesthetic-kaomoji", title: "Most Aesthetic Kaomoji", dimension: "aesthetic", canonical_ids: rankings.most_beautiful! },
    { slug: "most-symmetrical-kaomoji", title: "Most Symmetrical Kaomoji", dimension: "symmetry", canonical_ids: rankings.most_symmetrical! },
    { slug: "most-decorative-kaomoji", title: "Most Decorative Kaomoji", dimension: "decorative", canonical_ids: rankings.most_decorative! },
  ];
  return { rankings, collections };
}
