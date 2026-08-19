import type { LicenseStatus, RawKaomojiRecord } from "../../types";

export type ProvenanceStatus = "COMPLETE" | "PARTIAL" | "MISSING" | "CONFLICTING" | "PROVENANCE_UNRESOLVED";

export type CurationStatus = "KEEP_CANDIDATE" | "REVIEW" | "REMOVE_CANDIDATE";

export type QualityTier = "HIGH" | "GOOD" | "MEDIUM" | "LOW" | "REVIEW";

export type PublicationStatus =
  | "PUBLISH_CANDIDATE"
  | "PUBLISH_WITH_ATTRIBUTION"
  | "REVIEW_REQUIRED"
  | "BLOCKED"
  | "REMOVE_CANDIDATE";

export type VariantType =
  | "SPACING_VARIANT"
  | "PUNCTUATION_VARIANT"
  | "EYE_VARIANT"
  | "MOUTH_VARIANT"
  | "HAND_VARIANT"
  | "DECORATIVE_VARIANT"
  | "EMOTION_VARIANT"
  | "INTENSITY_VARIANT"
  | "STYLE_VARIANT"
  | "UNICODE_VARIANT"
  | "JAPANESE_STYLE"
  | "WESTERN_STYLE"
  | "MINIMAL_VARIANT"
  | "COMPLEX_VARIANT"
  | "OTHER_VARIANT"
  | "REVIEW";

export interface RepairedProvenance {
  readonly raw_id: string;
  readonly status: ProvenanceStatus;
  readonly repaired_provenance: readonly string[];
  readonly repair_method: string | null;
  readonly missing_fields: readonly string[];
  readonly conflict_notes: readonly string[];
}

export interface SourceOccurrence {
  readonly raw_id: string;
  readonly source_id: string;
  readonly source_record_id: string | null;
  readonly source_url: string;
  readonly source_page: string | null;
  readonly source_category: string | null;
  readonly source_file: string | null;
  readonly collection_timestamp: string;
  readonly license_status: LicenseStatus;
  readonly provenance_status: ProvenanceStatus;
}

export interface CanonicalRecord {
  readonly canonical_id: string;
  readonly canonical_content: string;
  readonly normalized_content: string;
  readonly content_type: string;
  readonly content_type_labels: readonly string[];
  readonly duplicate_group_id: string | null;
  readonly variant_group_id: string | null;
  readonly variant_type: VariantType | null;
  readonly source_occurrences: readonly SourceOccurrence[];
  readonly provenance_status: ProvenanceStatus;
  readonly quality_score: number;
  readonly quality_status: QualityTier;
  readonly quality_reasons: readonly string[];
  readonly license_status: LicenseStatus;
  readonly publication_status: PublicationStatus;
  readonly curation_status: CurationStatus;
  readonly confidence: "high" | "medium" | "low";
  readonly representative_raw_id: string;
  readonly created_from_raw_ids: readonly string[];
  readonly source_categories: readonly string[];
  readonly emojiquick_category_candidates: readonly string[];
  readonly popularity_status: "DATA_NOT_AVAILABLE";
  readonly near_duplicate_review: boolean;
}

export interface Phase8Manifest {
  readonly phase: 8;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly raw_sha256_before: string;
  readonly raw_sha256_after: string;
  readonly phase7_sha256: string | null;
  readonly total_normalized: number;
  readonly canonical_candidates: number;
  readonly exact_groups: number;
  readonly exact_occurrences: number;
  readonly variant_groups: number;
  readonly legitimate_variants: number;
  readonly review_variants: number;
  readonly unique_records: number;
  readonly unique_legitimate: number;
  readonly unique_review: number;
  readonly unique_remove_candidates: number;
  readonly provenance: Record<ProvenanceStatus, number>;
  readonly provenance_repair_explanation: string;
  readonly quality: Record<QualityTier, number>;
  readonly license: Record<string, number>;
  readonly curation: Record<CurationStatus, number>;
  readonly publication: Record<string, number>;
  readonly no_loss: {
    readonly all_raw_mapped: boolean;
    readonly mapped_count: number;
    readonly unmapped_raw_ids: readonly string[];
  };
  readonly deterministic: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export type Phase8RawInput = RawKaomojiRecord;
