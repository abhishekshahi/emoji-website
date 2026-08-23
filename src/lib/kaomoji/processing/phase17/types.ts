export const PHASE17_UI_VERSION = "17.0.0";

export interface Phase17Manifest {
  readonly phase: 17;
  readonly timestamp: string;
  readonly pipeline_version: string;
  readonly ui_version: string;
  readonly instant_search: boolean;
  readonly debounce_ms: number;
  readonly filter_categories: number;
  readonly accessibility_checks: readonly string[];
  readonly mobile_first: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}
