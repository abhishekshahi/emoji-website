export type SemanticTermClassification =
  | "exact-canonical-meaning"
  | "direct-synonym"
  | "common-alternate-term"
  | "related-concept"
  | "contextual-association"
  | "specialized-terminology"
  | "potentially-confusing"
  | "source-specific-term"
  | "inappropriate-public-seo"
  | "unresolved";

export type AliasSafetyClassification =
  | "safe-canonical-alias"
  | "source-only-alternate-name"
  | "semantic-term"
  | "potentially-confusing"
  | "duplicate"
  | "ambiguous"
  | "unresolved";

export type SearchIntentClass = "exact" | "name" | "alias" | "keyword" | "semantic" | "ambiguous";

export type SemanticConflictKind =
  | "direct-synonym"
  | "alternate-wording"
  | "related-concept"
  | "ambiguous"
  | "source-specific"
  | "semantic-disagreement"
  | "unresolved";

export interface SemanticSourceRecord {
  metadataRecordId: string;
  source: string;
  sourceVersion: string;
  sourceId: string;
  canonicalId: string;
  recordType: "semantic" | "metadata" | "standard-data" | "utility";
  emoji: string | null;
  name: string | null;
  keywords: string[];
  definition: string | null;
  partOfSpeech: string | null;
  babelNetId: string | null;
  senseId: string | null;
  category: string | null;
  semanticRelationship: string | null;
  sourceURL: string;
  rawRecordRef: string;
  provenance: {
    source: string;
    sourceId: string;
    sourceVersion: string;
    rawRecordRef: string;
  };
}

export interface SemanticTermProvenance {
  term: string;
  normalizedTerm: string;
  canonicalId: string;
  source: string;
  sourceRecord: string;
  sourceVersion: string;
  originalValue: string;
  classification: SemanticTermClassification;
  publicSearch: boolean;
  publicSeo: boolean;
  reason: string;
}

export interface CanonicalSemanticIndexEntry {
  canonicalId: string;
  isUnicode: boolean;
  identityType: string;
  canonicalName: string;
  sourceSemantics: SemanticTermProvenance[];
  safeSearchTerms: SemanticTermProvenance[];
  safeSeoTerms: SemanticTermProvenance[];
  sourceOnlyTerms: SemanticTermProvenance[];
  ambiguousTerms: SemanticTermProvenance[];
  aliasAudits: AliasAuditEntry[];
  semanticDifferenceAudit: SemanticDifferenceAuditEntry | null;
}

export interface AliasAuditEntry {
  value: string;
  source: string;
  type: string;
  classification: AliasSafetyClassification;
  publicAlias: boolean;
  reason: string;
}

export interface SemanticDifferenceAuditEntry {
  canonicalId: string;
  canonicalName: string;
  originalClassification: string | null;
  sourceValues: Record<string, string>;
  publicSearchStatus: "allowed" | "restricted" | "source-only";
  publicSeoStatus: "allowed" | "restricted" | "source-only";
  reason: string;
}

export interface SemanticSearchTermEntry {
  term: string;
  normalizedTerm: string;
  canonicalIds: string[];
  termType: SearchIntentClass;
  sourceCount: number;
  confidence: number;
  ambiguous: boolean;
  publicSearch: boolean;
  sources: string[];
}

export interface SemanticDefinitionEntry {
  canonicalId: string;
  source: string;
  sourceVersion: string;
  metadataRecordId: string;
  definition: string;
  senseId: string | null;
  partOfSpeech: string | null;
  babelNetId: string | null;
  name: string | null;
  rawRecordRef: string;
}

export interface SemanticConflictEntry {
  canonicalId: string;
  kind: SemanticConflictKind;
  term: string;
  sources: string[];
  detail: string;
}

export interface SemanticCoverageEntry {
  canonicalId: string;
  hasSemanticData: boolean;
  emojinet: boolean;
  emojilib: boolean;
  emojibase: boolean;
  openmoji: boolean;
  cldr: boolean;
  unicode: boolean;
  fluent: boolean;
  emojiTime: boolean;
  senseCount: number;
  definitionCount: number;
}

export interface SemanticCoverageReport {
  generatedAt: string;
  phase: "8.8";
  totals: {
    canonicalIdentities: number;
    withSemanticData: number;
    withoutSemanticData: number;
    emojinetSenses: number;
    emojinetDefinitions: number;
    emojinetCoverage: number;
    emojilibCoverage: number;
    emojibaseCoverage: number;
    openmojiCoverage: number;
    cldrCoverage: number;
    unicodeCoverage: number;
    fluentCoverage: number;
    emojiTimeCoverage: number;
  };
  entries: SemanticCoverageEntry[];
}

export interface SemanticSeoPolicyReport {
  generatedAt: string;
  phase: "8.8";
  counts: {
    totalSemanticTerms: number;
    safeSearchTerms: number;
    safeSeoTerms: number;
    searchOnlyTerms: number;
    sourceOnlyTerms: number;
    ambiguousTerms: number;
    rejectedPublicSeoTerms: number;
    unresolvedTerms: number;
    semanticDifferenceConflicts: number;
    aliasAudits: number;
    safeAliases: number;
    restrictedAliases: number;
  };
  preservation: {
    emojinetSenses: number;
    emojinetDefinitions: number;
    allEmojilibKeywordsPreserved: boolean;
    allEmojibaseTagsPreserved: boolean;
    allSourceNamesPreserved: boolean;
    allSourceAliasesPreserved: boolean;
    allSourceShortcodesPreserved: boolean;
  };
  constraints: {
    allSourceSemanticsPreserved: boolean;
    noRawDataModified: boolean;
    noArtworkModified: boolean;
    noCanonicalIdentitiesModified: boolean;
    productionDataUnchanged: boolean;
  };
  note: string;
}

export interface SemanticDatabaseManifest {
  generatedAt: string;
  phase: "8.8";
  files: Record<string, string>;
}
