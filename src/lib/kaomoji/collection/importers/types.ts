import type { LicenseStatus } from "../../types";

export interface ImportEntry {
  readonly original_kaomoji: string;
  readonly source_record_id?: string | null;
  readonly source_category?: string | null;
  readonly source_title?: string | null;
  readonly source_page?: string | null;
  readonly source_file?: string | null;
  readonly content_type?: string | null;
  readonly source_metadata?: Readonly<Record<string, string>> | null;
  readonly occurrence_index?: number;
  readonly license_status?: LicenseStatus;
}

export interface CollectionResult {
  readonly source_id: string;
  readonly collected: number;
  readonly skipped: number;
  readonly errors: readonly string[];
  readonly entries: readonly ImportEntry[];
}

export interface ParsedImportFile {
  readonly source_id: string;
  readonly entries: readonly ImportEntry[];
}
