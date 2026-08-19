import type { CollectionMethod, LicenseStatus } from "../types";

export type SourceAcquisitionStatus =
  | "collected"
  | "verified_complete"
  | "manual_required"
  | "inaccessible"
  | "no_relevant_data"
  | "blocked"
  | "error";

export interface SourceDiscoveryReport {
  readonly source_id: string;
  readonly discovery_timestamp: string;
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly pages_skipped: number;
  readonly skip_reasons: readonly string[];
  readonly collection_method: CollectionMethod | "discovery_only";
  readonly acquisition_status: SourceAcquisitionStatus;
  readonly robots_txt_summary: string | null;
  readonly evidence: readonly string[];
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface Phase3SourceInventoryRow {
  readonly source_id: string;
  readonly pages: number;
  readonly raw_records: number;
  readonly unique: number;
  readonly duplicate: number;
  readonly review: number;
  readonly blocked: number;
  readonly status: SourceAcquisitionStatus;
  readonly publication_gate: "PUBLISHABLE" | "PUBLISHABLE_WITH_ATTRIBUTION" | "REVIEW" | "BLOCKED";
}

export interface Phase3CollectionManifest {
  readonly phase: 3;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly collector_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly new_raw: number;
  readonly removed_raw: number;
  readonly modified_raw: number;
  readonly discovery_reports: readonly SourceDiscoveryReport[];
  readonly inventory: readonly Phase3SourceInventoryRow[];
  readonly total_raw: number;
  readonly total_unique: number;
  readonly total_aggregated: number;
  readonly total_normalized: number;
  readonly provenance_coverage: number;
  readonly performance_ms: { readonly collection: number; readonly total: number };
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

export function publicationGateForLicense(license: LicenseStatus): Phase3SourceInventoryRow["publication_gate"] {
  if (license === "APPROVED") return "PUBLISHABLE";
  if (license === "ATTRIBUTION_REQUIRED") return "PUBLISHABLE_WITH_ATTRIBUTION";
  if (license === "NOT_PERMITTED") return "BLOCKED";
  return "REVIEW";
}
