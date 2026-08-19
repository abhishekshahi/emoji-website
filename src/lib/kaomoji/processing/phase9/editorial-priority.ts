import type { CanonicalRecord } from "../phase8/types";
import type { EditorialPriority, EditorialTier, MeaningStatus } from "./types";
import type { TaxonomyCategory } from "./types";

export function isPublicCandidate(record: CanonicalRecord): boolean {
  return (
    record.curation_status === "KEEP_CANDIDATE" &&
    (record.publication_status === "PUBLISH_CANDIDATE" || record.publication_status === "PUBLISH_WITH_ATTRIBUTION")
  );
}

export function assignPriority(record: CanonicalRecord, categoryConfidence: "high" | "medium" | "low"): EditorialPriority {
  const sources = record.source_occurrences.length;
  const q = record.quality_score;
  if (!isPublicCandidate(record)) return "P3";
  if (q >= 80 && sources >= 3 && categoryConfidence === "high") return "P0";
  if (q >= 70 && sources >= 2) return "P1";
  if (q >= 60 || sources >= 2) return "P2";
  return "P3";
}

export function assignTier(priority: EditorialPriority, categoryConfidence: "high" | "medium" | "low"): EditorialTier {
  if (priority === "P0" && categoryConfidence === "high") return "TIER_1";
  if (priority === "P1" && categoryConfidence !== "low") return "TIER_2";
  return "TIER_3";
}

export function assignMeaning(
  tier: EditorialTier,
  categories: readonly TaxonomyCategory[],
  categoryConfidence: "high" | "medium" | "low",
): { meaning_status: MeaningStatus; meaning: string | null; common_usage: string | null } {
  const primary = categories[0];
  if (!primary || categoryConfidence === "low") {
    return { meaning_status: "NONE", meaning: null, common_usage: null };
  }
  if (tier === "TIER_1") {
    return {
      meaning_status: "CATEGORY_DERIVED",
      meaning: `A ${primary.label.toLowerCase()} Japanese-style text face (kaomoji) in the ${primary.group.replace(/_/g, " ").toLowerCase()} category.`,
      common_usage: `Often used to express ${primary.label.toLowerCase()} feelings in messages and social posts.`,
    };
  }
  if (tier === "TIER_2") {
    return {
      meaning_status: "CATEGORY_DERIVED",
      meaning: `${primary.label} kaomoji — category-derived editorial summary.`,
      common_usage: null,
    };
  }
  return { meaning_status: "NONE", meaning: null, common_usage: null };
}
