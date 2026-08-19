import type { LicenseStatus, UniversalContentType } from "../../types";
import type { Phase5SourceStatus } from "../../sources/registry-phase5";

export interface Phase5SourceInventoryRow {
  readonly source_id: string;
  readonly source_name: string;
  readonly source_type: string;
  readonly source_url: string;
  readonly repository_url: string | null;
  readonly status: Phase5SourceStatus;
  readonly license: LicenseStatus;
  readonly commercial_use: boolean | null;
  readonly redistribution: boolean | null;
  readonly attribution: boolean;
  readonly pages: number;
  readonly files: number;
  readonly categories: number;
  readonly records_discovered: number;
  readonly records_collected: number;
  readonly records_remaining: number | null;
  readonly raw_occurrences: number;
  readonly content_types: readonly string[];
  readonly errors: readonly string[];
  readonly problems: readonly string[];
}

export interface Phase5CollectionManifest {
  readonly phase: 5;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly collector_version: string;
  readonly candidate_sources: number;
  readonly unique_source_identities: number;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly removed_records: number;
  readonly existing_raw_modified: number;
  readonly new_raw_records: number;
  readonly total_source_occurrences: number;
  readonly total_raw_records: number;
  readonly total_pages: number;
  readonly total_files: number;
  readonly total_categories: number;
  readonly sources_active: number;
  readonly sources_partially_relevant: number;
  readonly sources_mismatch: number;
  readonly sources_inaccessible: number;
  readonly sources_review_required: number;
  readonly source_inventory: readonly Phase5SourceInventoryRow[];
  readonly deduplication_performed: false;
  readonly provenance_coverage: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}
