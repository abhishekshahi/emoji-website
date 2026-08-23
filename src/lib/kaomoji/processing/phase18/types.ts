export const PHASE18_ANALYTICS_VERSION = "18.0.0";

export interface Phase18Manifest {
  readonly phase: 18;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly analytics_version: string;
  readonly events_wired: readonly string[];
  readonly popularity_status: "INSUFFICIENT_DATA" | "LIVE";
  readonly trending_status: "INSUFFICIENT_DATA" | "LIVE";
  readonly minimum_events_for_trending: number;
  readonly anti_abuse_enabled: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
