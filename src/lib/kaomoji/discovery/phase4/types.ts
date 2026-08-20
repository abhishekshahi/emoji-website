import type { LicenseStatus, UniversalContentType } from "../../types";

export interface Phase4SourceResult {
  readonly source_id: string;
  readonly discovered: number;
  readonly accessible: number;
  readonly collected: number;
  readonly unique: number;
  readonly duplicates: number;
  readonly variants: number;
  readonly review: number;
  readonly blocked: number;
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly pages_skipped: number;
  readonly categories: number;
  readonly content_types: readonly UniversalContentType[];
  readonly license_status: LicenseStatus;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly new_raw: number;
  readonly raw_before: number;
  readonly raw_after: number;
}

export interface Phase4CollectionManifest {
  readonly phase: 4;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly collector_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly new_raw_records: number;
  readonly removed_records: number;
  readonly modified_existing_raw_records: number;
  readonly total_discovered: number;
  readonly total_collected: number;
  readonly total_raw: number;
  readonly total_unique: number;
  readonly total_duplicates: number;
  readonly total_variants: number;
  readonly total_review: number;
  readonly total_blocked: number;
  readonly source_results: readonly Phase4SourceResult[];
  readonly messletters_gap_remaining: number;
  readonly emoticonstext_gap_remaining: number;
  readonly fastemoji_canonical_records: number;
  readonly fastemoji_collected: number;
  readonly fastemoji_remaining: number;
  readonly textemoticons_status: string;
  readonly slangit_status: string;
  readonly provenance_coverage: number;
  readonly idempotent_rerun_new_raw: number | null;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}
