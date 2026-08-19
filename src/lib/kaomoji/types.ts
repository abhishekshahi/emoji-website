export type LicenseStatus = "APPROVED" | "ATTRIBUTION_REQUIRED" | "REVIEW_REQUIRED" | "NOT_PERMITTED" | "UNKNOWN";
export type PublicationStatus = "PUBLISHABLE" | "PUBLICATION_BLOCKED" | "REVIEW";
export type VerificationStatus = "VERIFIED" | "PARTIALLY_VERIFIED" | "UNVERIFIED" | "FAILED";
export type QualityStatus = "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
export type CollectionMethod = "npm_package" | "github_raw" | "wikimedia_api" | "manual_import" | "documented_import" | "not_collected" | "discovery_only";
export type CollectionStatus = "collected" | "manual_required" | "not_permitted" | "skipped" | "error";
export type DataType = "kaomoji" | "emoticon" | "ascii_art" | "mixed";
export type ProcessingStatus = "raw" | "aggregated" | "normalized" | "classified" | "review";
export type ClassificationLabel = "VALID_CANDIDATE" | "REVIEW" | "INVALID_CANDIDATE";
export type UniversalValidationLabel = "VALID" | "REVIEW" | "INVALID";
export type MergeDecision = "kept" | "merged" | "flagged" | "none";
export type DeduplicationLevel = "exact" | "unicode_equivalent" | "formatting" | "near_duplicate";
export type DedupClass = "EXACT_DUPLICATE" | "UNICODE_EQUIVALENT" | "FORMATTING_DUPLICATE" | "POTENTIAL_NEAR_DUPLICATE" | "LEGITIMATE_VARIANT" | "UNIQUE";
export type UniversalContentType = "KAOMOJI" | "EMOTICON" | "SYMBOL" | "EMOJI" | "EMOJI_SEQUENCE" | "ZWJ_SEQUENCE" | "FLAG" | "KEYCAP" | "TEXT_FACE" | "COMBINATION" | "CATEGORY" | "KEYWORD" | "ALIAS" | "MEANING" | "DESCRIPTION" | "VARIANT" | "RELATIONSHIP" | "OTHER";

export interface SourceRecord {
  readonly source_id: string;
  readonly source_name: string;
  readonly source_url: string;
  readonly data_type: DataType;
  readonly collection_method: CollectionMethod;
  readonly license_status: LicenseStatus;
  readonly license_name: string | null;
  readonly commercial_use: boolean | null;
  readonly redistribution: boolean | null;
  readonly modification: boolean | null;
  readonly attribution_required: boolean;
  readonly terms_url: string | null;
  readonly license_url: string | null;
  readonly verification_date: string;
  readonly verification_status: VerificationStatus;
  readonly quality_status: QualityStatus;
  readonly notes: readonly string[];
  readonly enabled_for_collection: boolean;
  readonly enabled_for_publication: boolean;
}

export interface LicenseRecord {
  readonly source_id: string;
  readonly license_status: LicenseStatus;
  readonly license_name: string | null;
  readonly commercial_use: boolean | null;
  readonly redistribution: boolean | null;
  readonly modification: boolean | null;
  readonly attribution_required: boolean;
  readonly terms_url: string | null;
  readonly license_url: string | null;
  readonly verification_date: string;
  readonly evidence: readonly string[];
  readonly confidence: "high" | "medium" | "low";
  readonly restrictions: readonly string[];
  readonly notes: readonly string[];
}

export interface RawKaomojiRecord {
  readonly raw_id: string;
  readonly source_id: string;
  readonly source_url: string;
  readonly source_record_id: string | null;
  readonly source_page: string | null;
  readonly source_category: string | null;
  readonly source_title: string | null;
  readonly original_kaomoji: string;
  readonly raw_text: string;
  readonly raw_html_context_if_needed: string | null;
  readonly collection_timestamp: string;
  readonly collector_version: string;
  readonly license_status: LicenseStatus;
  readonly provenance: readonly string[];
  readonly first_seen: string;
  readonly last_seen: string;
  readonly collection_run_id: string;
}

