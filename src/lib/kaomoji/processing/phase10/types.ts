export type QualityBucket = "EXCELLENT" | "HIGH" | "GOOD" | "MEDIUM" | "LOW" | "INVALID_REVIEW";
export type QualityStatusV2 = "HIGH" | "GOOD" | "MEDIUM" | "LOW" | "REVIEW";
export type ScoreConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface ScoreComponents {
  readonly [key: string]: number;
}

export interface Phase10ScoredRecord {
  readonly canonical_id: string;
  readonly canonical_content: string;
  readonly normalized_content: string;
  readonly quality_score_v2: number;
  readonly quality_score_v1: number;
  readonly quality_version: string;
  readonly quality_components: ScoreComponents;
  readonly quality_status: QualityStatusV2;
  readonly quality_bucket: QualityBucket;
  readonly quality_reasons: readonly string[];
  readonly beauty_score_v1: number;
  readonly beauty_version: string;
  readonly beauty_components: ScoreComponents;
  readonly beauty_features: ScoreComponents;
  readonly uniqueness_score_v1: number;
  readonly uniqueness_version: string;
  readonly uniqueness_components: ScoreComponents;
  readonly expressiveness_score_v1: number;
  readonly expressiveness_version: string;
  readonly expressiveness_components: ScoreComponents;
  readonly overall_score_v1: number;
  readonly overall_version: string;
  readonly overall_components: ScoreComponents;
  readonly score_confidence: ScoreConfidence;
  readonly popularity_score: null;
  readonly popularity_status: "INSUFFICIENT_DATA";
  readonly duplicate_group_id: string | null;
  readonly variant_group_id: string | null;
  readonly variant_type: string | null;
  readonly variant_confidence: ScoreConfidence | null;
  readonly publication_status: string;
  readonly curation_status: string;
  readonly is_public: boolean;
  readonly review_queues: readonly string[];
}

export interface DuplicateAuditGroup {
  readonly duplicate_group_id: string;
  readonly canonical_id: string;
  readonly members: readonly string[];
  readonly relationship_type: string;
  readonly confidence: string;
  readonly source_occurrence_count: number;
}

export interface Phase10Manifest {
  readonly phase: 10;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly raw_sha256: string;
  readonly canonical_candidates: number;
  readonly duplicate_groups: number;
  readonly variant_groups: number;
  readonly legitimate_variants: number;
  readonly unique_records: number;
  readonly low_quality: number;
  readonly review: number;
  readonly remove_candidates: number;
  readonly quality_buckets: Record<QualityBucket, number>;
  readonly beauty_distribution: Record<string, number>;
  readonly uniqueness_distribution: Record<string, number>;
  readonly expressiveness_distribution: Record<string, number>;
  readonly overall_distribution: Record<string, number>;
  readonly score_confidence: Record<ScoreConfidence, number>;
  readonly publication: Record<string, number>;
  readonly popularity_status: "INSUFFICIENT_DATA";
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
