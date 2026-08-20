export type SourcePrimaryStatus =
  | "ACTIVE_RELEVANT"
  | "ACTIVE_PARTIALLY_RELEVANT"
  | "SOURCE_MISMATCH"
  | "INACCESSIBLE"
  | "NO_RELEVANT_CONTENT"
  | "REVIEW_REQUIRED";

export type DiscoveredContentType =
  | "EMOJI"
  | "KAOMOJI"
  | "EMOTICON"
  | "TEXT_FACE"
  | "SYMBOL"
  | "EMOJI_SEQUENCE"
  | "COMBINATION"
  | "UNICODE_DATA"
  | "CATEGORY"
  | "KEYWORD"
  | "MEANING"
  | "DESCRIPTION"
  | "OTHER";

export interface SourceUrlInventoryEntry {
  readonly source_id: string;
  readonly url: string;
  readonly page_type: string;
  readonly category: string | null;
  readonly record_count: number | null;
  readonly content_types: readonly DiscoveredContentType[];
  readonly access_status: "accessible" | "inaccessible" | "unknown";
  readonly license_status: string;
}

export interface SourceLicenseReport {
  readonly source_id: string;
  readonly license: string | null;
  readonly terms_url: string | null;
  readonly copyright_owner: string | null;
  readonly commercial_use: boolean | null;
  readonly redistribution: boolean | null;
  readonly modification: boolean | null;
  readonly attribution: boolean | null;
  readonly automated_collection: string;
  readonly manual_collection: string;
  readonly restrictions: readonly string[];
  readonly confidence: "high" | "medium" | "low";
  readonly license_status: string;
}

export interface Phase3BSourceAudit {
  readonly source_id: string;
  readonly source_name: string;
  readonly current_url: string;
  readonly primary_status: SourcePrimaryStatus;
  readonly status_evidence: readonly string[];
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly categories_discovered: number;
  readonly discovered_total: number | null;
  readonly discovered_unique: number | null;
  readonly collected_raw: number;
  readonly collected_unique: number;
  readonly duplicate_within_source: number;
  readonly content_types: readonly DiscoveredContentType[];
  readonly problems: readonly string[];
  readonly recommended_status: SourcePrimaryStatus;
  readonly license: SourceLicenseReport;
  readonly url_inventory: readonly SourceUrlInventoryEntry[];
}

export interface Phase3BInventoryRow {
  readonly source: string;
  readonly pages: number;
  readonly categories: number;
  readonly raw: number;
  readonly unique: number;
  readonly duplicates: number;
  readonly content_types: readonly DiscoveredContentType[];
  readonly status: SourcePrimaryStatus;
}

export interface Phase3BManifest {
  readonly phase: "3B";
  readonly timestamp: string;
  readonly discovery_version: string;
  readonly raw_before: number;
  readonly raw_after: number;
  readonly new_records: number;
  readonly existing_records: number;
  readonly removed_records: number;
  readonly modified_records: number;
  readonly total_discovered: number | null;
  readonly total_collected: number;
  readonly total_raw: number;
  readonly total_unique: number;
  readonly total_duplicates: number;
  readonly total_variants: number | null;
  readonly sources_active: number;
  readonly sources_mismatch: number;
  readonly sources_inaccessible: number;
  readonly source_audits: readonly Phase3BSourceAudit[];
  readonly inventory_table: readonly Phase3BInventoryRow[];
  readonly url_inventory: readonly SourceUrlInventoryEntry[];
}
