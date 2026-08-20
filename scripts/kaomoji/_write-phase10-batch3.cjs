const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "src/lib/kaomoji/processing/phase10");
function w(name, content) {
  fs.writeFileSync(path.join(dir, name), content, "utf8");
  console.log("wrote", name);
}

w("duplicate-audit.ts", `import type { CanonicalRecord } from "../phase8/types";
import type { DuplicateAuditGroup } from "./types";

export function auditDuplicates(
  canonical: readonly CanonicalRecord[],
  duplicateGroups: readonly { duplicate_group_id: string; members: string[]; relationship_type: string; confidence: string; canonical_id: string }[],
): DuplicateAuditGroup[] {
  const byId = new Map(canonical.map((c) => [c.canonical_id, c]));
  return duplicateGroups.map((g) => {
    const rec = byId.get(g.canonical_id);
    let occ = 0;
    for (const mid of g.members) {
      const m = canonical.find((c) => c.created_from_raw_ids.includes(mid));
      if (m) occ += m.source_occurrences.length;
    }
    if (rec) occ = rec.source_occurrences.length;
    return {
      duplicate_group_id: g.duplicate_group_id,
      canonical_id: g.canonical_id,
      members: g.members,
      relationship_type: g.relationship_type ?? "EXACT",
      confidence: g.confidence ?? "high",
      source_occurrence_count: occ,
    };
  });
}

export function countUniqueCanonical(canonical: readonly CanonicalRecord[]): number {
  return canonical.filter((c) => c.created_from_raw_ids.length === 1).length;
}
`);

w("review-queues.ts", `import type { Phase10ScoredRecord } from "./types";

export function buildReviewQueues(record: Phase10ScoredRecord): string[] {
  const queues: string[] = [];
  if (record.quality_status === "REVIEW" || record.quality_bucket === "INVALID_REVIEW") queues.push("quality_uncertainty");
  if (record.score_confidence === "LOW") queues.push("score_uncertainty");
  if (record.beauty_score_v1 < 40 && record.quality_score_v2 >= 60) queues.push("beauty_uncertainty");
  if (record.curation_status === "REVIEW") queues.push("curation_review");
  if (record.publication_status === "REVIEW_REQUIRED") queues.push("license_review");
  if (record.variant_group_id && record.variant_confidence === "LOW") queues.push("variant_uncertainty");
  return queues;
}
`);

w("rankings.ts", `import type { Phase10ScoredRecord } from "./types";

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
`);

console.log("phase10 batch3 done");
