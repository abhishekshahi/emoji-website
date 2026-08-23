export const PHASE20_HARDENING_VERSION = "20.0.0";

export interface Phase20Manifest {
  readonly phase: 20;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly hardening_version: string;
  readonly security: {
    readonly parameterized_queries: boolean;
    readonly rate_limit_enabled: boolean;
    readonly search_sanitization: boolean;
    readonly no_secrets_in_client: boolean;
    readonly xss_controls: boolean;
  };
  readonly performance: {
    readonly schema_indexes: number;
    readonly search_benchmark_pass: boolean;
    readonly search_benchmark_score: string;
    readonly cache_headers_configured: boolean;
  };
  readonly accessibility: {
    readonly semantic_html_routes: number;
    readonly aria_patterns: boolean;
    readonly reduced_motion_support: boolean;
  };
  readonly failure_handling: {
    readonly graceful_search_empty: boolean;
    readonly rate_limit_response: boolean;
  };
  readonly raw_sha256: string;
  readonly raw_unchanged: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
