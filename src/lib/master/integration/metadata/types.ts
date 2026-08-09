import type { CanonicalKeywordEntry, CanonicalShortcodeEntry } from "@/lib/master/reconciliation/types";
import type { SemanticDefinitionEntry } from "@/lib/master/semantic/types";
import type { MasterMetadataLookup, ProvenanceValue } from "../types";

export type MetadataSourceKey =
  | "unicode"
  | "cldr"
  | "openmoji"
  | "emojibase"
  | "emojilib"
  | "emojinet"
  | "fluent"
  | "emoji-time";

export type MetadataAvailabilityKey = MetadataSourceKey | "noto" | "twemoji";

export interface SourceMetadataRecord {
  readonly source: MetadataSourceKey;
  readonly sourceId: string;
  readonly metadataRecordId: string;
  readonly sourceVersion: string;
  readonly name: string | null;
  readonly keywords: readonly string[];
  readonly aliases: readonly string[];
  readonly shortcodes: readonly string[];
  readonly definition: string | null;
  readonly rawRecordRef: string;
  readonly metadataAvailable: true;
}

export interface UnavailableSourceMetadata {
  readonly source: "noto" | "twemoji";
  readonly metadataAvailable: false;
}

export interface SourceKeywordProvenance {
  readonly value: string;
  readonly sources: readonly string[];
  readonly reason: string;
}

export interface ShortcodeProvenance {
  readonly shortcode: string;
  readonly normalizedShortcode: string;
  readonly source: string;
  readonly shortcodePack: string;
  readonly status: string;
}

export interface AliasProvenance {
  readonly value: string;
  readonly source: string;
  readonly type: string;
  readonly classification: string;
  readonly publicAlias: boolean;
  readonly reason: string;
}

export interface EnrichedMetadataLookup extends MasterMetadataLookup {
  readonly sourceKeywords: readonly SourceKeywordProvenance[];
  readonly canonicalKeywords: readonly SourceKeywordProvenance[];
  readonly shortcodeRecords: readonly ShortcodeProvenance[];
  readonly safeAliases: readonly AliasProvenance[];
  readonly restrictedAliases: readonly AliasProvenance[];
  readonly emojinetDefinitions: readonly SemanticDefinitionEntry[];
  readonly emojinetSenseCount: number;
  readonly sourceAvailability: Readonly<Record<MetadataAvailabilityKey, boolean>>;
}

export interface MetadataProductionCoverageEntry {
  readonly productionId: string;
  readonly productionHexcode: string;
  readonly productionType: "standard" | "extra";
  readonly canonicalId: string;
  readonly availableSources: readonly MetadataSourceKey[];
  readonly metadataAvailable: boolean;
}

export interface MetadataProductionCoverageReport {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly totalProductionRecords: number;
  readonly mappedRecords: number;
  readonly entries: readonly MetadataProductionCoverageEntry[];
  readonly status: "PASS" | "FAIL";
}

export interface MetadataProviderCoverageReport {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly totals: {
    readonly masterMetadataRecords: number;
    readonly canonicalIdentities: number;
    readonly aliases: number;
    readonly safeAliases: number;
    readonly restrictedAliases: number;
    readonly keywordTerms: number;
    readonly shortcodeRecords: number;
    readonly emojinetSenses: number;
    readonly emojinetDefinitions: number;
    readonly safeSearchTerms: number;
    readonly ambiguousTerms: number;
    readonly notoMetadataAvailable: false;
    readonly twemojiMetadataAvailable: false;
  };
  readonly status: "PASS" | "FAIL";
}

export interface MetadataIntegrationAuditReport {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly metadataIntegration: "PASS" | "FAIL";
  readonly sourceProvenance: "PASS" | "FAIL";
  readonly featureFlag: "PASS" | "FAIL";
  readonly productionMapping: "PASS" | "FAIL";
  readonly notoTwemojiUninvented: "PASS" | "FAIL";
  readonly status: "PASS" | "FAIL";
}

export interface MetadataIntegrationManifest {
  readonly generatedAt: string;
  readonly phase: "8.11C";
  readonly releaseId: string;
  readonly featureFlags: {
    readonly masterMetadataEnabled: false;
    readonly masterSearchEnabled: false;
  };
  readonly outputs: {
    readonly metadataProductionCoverage: string;
    readonly metadataProviderCoverage: string;
    readonly metadataIntegrationAudit: string;
  };
}

export type { CanonicalKeywordEntry, CanonicalShortcodeEntry };
