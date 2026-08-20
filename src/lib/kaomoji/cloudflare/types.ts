import type { CloudflareKaomojiMode } from "./config";

export type { CloudflareKaomojiMode };

export interface Phase19ChecksumEntry {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface Phase19R2Manifest {
  readonly production_version: string;
  readonly schema_version: string;
  readonly generated_at: string;
  readonly public_records: number;
  readonly relationships: number;
  readonly collections: number;
  readonly objects: readonly Phase19R2Object[];
  readonly checksums: readonly Phase19ChecksumEntry[];
}

export interface Phase19R2Object {
  readonly key: string;
  readonly content_type: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly category: "public" | "rebuildable" | "backup";
}

export interface Phase19ExportSummary {
  readonly public_records: number;
  readonly relationships: number;
  readonly relationships_rejected: number;
  readonly collections: number;
  readonly categories: number;
  readonly keywords: number;
  readonly d1_batches: number;
  readonly d1_sql_files: number;
  readonly d1_row_estimate: number;
  readonly r2_manifest_path: string;
  readonly checksums_path: string;
  readonly export_dir: string;
}

export interface Phase19ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly counts: {
    readonly public_records: number;
    readonly relationships: number;
    readonly collections: number;
    readonly d1_batches: number;
    readonly broken_relationships: number;
  };
}

export interface Phase19StorageBreakdown {
  readonly public_bytes: number;
  readonly rebuildable_bytes: number;
  readonly backup_bytes: number;
  readonly total_bytes: number;
  readonly files: Readonly<Record<string, number>>;
}

export interface Phase19Manifest {
  readonly phase: 19;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly schema_version: string;
  readonly production_version: string;
  readonly cloudflare_mode: CloudflareKaomojiMode;
  readonly public_records: number;
  readonly relationships: number;
  readonly relationships_rejected: number;
  readonly collections: number;
  readonly categories: number;
  readonly keywords: number;
  readonly d1_batches: number;
  readonly d1_sql_files: number;
  readonly r2_objects: number;
  readonly locale_registry_sha256: string;
  readonly search_index_sha256: string;
  readonly raw_sha256: string;
  readonly raw_modified: number;
  readonly storage: Phase19StorageBreakdown;
  readonly validation: Phase19ValidationResult;
  readonly rollback_version: string | null;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly d1_import_executed?: number;
  readonly d1_import_failed?: number;
  readonly d1_kaomoji_count?: number | null;
  readonly d1_relationship_count?: number | null;
  readonly d1_import_complete?: boolean;
  readonly d1_import_remote?: boolean;
  readonly r2_uploaded?: number;
  readonly r2_verified?: number;
  readonly r2_upload_remote?: boolean;
}
