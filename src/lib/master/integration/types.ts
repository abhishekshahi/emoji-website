import type { ArtworkProvider } from "@/lib/master/canonical/types";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { CanonicalNameRecord, CanonicalSearchIndexEntry, CanonicalSeoRecord } from "@/lib/master/reconciliation/types";
import type { CanonicalSemanticIndexEntry, SemanticSearchTermEntry } from "@/lib/master/semantic/types";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import type { RawMetadataIndexRecord, CanonicalMetadataIndexEntry } from "@/lib/master/metadata/types";
import type { MasterReleaseManifest } from "@/lib/master/release/types";

export type ArtworkFormat = "svg" | "png";

export type ProductionRecordType = "standard" | "extra";

export interface ProvenanceValue<T> {
  readonly value: T;
  readonly source: string;
  readonly canonicalId: string;
}

export interface MasterIntegrationConfig {
  readonly masterIntegrationEnabled: boolean;
  readonly masterArtworkEnabled: boolean;
  readonly masterMetadataEnabled: boolean;
  readonly masterSearchEnabled: boolean;
  readonly masterSEOEnabled: boolean;
}

export interface ReleaseVerificationResult {
  readonly verified: boolean;
  readonly releaseId: string;
  readonly status: string;
  readonly checksumStatus: "PASS" | "FAIL";
  readonly mismatches: readonly string[];
}

export interface ProductionToMasterEntry {
  readonly productionId: string;
  readonly productionHexcode: string;
  readonly productionType: ProductionRecordType;
  readonly canonicalId: string;
  readonly mapped: boolean;
}

export interface ProductionToMasterMap {
  readonly generatedAt: string;
  readonly releaseId: string;
  readonly phase: "8.11A";
  readonly standardRecords: {
    readonly total: number;
    readonly mapped: number;
    readonly entries: readonly ProductionToMasterEntry[];
  };
  readonly extrasRecords: {
    readonly total: number;
    readonly mapped: number;
    readonly entries: readonly ProductionToMasterEntry[];
  };
  readonly totalMapped: number;
  readonly totalExpected: number;
  readonly status: "PASS" | "FAIL";
}

export interface IntegrationAuditReport {
  readonly generatedAt: string;
  readonly phase: "8.11A";
  readonly releaseId: string;
  readonly releaseVerification: ReleaseVerificationResult;
  readonly productionMappings: {
    readonly standard: { readonly total: number; readonly mapped: number };
    readonly extras: { readonly total: number; readonly mapped: number };
    readonly total: { readonly total: number; readonly mapped: number };
    readonly status: "PASS" | "FAIL";
  };
  readonly adapters: {
    readonly canonical: "PASS" | "FAIL";
    readonly artwork: "PASS" | "FAIL";
    readonly metadata: "PASS" | "FAIL";
    readonly search: "PASS" | "FAIL";
    readonly seo: "PASS" | "FAIL";
  };
  readonly productionSafety: {
    readonly emojisJsonCount: number;
    readonly openmojiExtrasCount: number;
    readonly featureFlagsDefaultFalse: boolean;
    readonly status: "PASS" | "FAIL";
  };
  readonly status: "PASS" | "FAIL";
}

export interface IntegrationManifest {
  readonly generatedAt: string;
  readonly phase: "8.11A";
  readonly releaseId: string;
  readonly releaseStatus: "frozen";
  readonly readOnly: true;
  readonly featureFlags: MasterIntegrationConfig;
  readonly dataSources: {
    readonly releasePackage: string;
    readonly canonicalDatabase: string;
    readonly artworkLayer: string;
    readonly metadataLayer: string;
    readonly semanticLayer: string;
  };
  readonly outputs: {
    readonly productionToMasterMap: string;
    readonly integrationAuditReport: string;
  };
}

export interface MasterArtworkEntry {
  readonly provider: ArtworkProvider;
  readonly artworkId: string;
  readonly canonicalId: string;
  readonly sourceId: string;
  readonly path: string;
  readonly localPath: string;
  readonly format: ArtworkFormat;
  readonly variant: string | null;
  readonly license: string;
  readonly licenseURL: string;
  readonly attribution: string | null;
  readonly checksum: string;
  readonly checksumVerified: boolean;
  readonly duplicateBinary: boolean;
  readonly duplicateBinaryGroupId: string | null;
  readonly sourceVersion: string;
}

