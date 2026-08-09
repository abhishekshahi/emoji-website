export type ArtworkProvider = "openmoji" | "noto" | "twemoji" | "fluent";

export type ArtworkStatus = "active" | "utility-support" | "source-specific";

export interface ArtworkMasterRecord {
  artworkId: string;
  provider: ArtworkProvider;
  sourceVersion: string;
  sourceId: string;
  canonicalId: string;
  filePath: string;
  publicPath: string;
  format: string;
  checksum: string;
  checksumVerified: boolean;
  license: string;
  licenseURL: string;
  attribution: string | null;
  artworkVariant: string;
  isUnicode: boolean;
  status: ArtworkStatus;
  duplicateBinary: boolean;
  duplicateBinaryGroupId: string | null;
  rawRecordRef: string;
}

export interface ArtworkChecksumEntry {
  artworkId: string;
  checksum: string;
  checksumVerified: boolean;
  filePath: string;
  duplicateBinary: boolean;
  duplicateBinaryGroupId: string | null;
  duplicateArtworkIds: string[];
}

export interface CanonicalArtworkProviderRefs {
  openmoji: string[];
  noto: string[];
  twemoji: string[];
  fluent: string[];
}

export interface CanonicalArtworkIndexEntry {
  canonicalId: string;
  isUnicode: boolean;
  artwork: CanonicalArtworkProviderRefs;
}

export interface ArtworkCoverageEntry {
  canonicalId: string;
  openmoji: boolean;
  noto: boolean;
  twemoji: boolean;
  fluent: boolean;
}

export interface ArtworkLicenseProviderEntry {
  provider: ArtworkProvider;
  license: string;
  licenseURL: string;
  attribution: string;
  sourceURL: string;
  sourceVersion: string;
  artworkCount: number;
}

export interface ArtworkAttributionEntry {
  provider: ArtworkProvider;
  attribution: string;
  license: string;
  licenseURL: string;
  sourceURL: string;
  copyright: string | null;
}

export interface ArtworkIntegrityReport {
  generatedAt: string;
  phase: "8.5";
  totals: {
    rawArtworkRecords: number;
    artworkMasterRecords: number;
    utilitySupportExcludedFromCanonical: number;
    missingFiles: number;
    checksumFailures: number;
    checksumVerified: number;
    duplicateBinaryGroups: number;
    duplicateBinaryRecords: number;
    pathCollisions: number;
  };
  providerCounts: Record<ArtworkProvider, number>;
  formatCounts: Record<string, number>;
  variantCounts: Record<string, number>;
  classificationCounts: {
    unicodeLinked: number;
    sourceSpecific: number;
    artworkOnly: number;
    utilitySupport: number;
  };
  canonicalCoverage: {
    totalCanonicalIdentities: number;
    withOpenmoji: number;
    withNoto: number;
    withTwemoji: number;
    withFluent: number;
    withTwoOrMoreProviders: number;
    withOneProvider: number;
    withNoArtwork: number;
  };
  constraints: {
    rawArtworkUnchanged: boolean;
    noArtworkDeleted: boolean;
    productionDataUnchanged: boolean;
    canonicalIdentitiesUnmodified: boolean;
  };
}

export interface ArtworkDatabaseManifest {
  generatedAt: string;
  phase: "8.5";
  recordCount: number;
  files: {
    artworkMasterIndex: string;
    artworkChecksums: string;
    canonicalArtworkIndex: string;
    artworkCoverageReport: string;
    artworkLicenseIndex: string;
    artworkAttributionIndex: string;
    artworkIntegrityReport: string;
  };
}
