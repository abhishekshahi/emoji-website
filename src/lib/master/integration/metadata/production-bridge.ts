import { MASTER_INTEGRATION_CONFIG } from "../config";
import { resolveProductionCanonicalId } from "../production-map";
import { getEnrichedMetadata } from "./enrichment";
import type { EnrichedMetadataLookup } from "./types";

export function isMasterMetadataIntegrationEnabled(): boolean {
  return MASTER_INTEGRATION_CONFIG.masterMetadataEnabled;
}

export function getProductionMetadata(
  hexcode: string,
  productionType: "standard" | "extra",
  rootDir?: string,
): EnrichedMetadataLookup | null {
  if (!isMasterMetadataIntegrationEnabled()) {
    return null;
  }

  const canonicalId = resolveProductionCanonicalId(hexcode, productionType, rootDir);
  return getEnrichedMetadata(canonicalId, rootDir);
}