export interface MasterArtworkLookup {
  readonly canonicalId: string;
  readonly providers: {
    readonly openmoji: readonly MasterArtworkEntry[];
    readonly noto: readonly MasterArtworkEntry[];
    readonly twemoji: readonly MasterArtworkEntry[];
    readonly fluent: readonly MasterArtworkEntry[];
  };
}

export interface MasterMetadataSourceEntry {
  readonly source: string;
  readonly sourceId: string;
  readonly metadataRecordId: string;
  readonly name: string | null;
  readonly keywords: readonly string[];
  readonly aliases: readonly string[];
  readonly shortcodes: readonly string[];
  readonly rawRecordRef: string;
}

export interface MasterMetadataLookup {
  readonly canonicalId: string;
  readonly canonicalName: ProvenanceValue<string>;
  readonly sourceNames: readonly ProvenanceValue<string>[];
  readonly aliases: readonly ProvenanceValue<string>[];
  readonly keywords: readonly ProvenanceValue<string>[];
  readonly shortcodes: readonly ProvenanceValue<string>[];
  readonly semanticRefs: readonly CanonicalEmojiRecord["semanticRefs"][number][];
  readonly sourceMetadata: readonly MasterMetadataSourceEntry[];
}

export interface MasterCanonicalLookup {
  readonly canonicalId: string;
  readonly identity: CanonicalEmojiRecord;
  readonly canonicalName: ProvenanceValue<string> | null;
  readonly aliases: readonly ProvenanceValue<string>[];
  readonly keywords: readonly ProvenanceValue<string>[];
  readonly shortcodes: readonly ProvenanceValue<string>[];
  readonly safeSearchTerms: readonly ProvenanceValue<string>[];
  readonly seoRecord: CanonicalSeoRecord | null;
  readonly semanticIndex: CanonicalSemanticIndexEntry | null;
}

export type MasterSearchMatchKind =
  | "emoji"
  | "unicode"
  | "hexcode"
  | "canonical-name"
  | "alias"
  | "keyword"
  | "shortcode"
  | "semantic";

export interface MasterSearchResult {
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly canonicalName: string;
  readonly matchKind: MasterSearchMatchKind;
  readonly matchedTerm: string;
  readonly score: number;
  readonly ambiguous: boolean;
}

export interface MasterSearchResponse {
  readonly query: string;
  readonly results: readonly MasterSearchResult[];
  readonly ambiguous: boolean;
}

export interface MasterDataCache {
  readonly manifest: MasterReleaseManifest;
  readonly releaseVerification: ReleaseVerificationResult;
  readonly canonicalRecords: ReadonlyMap<string, CanonicalEmojiRecord>;
  readonly nameRecords: ReadonlyMap<string, CanonicalNameRecord>;
  readonly searchIndex: ReadonlyMap<string, CanonicalSearchIndexEntry>;
  readonly seoRecords: ReadonlyMap<string, CanonicalSeoRecord>;
  readonly semanticIndex: ReadonlyMap<string, CanonicalSemanticIndexEntry>;
  readonly semanticSearchTerms: ReadonlyMap<string, SemanticSearchTermEntry>;
  readonly artworkById: ReadonlyMap<string, ArtworkMasterRecord>;
  readonly artworkByCanonical: ReadonlyMap<string, MasterArtworkLookup["providers"]>;
  readonly metadataByCanonical: ReadonlyMap<string, RawMetadataIndexRecord[]>;
  readonly metadataById: ReadonlyMap<string, RawMetadataIndexRecord>;
  readonly canonicalMetadataIndex: ReadonlyMap<string, CanonicalMetadataIndexEntry>;
}

export class MasterIntegrationError extends Error {
  readonly code: "RELEASE_MISMATCH" | "DATA_MISSING" | "NOT_INITIALIZED" | "CHECKSUM_FAILURE";

  constructor(
    message: string,
    code: "RELEASE_MISMATCH" | "DATA_MISSING" | "NOT_INITIALIZED" | "CHECKSUM_FAILURE",
  ) {
    super(message);
    this.name = "MasterIntegrationError";
    this.code = code;
  }
}
