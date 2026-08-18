import type { ContentProvenance, ContentQualityStatus } from "../types";

export type KnowledgeDataKind =
  | "official_unicode"
  | "cldr"
  | "emojiquick_editorial"
  | "derived"
  | "analytics";

export type EditorialReviewStatus = "draft" | "review" | "published" | "archived";

export interface EmojiKnowledgeRecord {
  readonly canonicalId: string;
  readonly slug: string;
  readonly language: string;
  readonly officialUnicodeName?: string;
  readonly cldrName?: string;
  readonly shortName?: string;
  readonly meaning?: string;
  readonly literalMeaning?: string;
  readonly emotionalMeaning?: string;
  readonly commonUsage?: string;
  readonly context?: string;
  readonly interpretations?: readonly string[];
  readonly misinterpretations?: readonly string[];
  readonly examples?: readonly string[];
  readonly whenToUse?: string;
  readonly whenNotToUse?: string;
  readonly relatedConcepts?: readonly string[];
  readonly culturalNotes?: string;
  readonly searchIntentTerms?: readonly string[];
  readonly editorialStatus: EditorialReviewStatus;
  readonly contentVersion: number;
  readonly provenance: ContentProvenance;
  readonly translationStatus?: ContentQualityStatus;
  readonly reviewStatus?: EditorialReviewStatus;
  readonly lastUpdated: string;
}

export interface KnowledgeCoverageReport {
  readonly totalIdentities: number;
  readonly indexableIdentities: number;
  readonly richContent: number;
  readonly mediumContent: number;
  readonly structuredOnlyContent: number;
  /** @deprecated use mediumContent */
  readonly partialContent: number;
  readonly missingContent: number;
  readonly richPercent: number;
  readonly mediumPercent: number;
  readonly averageQualityScore: number;
  readonly priorityOpportunities: readonly string[];
  readonly richSlugs: readonly string[];
  readonly mediumSlugs: readonly string[];
  /** @deprecated use mediumSlugs */
  readonly partialSlugs: readonly string[];
  readonly computedAt: string;
  readonly priorityBandCounts: Readonly<Record<"P0" | "P1" | "P2" | "P3", number>>;
  readonly analyticsRankingLabel: string;
  readonly localizedPageCount: number;
  readonly weakRecordCount: number;
}
