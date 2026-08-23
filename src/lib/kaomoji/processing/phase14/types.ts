export const PHASE14_SEARCH_VERSION = "14.0.0-search-v2";

export interface SearchIndexV2Record {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly normalized_content: string;
  readonly name: string | null;
  readonly meaning: string | null;
  readonly keywords: readonly string[];
  readonly categories: readonly string[];
  readonly emotions: readonly string[];
  readonly styles: readonly string[];
  readonly quality_score: number;
  readonly beauty_score: number;
  readonly priority: string;
}

export interface SearchIndexV2 {
  readonly version: typeof PHASE14_SEARCH_VERSION;
  readonly records: readonly SearchIndexV2Record[];
  readonly by_id: Record<string, SearchIndexV2Record>;
  readonly inverted: Record<string, readonly string[]>;
}

export interface SearchHitV2 {
  readonly record: SearchIndexV2Record;
  readonly score: number;
  readonly match_reason: string;
}

export interface SearchBenchmarkCase {
  readonly query: string;
  readonly kind:
    | "exact"
    | "category"
    | "emotion"
    | "style"
    | "keyword"
    | "meaning"
    | "typo"
    | "unicode"
    | "multi"
    | "synonym"
    | "empty"
    | "garbage"
    | "ambiguous"
    | "character"
    | "natural"
    | "platform";
  readonly min_results: number;
  readonly expect_zero?: boolean;
}

export interface Phase14Manifest {
  readonly phase: 14;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly search_version: string;
  readonly index_records: number;
  readonly legacy_pass_rate: number;
  readonly legacy_pass_count: number;
  readonly benchmark_queries: number;
  readonly benchmark_pass_rate: number;
  readonly benchmark_pass_count: number;
  readonly zero_result_rate: number;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

export interface RankingWeights {
  readonly exact_kaomoji: number;
  readonly exact_normalized: number;
  readonly exact_name: number;
  readonly exact_keyword: number;
  readonly exact_meaning: number;
  readonly exact_category: number;
  readonly emotion_style: number;
  readonly prefix: number;
  readonly token: number;
  readonly synonym: number;
  readonly fuzzy: number;
}
