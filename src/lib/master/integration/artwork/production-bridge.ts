import { MASTER_INTEGRATION_CONFIG } from "../config";
import { resolveProductionCanonicalId } from "../production-map";
import type { ArtworkProviderPreference } from "./types";
import {
  getArtwork,
  getArtworkByProvider,
  listAvailableProviders,
  type ArtworkLookupOptions,
} from "./adapter";
import type { IntegratedArtworkEntry, IntegratedArtworkLookup } from "./types";

export const ARTWORK_PROVIDER_PREFERENCE: ArtworkProviderPreference = null;

export { resolveProductionCanonicalId } from "../production-map";

export function isMasterArtworkIntegrationEnabled(): boolean {
  return MASTER_INTEGRATION_CONFIG.masterArtworkEnabled;
}

export function getProductionArtwork(
  hexcode: string,
  productionType: "standard" | "extra",
  options: ArtworkLookupOptions = {},
): IntegratedArtworkLookup | null {
  if (!isMasterArtworkIntegrationEnabled()) {
    return null;
  }

  const canonicalId = resolveProductionCanonicalId(hexcode, productionType, options.rootDir);
  return getArtwork(canonicalId, options);
}

export function getProductionArtworkByProvider(
  hexcode: string,
  productionType: "standard" | "extra",
  provider: IntegratedArtworkEntry["provider"],
  options: ArtworkLookupOptions = {},
): readonly IntegratedArtworkEntry[] {
  if (!isMasterArtworkIntegrationEnabled()) {
    return Object.freeze([]);
  }

  const canonicalId = resolveProductionCanonicalId(hexcode, productionType, options.rootDir);
  return getArtworkByProvider(canonicalId, provider, options);
}

export function listProductionArtworkProviders(
  hexcode: string,
  productionType: "standard" | "extra",
  options: ArtworkLookupOptions = {},
): readonly IntegratedArtworkEntry["provider"][] {
  if (!isMasterArtworkIntegrationEnabled()) {
    return Object.freeze([]);
  }

  const canonicalId = resolveProductionCanonicalId(hexcode, productionType, options.rootDir);
  return listAvailableProviders(canonicalId, options);
}