export interface RawSourceItem {
  readonly source_item_id: string;
  readonly source_id: string;
  readonly source_url: string;
  readonly source_page: string | null;
  readonly source_category: string | null;
  readonly source_subcategory: string | null;
  readonly content_type: UniversalContentType;
  readonly source_content_type: UniversalContentType;
  readonly original_content: string;
  readonly raw_content: string;
  readonly source_title: string | null;
  readonly source_description: string | null;
  readonly source_tags: readonly string[];
  readonly source_keywords: readonly string[];
  readonly source_metadata: Readonly<Record<string, string>>;
  readonly collection_timestamp: string;
  readonly collector_version: string;
  readonly license_status: LicenseStatus;
  readonly publication_status: PublicationStatus;
  readonly provenance: readonly string[];
  readonly first_seen: string;
  readonly last_seen: string;
  readonly collection_run_id: string;
  readonly raw_kaomoji_id: string | null;
}

export interface SourceRef {
  readonly raw_id: string;
  readonly source_id: string;
  readonly source_record_id: string | null;
  readonly source_page: string | null;
  readonly source_category: string | null;
  readonly license_status: LicenseStatus;
}

export interface UniversalSourceRef {
  readonly source_item_id: string;
  readonly source_id: string;
  readonly source_page: string | null;
  readonly source_category: string | null;
  readonly license_status: LicenseStatus;
  readonly publication_status: PublicationStatus;
}

export interface AggregatedKaomojiRecord {
  readonly aggregated_id: string;
  readonly candidate_key: string;
  readonly original_forms: readonly string[];
  readonly source_refs: readonly SourceRef[];
  readonly source_count: number;
  readonly source_pages: readonly string[];
  readonly source_categories: readonly string[];
  readonly first_seen: string;
  readonly last_seen: string;
  readonly license_summary: LicenseStatus;
  readonly processing_status: ProcessingStatus;
}

export interface AggregatedSourceItem {
  readonly aggregated_id: string;
  readonly content_type: UniversalContentType;
  readonly normalized_content_type: UniversalContentType;
  readonly classification_confidence: "high" | "medium" | "low";
  readonly canonical_candidate: string;
  readonly original_forms: readonly string[];
  readonly source_refs: readonly UniversalSourceRef[];
  readonly source_count: number;
  readonly source_urls: readonly string[];
  readonly source_categories: readonly string[];
  readonly source_metadata: Readonly<Record<string, unknown>>;
  readonly first_seen: string;
  readonly last_seen: string;
  readonly license_summary: LicenseStatus;
  readonly publication_status: PublicationStatus;
  readonly processing_status: ProcessingStatus;
  readonly dedup_class: DedupClass;
}

export interface NormalizationChange {
  readonly kind: "unicode" | "whitespace" | "html" | "encoding" | "line_ending";
  readonly before: string;
  readonly after: string;
}

export interface NormalizedKaomojiRecord {
  readonly aggregated_id: string;
  readonly original_kaomoji: string;
  readonly normalized_kaomoji: string;
  readonly normalization_version: string;
  readonly normalization_method: string;
  readonly normalization_changes: readonly NormalizationChange[];
  readonly normalization_warnings: readonly string[];
}

export interface NormalizedSourceItem {
  readonly aggregated_id: string;
  readonly original_content: string;
  readonly normalized_content: string;
  readonly normalization_version: string;
  readonly normalization_method: string;
  readonly normalization_changes: readonly NormalizationChange[];
  readonly normalization_warnings: readonly string[];
  readonly flag_review: boolean;
}

export interface ProvenanceRecord {
  readonly aggregated_id: string;
  readonly raw_ids: readonly string[];
  readonly source_ids: readonly string[];
  readonly license_statuses: readonly LicenseStatus[];
  readonly chain: readonly string[];
}

export interface UniversalProvenanceRecord {
  readonly aggregated_id: string;
  readonly source_item_ids: readonly string[];
  readonly source_ids: readonly string[];
  readonly license_statuses: readonly LicenseStatus[];
  readonly chain: readonly string[];
}

export interface ValidationRecord {
  readonly aggregated_id: string;
  readonly classification: ClassificationLabel;
  readonly reasons: readonly string[];
  readonly decision: MergeDecision;
  readonly decision_version: string;
  readonly target_record: string | null;
  readonly source_refs: readonly SourceRef[];
}

export interface UniversalValidationRecord {
  readonly aggregated_id: string;
  readonly classification: UniversalValidationLabel;
  readonly reasons: readonly string[];
  readonly source_item_ids: readonly string[];
}

export interface MergeAuditEntry {
  readonly reason: string;
  readonly target_record: string;
  readonly source_refs: readonly SourceRef[];
  readonly decision: MergeDecision;
  readonly decision_version: string;
}

