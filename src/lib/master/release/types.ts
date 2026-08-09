export interface FileChecksumEntry {
  path: string;
  sha256: string;
  sizeBytes: number;
  recordCount: number | null;
  status: "verified";
}

export interface MasterReleaseManifest {
  releaseId: string;
  releaseDate: string;
  phase: "8.10";
  status: "frozen";
  sourceCount: number;
  rawRecordCount: number;
  canonicalIdentityCount: number;
  artworkCount: number;
  metadataCount: number;
  semanticCount: number;
  definitionCount: number;
  aliasCount: number;
  keywordCount: number;
  shortcodeCount: number;
  searchTermCount: number;
  seoTermCount: number;
  testCount: number;
  sources: Array<{
    name: string;
    source: string;
    version: string;
    tag: string | null;
    commit: string | null;
    checksum: string | null;
    license: string;
    sourceURL: string;
    licenseURL: string;
  }>;
  assetLocations: {
    canonicalDatabase: string;
    artworkFiles: string;
    rawStaging: string;
    metadataLayer: string;
    semanticLayer: string;
    releasePackage: string;
  };
}

export interface ArtworkReleaseChecksums {
  generatedAt: string;
  phase: "8.10";
  totalFiles: number;
  missingFiles: number;
  checksumFailures: number;
  providers: Record<string, { fileCount: number; checksumVerified: number }>;
  status: "frozen";
}

export interface RawSourceChecksumEntry {
  source: string;
  version: string;
  archiveOrFile: string;
  sha256: string;
  sizeBytes: number;
  sourceURL: string;
}

export interface SourceImmutabilityEntry {
  source: string;
  version: string;
  commitOrTag: string | null;
  checksum: string | null;
  status: "IMMUTABLE";
}

export interface MasterBuildEnvironment {
  generatedAt: string;
  phase: "8.10";
  nodeVersion: string;
  npmVersion: string;
  typescriptVersion: string;
  nextVersion: string;
  platform: string;
  arch: string;
  buildScripts: string[];
}

export interface MasterBuildPipeline {
  generatedAt: string;
  phase: "8.10";
  commands: string[];
  note: string;
}

export interface ReproducibilityResult {
  status: "PASS" | "FAIL";
  method: string;
  filesCompared: number;
  byteIdentical: number;
  mismatches: Array<{ path: string; frozenSha256: string; currentSha256: string; reason: string }>;
  note: string;
}

export interface ReleaseAudit {
  generatedAt: string;
  phase: "8.10";
  status: "PASS" | "FAIL";
  baselines: Record<string, number>;
  verified: Record<string, number>;
  mismatches: string[];
  phase89AuditPassed: boolean;
  productionSafety: {
    emojisJson: number;
    openmojiExtras: number;
    status: "PASS" | "FAIL";
  };
}

export interface VersionUpdatePolicy {
  phase: "8.10";
  policy: string;
  rules: string[];
  example: string;
  requirementsForNewRelease: string[];
}

export interface MasterDatabaseFrozen {
  status: "FROZEN";
  phase: "8.10";
  releaseId: string;
  releaseDate: string;
  canonicalIdentities: number;
  artwork: number;
  metadata: number;
  semanticRecords: number;
  definitions: number;
  releaseManifest: string;
  fileChecksumManifest: string;
  note: string;
}

export interface LicenseFreezeEntry {
  source: string;
  license: string;
  licenseURL: string;
  appliesTo: "artwork" | "metadata" | "both" | "semantic";
}

export interface ReleasePackageResult {
  releaseId: string;
  manifest: MasterReleaseManifest;
  fileChecksums: FileChecksumEntry[];
  artworkReleaseChecksums: ArtworkReleaseChecksums;
  rawSourceChecksums: RawSourceChecksumEntry[];
  sourceImmutability: SourceImmutabilityEntry[];
  buildEnvironment: MasterBuildEnvironment;
  buildPipeline: MasterBuildPipeline;
  reproducibility: ReproducibilityResult;
  releaseAudit: ReleaseAudit;
  versionUpdatePolicy: VersionUpdatePolicy;
  licenseFreeze: LicenseFreezeEntry[];
  frozenMarker: MasterDatabaseFrozen;
}
