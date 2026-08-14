import type { ArtworkProvider } from "@/lib/master/artwork/types";
import type { CanonicalIdentityType } from "@/lib/master/canonical/types";

export const R2_DATASET_VERSION = "master-8.10-r2-v1" as const;
export const R2_BUCKET_PREFIX = "emojiquick" as const;

export type MasterR2Mode = "OFF" | "DATA_READY" | "ENABLED";

export interface R2ProviderLicense {
  readonly provider: ArtworkProvider;
  readonly license: string;
  readonly licenseURL: string;
  readonly attribution: string;
  readonly sourceURL: string;
  readonly publiclyServed: boolean;
  readonly artworkCount: number;
}

export interface R2ArtworkKeyEntry {
  readonly recordKey: string;
  readonly artworkId: string;
  readonly provider: ArtworkProvider;
  readonly storageKey: string;
  readonly canonicalId: string;
  readonly format: "svg" | "png" | "other";
  readonly checksum: string;
  readonly publiclyServed: boolean;
  readonly license: string;
  readonly contentType: string;
}

export interface R2IdentityRecord {
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly unicodeSequence: string | null;
  readonly identityType: CanonicalIdentityType;
  readonly isUnicode: boolean;
  readonly seoEligible: boolean;
  readonly productionSlug: string | null;
  readonly artworkIds: readonly string[];
  readonly metadataRefCount: number;
  readonly semanticRefCount: number;
}

export interface R2ShardManifestEntry {
  readonly shardId: string;
  readonly objectKey: string;
  readonly recordCount: number;
  readonly bytes: number;
  readonly sha256: string;
}

export interface R2Manifest {
  readonly datasetVersion: typeof R2_DATASET_VERSION;
  readonly generatedAt: string;
  readonly releaseId: string;
  readonly totals: {
    readonly identities: number;
    readonly artworkRecords: number;
    readonly artworkFiles: number;
    readonly metadataRecords: number;
    readonly semanticRecords: number;
    readonly searchRecords: number;
    readonly objects: number;
    readonly bytes: number;
  };
  readonly providerCounts: Record<ArtworkProvider, number>;
  readonly formatCounts: Record<"svg" | "png" | "other", number>;
  readonly licenses: readonly R2ProviderLicense[];
  readonly identityShards: readonly R2ShardManifestEntry[];
  readonly metadataShards: readonly R2ShardManifestEntry[];
  readonly semanticShards: readonly R2ShardManifestEntry[];
  readonly searchShards: readonly R2ShardManifestEntry[];
  readonly artworkIndexKey: string;
  readonly manifestSha256: string;
  readonly deduplication: {
    readonly duplicateBinaryRecords: number;
    readonly bytesSaved: number;
    readonly uniqueArtworkFiles: number;
  };
}

export interface R2ExportStats {
  readonly manifest: R2Manifest;
  readonly exportDir: string;
  readonly durationMs: number;
}
