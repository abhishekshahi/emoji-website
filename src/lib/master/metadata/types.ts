export type MetadataSourceKey =
  | "openmoji"
  | "unicode"
  | "cldr"
  | "emojibase"
  | "emojilib"
  | "emojinet"
  | "fluent"
  | "emojiTime"
  | "noto"
  | "twemoji";

export type MetadataRecordType =
  | "metadata"
  | "semantic"
  | "standard-data"
  | "sequence"
  | "utility";

export type NameConflictKind =
  | "exact-match"
  | "case-difference"
  | "punctuation-difference"
  | "wording-difference"
  | "substantive-conflict";

export interface MetadataFields {
  name: string | null;
  shortName: string | null;
  label: string | null;
  aliases: string[];
  shortcodes: string[];
  keywords: string[];
  tags: string[];
  description: string | null;
  definition: string | null;
  category: string | null;
  group: string | null;
  subgroup: string | null;
  emojiVersion: string | null;
  unicodeVersion: string | null;
  gender: string | null;
  skinTone: string | null;
  variants: string[];
  annotations: string[];
  semanticConcepts: string[];
  relatedTerms: string[];
  sourceSpecificIds: Record<string, string>;
  locale: string | null;
  metadataAvailable: boolean;
  [key: string]: unknown;
}

export interface RawMetadataIndexRecord {
  metadataRecordId: string;
  source: string;
  sourceVersion: string;
  sourceId: string;
  canonicalId: string;
  recordType: MetadataRecordType;
  rawName: string | null;
  rawEmoji: string | null;
  rawCodepoints: string[];
  rawSequence: string;
  rawMetadata: Record<string, unknown>;
  rawLicense: string;
  sourceURL: string;
  locale: string;
  rawRecordRef: string;
  fields: MetadataFields;
}

export interface MetadataSourceIndexRecord {
  metadataRecordId: string;
  source: string;
  sourceId: string;
  canonicalId: string;
  recordType: MetadataRecordType;
}

export interface CanonicalMetadataProviderRefs {
  openmoji: string[];
  unicode: string[];
  cldr: string[];
  emojibase: string[];
  emojilib: string[];
  emojinet: string[];
  fluent: string[];
  emojiTime: string[];
  noto: string[];
  twemoji: string[];
}

export interface CanonicalMetadataIndexEntry {
  canonicalId: string;
  isUnicode: boolean;
  metadataSourceCount: number;
  sources: CanonicalMetadataProviderRefs;
}

export interface MetadataNameConflictEntry {
  canonicalId: string;
  classification: NameConflictKind;
  names: Record<string, string | null>;
}

export interface MetadataKeywordIndexEntry {
  canonicalId: string;
  keywords: Record<string, string[]>;
}

export interface ShortcodeSourceIndexEntry {
  canonicalId: string;
  unicodeSequence: string | null;
  shortcodes: Record<string, string[]>;
}

export interface MetadataCoverageEntry {
  canonicalId: string;
  openmoji: boolean;
  unicode: boolean;
  cldr: boolean;
  emojibase: boolean;
  emojilib: boolean;
  emojinet: boolean;
  fluent: boolean;
  emojiTime: boolean;
  noto: boolean;
  twemoji: boolean;
  metadataSourceCount: number;
}

export interface MetadataProviderAvailability {
  provider: MetadataSourceKey;
  metadataAvailable: boolean;
  recordCount: number;
  license: string | null;
  licenseURL: string | null;
  attribution: string | null;
  version: string | null;
  locale: string;
}

export interface MetadataAuditReport {
  generatedAt: string;
  phase: "8.6";
  baselines: {
    rawMetadataManifest: number;
    rawSemanticRecords: number;
    unicodeEmojiDataSourceRecords: number;
    totalMetadataMasterRecords: number;
  };
  perSource: Record<
    string,
    {
      recordCount: number;
      canonicalMappings: number;
      unmappedRecords: number;
      nameRecords: number;
      keywordRecords: number;
      shortcodeRecords: number;
      semanticRecords: number;
      definitionRecords: number;
      senseRecords: number;
      aliasRecords: number;
      fieldCount: number;
    }
  >;
  counts: {
    uniqueMetadataRecords: number;
    canonicalIdentitiesWithMetadata: number;
    canonicalIdentitiesWithOneMetadataSource: number;
    canonicalIdentitiesWithTwoOrMoreMetadataSources: number;
    canonicalIdentitiesWithNoMetadata: number;
    nameConflicts: number;
    keywordIndexEntries: number;
    shortcodeIndexEntries: number;
    semanticRecords: number;
    definitions: number;
    senses: number;
    aliases: number;
  };
  constraints: {
    allSourceMetadataPreserved: boolean;
    noMetadataDeleted: boolean;
    noCanonicalIdentityModified: boolean;
    noArtworkModified: boolean;
    productionDataUnchanged: boolean;
  };
  note: string;
}

export interface MetadataDatabaseManifest {
  generatedAt: string;
  phase: "8.6";
  recordCount: number;
  files: Record<string, string>;
}
