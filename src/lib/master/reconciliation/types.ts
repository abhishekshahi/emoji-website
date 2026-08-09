export type NameConflictCategory =
  | "exact-equivalent"
  | "punctuation-difference"
  | "capitalization-difference"
  | "singular-plural-difference"
  | "wording-difference"
  | "synonym"
  | "regional-terminology"
  | "semantic-difference"
  | "source-specific-naming";

export type AliasType =
  | "source-name"
  | "alternate-wording"
  | "synonym"
  | "regional"
  | "semantic-label"
  | "source-specific";

export type ShortcodeStatus = "active" | "legacy" | "duplicate-normalized";

export interface SourceNameEntry {
  source: string;
  sourceId: string;
  value: string;
  metadataRecordId: string;
}

export interface CanonicalNameRecord {
  canonicalId: string;
  isUnicode: boolean;
  identityType: "unicode" | "source-specific" | "private-use";
  canonicalName: string;
  nameSource: string;
  nameSelectionRule: string;
  sourceNames: SourceNameEntry[];
  aliases: CanonicalAlias[];
  conflictCategory: NameConflictCategory | null;
}

export interface CanonicalAlias {
  value: string;
  source: string;
  type: AliasType;
  canonicalId: string;
  metadataRecordId?: string;
}

export interface SourceKeywordSet {
  source: string;
  keywords: string[];
  metadataRecordIds: string[];
}

export interface CanonicalKeywordEntry {
  canonicalId: string;
  canonicalKeywords: Array<{
    value: string;
    sources: string[];
    reason: string;
  }>;
  sourceKeywords: SourceKeywordSet[];
  normalizedKeywords: string[];
}

export interface CanonicalShortcodeEntry {
  canonicalId: string;
  shortcodes: Array<{
    shortcode: string;
    normalizedShortcode: string;
    source: string;
    shortcodePack: string;
    status: ShortcodeStatus;
    metadataRecordId?: string;
  }>;
}

export interface CanonicalSeoRecord {
  canonicalId: string;
  canonicalName: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  aliases: string[];
  keywords: string[];
  disambiguated: boolean;
  disambiguationReason: string | null;
}

export interface SeoConflictEntry {
  kind:
    | "duplicate-slug"
    | "duplicate-canonical-name"
    | "ambiguous-alias"
    | "unsafe-keyword"
    | "overly-broad-keyword"
    | "source-specific-naming-conflict";
  canonicalId: string;
  value: string;
  relatedCanonicalIds: string[];
  detail: string;
}

export interface CanonicalSearchIndexEntry {
  canonicalId: string;
  emoji: string | null;
  unicodeSequence: string | null;
  hexcode: string | null;
  canonicalName: string;
  aliases: string[];
  keywords: string[];
  shortcodes: string[];
  sourceNames: string[];
  sourceKeywords: string[];
  semanticSearchTerms: string[];
  provenance: {
    canonicalName: { source: string; rule: string };
    aliases: Array<{ value: string; source: string }>;
    keywords: Array<{ value: string; sources: string[] }>;
    shortcodes: Array<{ value: string; source: string; pack: string }>;
    semanticTerms: Array<{ value: string; source: string; metadataRecordId: string }>;
  };
  proposedRankingModel: {
    exactEmoji: number;
    exactUnicode: number;
    exactHexcode: number;
    exactCanonicalName: number;
    exactShortcode: number;
    exactAlias: number;
    exactKeyword: number;
    prefixName: number;
    prefixKeyword: number;
    semanticMatch: number;
  };
}

export interface NameReconciliationConflictDetail {
  canonicalId: string;
  originalClassification: string | null;
  category: NameConflictCategory;
  resolution: "canonical-name" | "alias" | "source-only" | "unresolved";
  canonicalName: string;
  sourceNames: Record<string, string>;
}

export interface NameReconciliationReport {
  generatedAt: string;
  phase: "8.7";
  ruleDocumentation: {
    unicodeNamePriority: string[];
    sourceSpecificNamePriority: string[];
    aliasRules: string[];
    keywordDedupRules: string[];
    slugRules: string[];
  };
  baselines: {
    originalNameConflicts: number;
    canonicalIdentities: number;
  };
  conflictClassification: Record<NameConflictCategory, number>;
  resolutionCounts: {
    becameCanonicalNames: number;
    becameAliases: number;
    remainedSourceOnly: number;
    remainedUnresolved: number;
  };
  outputCounts: {
    canonicalNameRecords: number;
    totalAliases: number;
    canonicalKeywordEntries: number;
    totalCanonicalKeywords: number;
    canonicalShortcodeEntries: number;
    totalShortcodeRecords: number;
    seoRecords: number;
    seoConflicts: number;
    searchIndexEntries: number;
  };
  conflictDetails: NameReconciliationConflictDetail[];
  constraints: {
    allSourceMetadataPreserved: boolean;
    noRawDataModified: boolean;
    noArtworkModified: boolean;
    noCanonicalIdentitiesModified: boolean;
    productionDataUnchanged: boolean;
  };
  note: string;
}
