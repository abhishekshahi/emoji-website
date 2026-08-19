import type { LicenseStatus, RawKaomojiRecord } from "../../types";

export type Phase7ValidationStatus =
  | "VALID_KAOMOJI"
  | "VALID_EMOTICON"
  | "VALID_TEXT_FACE"
  | "VALID_SYMBOL"
  | "VALID_EMOJI"
  | "VALID_SEQUENCE"
  | "VALID_ART"
  | "REVIEW"
  | "INVALID_CANDIDATE";

export type Phase7ContentType =
  | "KAOMOJI"
  | "EMOTICON"
  | "TEXT_FACE"
  | "EMOJI"
  | "EMOJI_SEQUENCE"
  | "ZWJ_SEQUENCE"
  | "FLAG"
  | "EMOJI_COMBINATION"
  | "SYMBOL"
  | "ASCII_ART"
  | "UNICODE_ART"
  | "TEXT"
  | "GENERATOR_TEMPLATE"
  | "DATA_METADATA"
  | "OTHER"
  | "UNKNOWN";

export type Phase7PublicationStatus =
  | "PUBLISH_CANDIDATE"
  | "PUBLISH_WITH_ATTRIBUTION"
  | "REVIEW_REQUIRED"
  | "BLOCKED"
  | "INVALID_CANDIDATE";

export type Phase7QualityStatus = "KEEP_CANDIDATE" | "REVIEW" | "REJECT_CANDIDATE";

export type Phase7DuplicateKind =
  | "EXACT"
  | "UNICODE_EQUIVALENT"
  | "NORMALIZED"
  | "FORMATTING"
  | "CROSS_SOURCE"
  | "SAME_SOURCE"
  | "CATEGORY_DUPLICATE"
  | "NEAR_DUPLICATE";

export interface Phase7RawSnapshot {
  readonly snapshot_at: string;
  readonly raw_count: number;
  readonly source_count: number;
  readonly file_sha256: string;
  readonly file_size_bytes: number;
  readonly provenance_coverage: number;
  readonly source_ids: readonly string[];
  readonly fastemoji_collected: number | null;
  readonly fastemoji_remaining: number | null;
}

export interface Phase7UnicodeAnalysis {
  readonly code_points: readonly number[];
  readonly character_count: number;
  readonly code_point_count: number;
  readonly has_zwj: boolean;
  readonly has_variation_selector: boolean;
  readonly has_regional_indicator: boolean;
  readonly has_combining_mark: boolean;
  readonly scripts: readonly string[];
  readonly blocks: readonly string[];
  readonly unusual_unicode: boolean;
}

export interface Phase7NormalizedRecord {
  readonly raw_id: string;
  readonly original_content: string;
  readonly normalized_content: string;
  readonly normalization_version: string;
  readonly normalization_changes: readonly { kind: string; before: string; after: string }[];
  readonly normalization_warnings: readonly string[];
}

export interface Phase7ProcessedRecord {
  readonly raw_id: string;
  readonly source_id: string;
  readonly source_record_id: string | null;
  readonly source_url: string;
  readonly source_page: string | null;
  readonly source_file: string | null;
  readonly source_category: string | null;
  readonly original_content: string;
  readonly normalized_content: string;
  readonly content_types: readonly Phase7ContentType[];
  readonly validation_status: Phase7ValidationStatus;
  readonly validation_reasons: readonly string[];
  readonly unicode: Phase7UnicodeAnalysis;
  readonly quality_score: number;
  readonly quality_status: Phase7QualityStatus;
  readonly beauty_foundation: {
    readonly symmetry: number | null;
    readonly visual_balance: number | null;
    readonly expressiveness: number | null;
    readonly aesthetic_score: number | null;
  };
  readonly license_status: LicenseStatus;
  readonly publication_status: Phase7PublicationStatus;
  readonly source_keywords: readonly string[];
  readonly source_tags: readonly string[];
  readonly source_description: string | null;
  readonly source_caption: string | null;
  readonly source_label: string | null;
  readonly provenance: readonly string[];
}

export interface Phase7DuplicateGroup {
  readonly group_id: string;
  readonly kind: Phase7DuplicateKind;
  readonly key: string;
  readonly raw_ids: readonly string[];
  readonly source_ids: readonly string[];
  readonly categories: readonly string[];
  readonly count: number;
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
}

export interface Phase7VariantGroup {
  readonly variant_group_id: string;
  readonly variant_type: string;
  readonly raw_ids: readonly string[];
  readonly originals: readonly string[];
  readonly confidence: "high" | "medium" | "low";
  readonly reason: string;
}

export interface Phase7CollectionManifest {
  readonly phase: 7;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly raw_new: number;
  readonly total_normalized: number;
  readonly content_type_counts: Record<string, number>;
  readonly validation_counts: Record<string, number>;
  readonly duplicate_counts: Record<string, number>;
  readonly variant_count: number;
  readonly quality_buckets: Record<string, number>;
  readonly license_counts: Record<string, number>;
  readonly publication_counts: Record<string, number>;
  readonly provenance_coverage: number;
  readonly source_stats: readonly Phase7SourceStats[];
  readonly fastemoji_collected: number | null;
  readonly fastemoji_remaining: number | null;
  readonly deterministic: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface Phase7SourceStats {
  readonly source_id: string;
  readonly raw_occurrences: number;
  readonly content_types: Record<string, number>;
  readonly validation: Record<string, number>;
  readonly quality_buckets: Record<string, number>;
  readonly license: Record<string, number>;
  readonly publication: Record<string, number>;
  readonly duplicate_groups: number;
  readonly variant_groups: number;
}

export type Phase7RawInput = RawKaomojiRecord;
