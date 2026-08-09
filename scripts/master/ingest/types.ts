export type RawRecordType =
  | "emoji"
  | "metadata"
  | "utility"
  | "semantic"
  | "sequence"
  | "artwork-only"
  | "standard-data";

export interface RawSourceRecord {
  source: string;
  sourceVersion: string;
  sourceId: string;
  rawName: string;
  rawEmoji: string | null;
  rawCodepoints: string[];
  rawSequence: string;
  rawArtworkReference: string | null;
  rawMetadata: Record<string, unknown>;
  rawLicense: string;
  sourceURL: string;
  recordType: RawRecordType;
}

export interface RawArtworkRecord {
  source: string;
  sourceVersion: string;
  sourceId: string;
  stagedPath: string;
  originalPath: string;
  format: string;
  variant: string | null;
  rawLicense: string;
  sourceURL: string;
  checksum: string | null;
}

export interface RawMetadataRecord {
  source: string;
  sourceVersion: string;
  sourceId: string;
  rawName: string | null;
  rawEmoji: string | null;
  rawCodepoints: string[];
  rawSequence: string;
  rawMetadata: Record<string, unknown>;
  rawLicense: string;
  sourceURL: string;
  recordType: RawRecordType;
}

export interface SourceIngestionResult {
  source: string;
  success: boolean;
  rawRecordCount: number;
  rawArtworkCount: number;
  rawMetadataCount: number;
  rawSemanticCount: number;
  unmatchedCount: number;
  nonUnicodeRecordCount: number;
  warnings: string[];
  errors: string[];
  stagingPaths: string[];
}

export interface RawIngestionReport {
  generatedAt: string;
  phase: "8.2";
  lockFile: string;
  reproducible: boolean;
  success: boolean;
  sources: SourceIngestionResult[];
  totals: {
    rawRecords: number;
    rawArtwork: number;
    rawMetadata: number;
    rawSemantic: number;
    nonUnicodeRecords: number;
  };
  previousBaseline?: {
    rawRecords: number;
    rawArtwork: number;
    rawMetadata: number;
    nonUnicodeRecords: number;
    note: string;
  };
  failures: string[];
}

export interface MasterSourceLockEntry {
  source: string;
  version: string;
  tag: string | null;
  commit: string | null;
  checksum: string | null;
  package: string | null;
  sourceURL: string;
  repositoryURL: string;
  downloadURL: string | null;
  license: string;
  licenseURL: string;
  attribution: string | null;
}

export interface MasterSourceLockFile {
  sources: MasterSourceLockEntry[];
}
