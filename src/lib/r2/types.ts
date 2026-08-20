import type { ArtworkProvider } from "@/lib/master/artwork/types";

export interface R2BucketBinding {
  get(key: string): Promise<{ body: ReadableStream | null; httpMetadata?: { contentType?: string } } | null>;
  head?(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
  put?(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>;
}

export interface CanonicalIdentityRecord {
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly unicodeSequence: string | null;
  readonly identityType: string;
  readonly isUnicode: boolean;
  readonly artwork?: Record<string, unknown[]>;
  readonly metadataRefs?: string[];
  readonly semanticRefs?: string[];
}

export interface CanonicalSearchRecord {
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly canonicalName: string;
  readonly aliases: string[];
  readonly keywords: string[];
  readonly shortcodes: string[];
  readonly hexcode?: string;
}

export interface CanonicalArtworkRecord {
  readonly provider: ArtworkProvider;
  readonly checksum: string;
  readonly format: string;
  readonly binaryObjectKey: string;
  readonly publicServingClass?: string;
  readonly filePath: string;
}

export interface LicenseMatrixEntry {
  readonly provider: string;
  readonly publicServingAllowed: boolean;
  readonly storageAllowed: boolean;
  readonly servingClass?: string;
}

export interface LicenseMatrix {
  readonly providers: LicenseMatrixEntry[];
  readonly artworkProviderClasses?: Record<string, string>;
}

export interface MasterR2ReadResult<T> {
  readonly data: T;
  readonly source: "r2" | "local";
}