export interface DeduplicationRecord {
  readonly merged_record: string;
  readonly source_records: readonly string[];
  readonly deduplication_level: DeduplicationLevel;
  readonly dedup_class: DedupClass;
  readonly reason: string;
  readonly confidence: "high" | "medium" | "low";
  readonly algorithm_version: string;
}

export interface DedupAnalysisReport {
  readonly generated_at: string;
  readonly algorithm_version: string;
  readonly exact_duplicates: number;
  readonly unicode_equivalent_duplicates: number;
  readonly formatting_duplicates: number;
  readonly near_duplicate_candidates: number;
  readonly legitimate_variants: number;
  readonly unique_items: number;
  readonly merge_entries: readonly DeduplicationRecord[];
}

export interface SourceCollectionReport {
  readonly source_id: string;
  readonly collection_status: CollectionStatus;
  readonly collection_method: CollectionMethod;
  readonly collection_started: string;
  readonly collection_completed: string;
  readonly raw_record_count: number;
  readonly unique_raw_count: number;
  readonly pages_processed: number;
  readonly categories_found: readonly string[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly license_status: LicenseStatus;
}

export interface SourceCoverageRow {
  readonly source_id: string;
  readonly raw: number;
  readonly unique: number;
  readonly aggregated: number;
  readonly duplicate: number;
  readonly review: number;
  readonly invalid: number;
}

export interface SourceCoverageMatrix {
  readonly generated_at: string;
  readonly rows: readonly SourceCoverageRow[];
  readonly source_only_records: number;
  readonly shared_by_2: number;
  readonly shared_by_3: number;
  readonly shared_by_4_plus: number;
}

export interface NoLossReconciliationReport {
  readonly generated_at: string;
  readonly total_raw_items: number;
  readonly total_unique_raw_items: number;
  readonly total_aggregated_items: number;
  readonly single_source_items: number;
  readonly multi_source_items: number;
  readonly exact_duplicates: number;
  readonly unicode_equivalent_duplicates: number;
  readonly formatting_duplicates: number;
  readonly near_duplicates: number;
  readonly legitimate_variants: number;
  readonly unique_items: number;
  readonly review_items: number;
  readonly invalid_items: number;
  readonly silent_deletions: number;
  readonly provenance_coverage: number;
  readonly raw_gte_aggregated: boolean;
}

export interface CollectionRunManifest {
  readonly run_id: string;
  readonly started_at: string;
  readonly completed_at: string;
  readonly collector_version: string;
  readonly source_results: Readonly<Record<string, { readonly collected: number; readonly skipped: number; readonly errors: readonly string[]; readonly method: CollectionMethod; }>>;
}

export interface RawDatasetManifest {
  readonly generated_at: string;
  readonly collector_version: string;
  readonly run_id: string;
  readonly record_count: number;
  readonly unique_original_count: number;
  readonly source_counts: Readonly<Record<string, number>>;
}

export interface AggregatedDatasetManifest {
  readonly generated_at: string;
  readonly candidate_count: number;
  readonly single_source_count: number;
  readonly multi_source_count: number;
  readonly raw_record_count: number;
  readonly provenance_coverage: number;
}

export interface PreservationAuditReport {
  readonly generated_at: string;
  readonly total_raw_records: number;
  readonly unique_raw_records: number;
  readonly unique_normalized_candidates: number;
  readonly single_source_candidates: number;
  readonly multi_source_candidates: number;
  readonly potential_duplicates: number;
  readonly unique_candidates: number;
  readonly raw_gte_aggregated: boolean;
  readonly silent_deletions: number;
  readonly merge_audit: readonly MergeAuditEntry[];
}

export interface Phase2UniversalManifest {
  readonly phase: 2;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly collector_version: string;
  readonly source_reports: readonly SourceCollectionReport[];
  readonly raw_item_count: number;
  readonly raw_kaomoji_count: number;
  readonly aggregated_item_count: number;
  readonly normalized_item_count: number;
  readonly dedup: DedupAnalysisReport;
  readonly no_loss: NoLossReconciliationReport;
  readonly source_coverage: SourceCoverageMatrix;
  readonly validation_summary: { readonly valid: number; readonly review: number; readonly invalid: number; };
  readonly license_summary: Readonly<Partial<Record<LicenseStatus, number>>>;
  readonly provenance_coverage: number;
  readonly performance_ms: { readonly collection: number; readonly aggregation: number; readonly normalization: number; readonly deduplication: number; readonly total: number; };
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}
