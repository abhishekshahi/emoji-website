export type SearchIntentKind =
  | "EMOJI_LOOKUP"
  | "MEANING"
  | "USE_CASE"
  | "CONTEXT"
  | "UNICODE"
  | "CATEGORY"
  | "COLLECTION"
  | "COMBINATION"
  | "GENERAL";

export interface SearchIntentResult {
  readonly kind: SearchIntentKind;
  readonly originalQuery: string;
  readonly normalizedQuery: string;
  readonly expandedQuery: string;
  readonly targetSlug?: string;
  readonly targetCanonicalId?: string;
  readonly useCaseTerms?: readonly string[];
  readonly confidence: number;
}
