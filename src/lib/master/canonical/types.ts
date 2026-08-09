export type CanonicalIdentityType = "unicode" | "source-specific" | "private-use";

export type ArtworkProvider = "openmoji" | "noto" | "twemoji" | "fluent";

export interface CanonicalSourceRecordRef {
  source: string;
  sourceId: string;
  rawRecordRef: string;
}

export interface CanonicalArtworkRef {
  provider: ArtworkProvider;
  sourceId: string;
  path: string;
  rawRecordRef: string;
}

export interface CanonicalMetadataRef {
  source: string;
  sourceId: string;
  rawRecordRef: string;
}

export interface CanonicalSemanticRef {
  source: string;
  sourceId: string;
  rawRecordRef: string;
}

export interface CanonicalArtworkLinks {
  openmoji: CanonicalArtworkRef[];
  noto: CanonicalArtworkRef[];
  twemoji: CanonicalArtworkRef[];
  fluent: CanonicalArtworkRef[];
}

export interface CanonicalEmojiRecord {
  canonicalId: string;
  emoji: string | null;
  unicodeSequence: string | null;
  isUnicode: boolean;
  identityType: CanonicalIdentityType;
  sourceRecords: CanonicalSourceRecordRef[];
  sourceCount: number;
  artwork: CanonicalArtworkLinks;
  metadataSources: string[];
  metadataRefs: CanonicalMetadataRef[];
  semanticSources: string[];
  semanticRefs: CanonicalSemanticRef[];
}

export interface CrossSourceCoverageEntry {
  canonicalId: string;
  unicodeSequence: string | null;
  openmoji: boolean;
  noto: boolean;
  twemoji: boolean;
  fluent: boolean;
  unicode: boolean;
  emojibase: boolean;
  emojilib: boolean;
  emojinet: boolean;
  emojiTime: boolean;
  sourceCount: number;
}

export interface SourceOnlyRecordEntry {
  canonicalId: string;
  soleSource: string;
  identityType: CanonicalIdentityType;
  sourceRecordCount: number;
  hasArtwork: boolean;
  hasMetadata: boolean;
  hasSemantic: boolean;
}

export interface CanonicalAuditReport {
  generatedAt: string;
  phase: "8.4";
  baselines: {
    rawRecords: number;
    artwork: number;
    metadata: number;
    semantic: number;
  };
  counts: {
    uniqueUnicodeCanonicalIdentities: number;
    uniqueSourceSpecificIdentities: number;
    totalCanonicalIdentities: number;
    canonicalIdentitiesWithMultipleSources: number;
    canonicalIdentitiesWithOneSource: number;
    canonicalIdentitiesWithArtwork: number;
    canonicalIdentitiesWithMetadata: number;
    canonicalIdentitiesWithSemanticData: number;
    privateUseCanonicalIdentities: number;
    sourceSpecificCanonicalIdentities: number;
    artworkOnlySourceRecords: number;
    metadataOnlySourceRecords: number;
    semanticOnlySourceRecords: number;
  };
  sourceOnly: {
    openmojiOnly: number;
    notoOnly: number;
    twemojiOnly: number;
    fluentOnly: number;
    unicodeOnly: number;
    emojibaseOnly: number;
    emojilibOnly: number;
    emojinetOnly: number;
    emojiTimeOnly: number;
  };
  emojifindCompatibility: {
    standardRecords: number;
    standardMapped: number;
    extrasRecords: number;
    extrasMapped: number;
    intact: boolean;
  };
  note: string;
}

export interface CanonicalDatabaseManifest {
  generatedAt: string;
  phase: "8.4";
  recordCount: number;
  files: {
    canonicalEmojis: string;
    canonicalAuditReport: string;
    crossSourceCoverage: string;
    sourceOnlyRecords: string;
  };
}
