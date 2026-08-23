export const PHASE21_QA_VERSION = "21.0.0";

export const PRODUCTION_DATA_COUNTS = {
  canonical: 63_248,
  quality_qualified: 63_181,
  public: 50_979,
  relationships: 392_904,
  raw: 236_508,
  fastemoji_drift: 3_825,
  duplicate_groups: 49_885,
  variant_groups: 15_143,
  legitimate_variants: 2_533,
} as const;

export interface Phase21Manifest {
  readonly phase: 21;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly qa_version: string;
  readonly data_counts: typeof PRODUCTION_DATA_COUNTS;
  readonly routes_audited: readonly string[];
  readonly locales: readonly string[];
  readonly seo: {
    readonly sitemap_expected_urls: number;
    readonly hreflang_locales: number;
    readonly json_ld_routes: boolean;
  };
  readonly analytics: {
    readonly popularity_status: "INSUFFICIENT_DATA" | "LIVE";
    readonly events_wired: readonly string[];
  };
  readonly rollback: {
    readonly previous_release_exists: boolean;
    readonly rollback_manifest_exists: boolean;
  };
  readonly gates: {
    readonly phase19: boolean;
    readonly phase20: boolean;
    readonly typecheck: boolean;
    readonly build: boolean;
  };
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
