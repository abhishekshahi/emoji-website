export type IdentityCategory =
  | "unicode-canonical"
  | "unicode-sequence"
  | "private-use"
  | "source-specific"
  | "metadata-only"
  | "artwork-only"
  | "semantic-only"
  | "unmatched";

export type IdentityRecordKind = "source" | "artwork" | "metadata";

export interface RawIdentityMapping {
  source: string;
  sourceId: string;
  canonicalIdentity: string;
  identityCategory: IdentityCategory;
  normalizedSequence: string | null;
  mappingMethod: string;
  recordKind: IdentityRecordKind;
}

export interface CanonicalSourceRef {
  source: string;
  sourceId: string;
  recordKind: IdentityRecordKind;
  identityCategory: IdentityCategory;
}

export interface ArtworkIdentityMapping {
  provider: string;
  sourceId: string;
  canonicalIdentity: string;
  path: string;
  checksum: string | null;
  version: string;
  license: string;
  identityCategory: IdentityCategory;
  mappingMethod: string;
}

export interface MetadataIdentityMapping {
  source: string;
  sourceId: string;
  canonicalIdentity: string;
  identityCategory: IdentityCategory;
  mappingMethod: string;
}

export interface IdentityConflict {
  type: string;
  source: string;
  sourceId: string;
  details: string;
  candidates: string[];
  category?: string;
  resolution?: string;
}

export interface EmojiNetIdentityReport {
  generatedAt: string;
  total: number;
  matched: number;
  unmatched: number;
  unicodeMappings: number;
  nonUnicodeRecords: number;
  records: Array<{
    sourceId: string;
    canonicalIdentity: string;
    identityCategory: IdentityCategory;
    recordType: string;
  }>;
}

export interface EmojiTimeIdentityMapping {
  source: string;
  sourceId: string;
  mapping: {
    hour: number;
    halfHour: boolean;
    hexcode: string;
    emoji: string;
  };
  canonicalIdentity: string;
}

export interface IdentityAuditReport {
  generatedAt: string;
  phase: "8.3" | "8.3a";
  baselines: {
    rawRecords: number;
    artwork: number;
    metadata: number;
    semantic: number;
    nonUnicode: number;
  };
  counts: {
    rawSourceMappings: number;
    artworkMappings: number;
    metadataMappings: number;
    uniqueUnicodeIdentities: number;
    uniqueSourceSpecificIdentities: number;
    privateUseIdentities: number;
    metadataOnlyIdentities: number;
    artworkOnlyIdentities: number;
    semanticOnlyIdentities: number;
    unmatchedIdentities: number;
    potentialConflicts: number;
  };
  identityCategories: Record<IdentityCategory, number>;
  emojinet: {
    total: number;
    matched: number;
    unmatched: number;
    unicodeMappings: number;
    nonUnicodeRecords: number;
  };
  emojiTime: {
    total: number;
    mapped: number;
  };
  openmojiExtras: {
    total: number;
    privateUse: number;
    unicode: number;
  };
  existingDataCheck: {
    standardRecords: number;
    extrasRecords: number;
    standardRecordsExpected: number;
    extrasRecordsExpected: number;
    intact: boolean;
  };
  note: string;
}
