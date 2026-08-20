export interface StorageEntry {
  readonly path: string;
  readonly bytes: number;
}

export interface StorageAudit {
  readonly tier_excellent_bytes: number;
  readonly tier_high_bytes: number;
  readonly tier_good_bytes: number;
  readonly tier_medium_bytes: number;
  readonly public_production_bytes: number;
  readonly quality_dataset_bytes: number;
  readonly full_processing_bytes: number;
  readonly full_raw_bytes: number;
  readonly files: readonly StorageEntry[];
}

export interface RawDriftRecord {
  readonly raw_id: string;
  readonly source_id: string;
  readonly source_url: string;
  readonly collection_timestamp: string;
  readonly in_phase8_canonical: boolean;
}

export interface RawDriftAudit {
  readonly phase8_baseline_count: number;
  readonly current_count: number;
  readonly drift: number;
  readonly phase8_baseline_sha256: string;
  readonly current_sha256: string;
  readonly added_by_source: Record<string, number>;
  readonly added_records_sample: readonly RawDriftRecord[];
  readonly outside_canonical_layer: number;
}

export interface ContentValidationResult {
  readonly valid: number;
  readonly review: number;
  readonly invalid: number;
  readonly flags: Record<string, number>;
}

export interface Phase13Manifest {
  readonly phase: 13;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly canonical_candidates: number;
  readonly quality_qualified: number;
  readonly publication_eligible: number;
  readonly excellent_public: number;
  readonly high_public: number;
  readonly good_public: number;
  readonly medium_public: number;
  readonly low_excluded: number;
  readonly invalid_excluded: number;
  readonly duplicate_groups: number;
  readonly variant_groups: number;
  readonly legitimate_variants: number;
  readonly relationships: number;
  readonly provenance_coverage_pct: number;
  readonly license: Record<string, number>;
  readonly publication_blocked: number;
  readonly content_validation: ContentValidationResult;
  readonly search_pass_rate: number;
  readonly storage: StorageAudit;
  readonly raw_drift: RawDriftAudit;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
