import type { ArtworkProvider } from "@/lib/master/artwork/types";

/** Full master archive - complete byte-for-byte preservation of src/data/master/. */
export const FULL_ARCHIVE_SCHEMA_VERSION = "master-full-archive-v1" as const;
export const FULL_ARCHIVE_BUCKET_NAME = "emojiquick-master" as const;
export const FULL_ARCHIVE_PREFIX = "emojiquick-master" as const;

export interface FullArchiveFileEntry {
  readonly relativePath: string;
  readonly r2Key: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly extension: string;
}

export interface FullArchiveDirectoryReport {
  readonly path: string;
  readonly fileCount: number;
  readonly bytes: number;
}

export interface FullArchiveDuplicateGroup {
  readonly sha256: string;
  readonly bytes: number;
  readonly files: readonly string[];
}

export interface FullArchiveFrozenReleaseEntry {
  readonly relativePath: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface FullArchiveManifest {
  readonly schemaVersion: typeof FULL_ARCHIVE_SCHEMA_VERSION;
  readonly archiveType: "FULL_MASTER_ARCHIVE";
  readonly generatedAt: string;
  readonly sourceRoot: string;
  readonly checksumAlgorithm: "SHA-256";
  readonly releaseId: string;
  readonly totals: {
    readonly files: number;
    readonly bytes: number;
    readonly directories: number;
    readonly canonicalIdentities: number;
    readonly artworkRecords: number;
    readonly artworkFiles: number;
    readonly artworkBytes: number;
    readonly metadataBytes: number;
    readonly semanticBytes: number;
    readonly vendorBytes: number;
    readonly r2Objects: number;
  };
  readonly providerCounts: Record<ArtworkProvider, number>;
  readonly extensionCounts: Record<string, number>;
  readonly directoryReports: readonly FullArchiveDirectoryReport[];
  readonly frozenReleaseChecksums: readonly FullArchiveFrozenReleaseEntry[];
  readonly frozenReleaseVerified: boolean;
  readonly deduplicationPolicy: "PRESERVE_ALL";
  readonly optimizedExportNote: string;
  readonly manifestSha256: string;
}

export interface FullArchivePrepareResult {
  readonly manifest: FullArchiveManifest;
  readonly exportRootDir: string;
  readonly files: readonly FullArchiveFileEntry[];
  readonly durationMs: number;
}

export interface FullArchiveVerifyResult {
  readonly status: "PASS" | "FAIL";
  readonly errors: string[];
  readonly manifest: FullArchiveManifest;
  readonly measured: {
    readonly sourceFiles: number;
    readonly exportFiles: number;
    readonly sourceBytes: number;
    readonly exportBytes: number;
    readonly checksumMismatches: number;
    readonly missingInExport: number;
    readonly unexpectedInExport: number;
  };
}