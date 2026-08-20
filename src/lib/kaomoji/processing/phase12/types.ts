import type { CanonicalRecord } from "../phase8/types";
import type { KaomojiEditorialRecord, KaomojiCollection, KaomojiRelationship } from "../phase9/types";
import type { Phase10ScoredRecord, QualityBucket } from "../phase10/types";

export type PublicationBlockReason =
  | "quality_low"
  | "quality_invalid_review"
  | "curation_review"
  | "curation_remove_candidate"
  | "publication_review_required"
  | "publication_blocked"
  | "publication_remove_candidate"
  | "license_review_required"
  | "provenance_missing"
  | "provenance_unresolved";

export interface PublicationGateResult {
  readonly canonical_id: string;
  readonly quality_bucket: QualityBucket;
  readonly quality_qualified: boolean;
  readonly publication_eligible: boolean;
  readonly blocked_reason: PublicationBlockReason | null;
  readonly curation_status: string;
  readonly publication_status: string;
  readonly license_status: string;
  readonly provenance_status: string;
}

export interface ExcludedRecord {
  readonly canonical_id: string;
  readonly quality_bucket: QualityBucket;
  readonly reason: PublicationBlockReason;
  readonly publication_status: string;
  readonly license_status: string;
  readonly curation_status: string;
}

export interface PublicLibraryRecord {
  readonly canonical: CanonicalRecord;
  readonly editorial: KaomojiEditorialRecord;
  readonly scores: Phase10ScoredRecord;
}

export interface Phase12Manifest {
  readonly phase: 12;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly raw_removed: number;
  readonly raw_modified: number;
  readonly raw_sha256: string;
  readonly canonical_candidates: number;
  readonly quality_buckets: Record<QualityBucket, number>;
  readonly quality_qualified: number;
  readonly publication_eligible: number;
  readonly publication_blocked: number;
  readonly excellent_qualified: number;
  readonly high_qualified: number;
  readonly good_qualified: number;
  readonly medium_qualified: number;
  readonly excellent_public: number;
  readonly high_public: number;
  readonly good_public: number;
  readonly medium_public: number;
  readonly low_excluded: number;
  readonly invalid_excluded: number;
  readonly duplicate_groups_preserved: number;
  readonly variant_groups_preserved: number;
  readonly legitimate_variants_preserved: number;
  readonly popularity_status: "INSUFFICIENT_DATA";
  readonly storage: StorageReport;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface StorageReport {
  readonly excellent_bytes: number;
  readonly high_bytes: number;
  readonly good_bytes: number;
  readonly medium_bytes: number;
  readonly total_public_bytes: number;
  readonly breakdown: Record<string, number>;
}
