import type { CanonicalRecord } from "../phase8/types";

export type EditorialTier = "TIER_1" | "TIER_2" | "TIER_3";
export type EditorialPriority = "P0" | "P1" | "P2" | "P3";
export type CategoryStatus = "ASSIGNED" | "REVIEW";
export type NameStatus = "ASSIGNED" | "REVIEW";
export type MeaningStatus = "EDITORIAL" | "CATEGORY_DERIVED" | "NONE";
export type PopularityStatus = "INSUFFICIENT_DATA";
export type AnalyticsStatus = "DATA_NOT_AVAILABLE";

export interface TaxonomyCategory {
  readonly group: string;
  readonly label: string;
  readonly slug: string;
}

export interface KaomojiEditorialRecord {
  readonly canonical_id: string;
  readonly slug: string;
  readonly canonical_content: string;
  readonly normalized_content: string;
  readonly content_type: string;
  readonly publication_status: CanonicalRecord["publication_status"];
  readonly curation_status: CanonicalRecord["curation_status"];
  readonly license_status: CanonicalRecord["license_status"];
  readonly provenance_status: CanonicalRecord["provenance_status"];
  readonly is_public: boolean;
  readonly source_categories: readonly string[];
  readonly emojiquick_categories: readonly TaxonomyCategory[];
  readonly category_status: CategoryStatus;
  readonly source_keywords: readonly string[];
  readonly emojiquick_keywords: readonly string[];
  readonly editorial_name: string | null;
  readonly name_confidence: "high" | "medium" | "low";
  readonly name_status: NameStatus;
  readonly editorial_tier: EditorialTier;
  readonly editorial_priority: EditorialPriority;
  readonly meaning_status: MeaningStatus;
  readonly meaning: string | null;
  readonly common_usage: string | null;
  readonly quality_score: number;
  readonly quality_reasons: readonly string[];
  readonly quality_version: string;
  readonly beauty_score: number;
  readonly beauty_version: string;
  readonly source_occurrence_count: number;
  readonly duplicate_group_id: string | null;
  readonly variant_group_id: string | null;
  readonly popularity_status: PopularityStatus;
  readonly analytics_status: AnalyticsStatus;
  readonly accessible_name: string;
  readonly seo_title: string;
  readonly seo_description: string;
}

export interface KaomojiRelationship {
  readonly from_canonical_id: string;
  readonly to_canonical_id: string;
  readonly relationship_type:
    | "same_emotion"
    | "same_category"
    | "similar_expression"
    | "variant"
    | "alternative"
    | "same_style"
    | "frequently_paired"
    | "opposite_emotion";
  readonly confidence: "high" | "medium" | "low";
  readonly score: number;
}

export interface KaomojiCollection {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly canonical_ids: readonly string[];
  readonly rule: string;
}

export interface SearchIndexRecord {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly name: string | null;
  readonly keywords: readonly string[];
  readonly categories: readonly string[];
  readonly quality_score: number;
  readonly beauty_score: number;
  readonly priority: EditorialPriority;
  readonly is_public: boolean;
}

export interface SearchQualityCase {
  readonly query: string;
  readonly kind: "exact" | "partial" | "misspelling" | "natural" | "category" | "character";
  readonly expected_slugs: readonly string[];
  readonly min_results: number;
}

export interface Phase9Manifest {
  readonly phase: 9;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly raw_sha256: string;
  readonly canonical_candidates: number;
  readonly public_candidates: number;
  readonly review: number;
  readonly blocked: number;
  readonly remove_candidates: number;
  readonly tier_1: number;
  readonly tier_2: number;
  readonly tier_3: number;
  readonly categories_assigned: number;
  readonly categories_review: number;
  readonly keywords_total: number;
  readonly names_assigned: number;
  readonly names_review: number;
  readonly meanings_editorial: number;
  readonly relationships: number;
  readonly collections: number;
  readonly search_index_records: number;
  readonly search_quality_cases: number;
  readonly seo_indexable_pages: number;
  readonly analytics_events_supported: readonly string[];
  readonly popularity_status: PopularityStatus;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
