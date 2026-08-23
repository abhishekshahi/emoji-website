export const PHASE15_LOCALE_VERSION = "15.0.0";

export interface Phase15Manifest {
  readonly phase: 15;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly locale_version: string;
  readonly supported_locales: number;
  readonly localized_search_terms: number;
  readonly published_locales: number;
  readonly review_required_locales: number;
  readonly hreflang_routes: number;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
