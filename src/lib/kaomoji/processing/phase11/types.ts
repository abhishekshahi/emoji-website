export type ClassificationConfidence = "CONFIRMED" | "INFERRED" | "REVIEW";

export interface CanonicalCandidateDefinition {
  readonly term: string;
  readonly definition: string;
  readonly source_of_truth: string;
  readonly count: number;
}

export interface CountWithConfidence {
  readonly slug: string;
  readonly count: number;
  readonly confirmed: number;
  readonly inferred: number;
  readonly review: number;
}

export interface Phase11Manifest {
  readonly phase: 11;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly raw_sha256: string;
  readonly phase8_baseline_raw_count: number;
  readonly phase8_baseline_raw_sha256: string;
  readonly raw_baseline_mismatch: boolean;
  readonly canonical_candidates: number;
  readonly canonical_definition: CanonicalCandidateDefinition;
  readonly public_candidates: number;
  readonly review: number;
  readonly remove_candidates: number;
  readonly duplicate_groups: number;
  readonly variant_groups: number;
  readonly legitimate_variants: number;
  readonly unique_records: number;
  readonly primary_content_type: Record<string, number>;
  readonly secondary_content_type_labels: number;
  readonly style_primary: Record<string, number>;
  readonly style_multi_label_records: number;
  readonly emotion: Record<string, number>;
  readonly emotion_confidence: Record<string, number>;
  readonly relationship: Record<string, number>;
  readonly cute_kawaii: Record<string, number>;
  readonly animals: Record<string, number>;
  readonly actions: Record<string, number>;
  readonly variant_composition: Record<string, number>;
  readonly unique_composition: Record<string, number | Record<string, number>>;
  readonly quality_buckets: Record<string, number>;
  readonly beauty_distribution: Record<string, number>;
  readonly uniqueness_distribution: Record<string, number>;
  readonly expressiveness_distribution: Record<string, number>;
  readonly overall_distribution: Record<string, number>;
  readonly publication: Record<string, number>;
  readonly curation: Record<string, number>;
  readonly license: Record<string, number>;
  readonly provenance: Record<string, number>;
  readonly popularity_status: "INSUFFICIENT_DATA";
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
