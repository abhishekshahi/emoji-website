export const PHASE19_CLOUDFLARE_VERSION = "19.0.0";

export interface Phase19PipelineResult {
  readonly manifest: import("../../cloudflare/types").Phase19Manifest;
  readonly export: import("../../cloudflare/types").Phase19ExportSummary;
}
