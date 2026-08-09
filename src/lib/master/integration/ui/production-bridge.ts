import { MASTER_INTEGRATION_CONFIG } from "../config";
import {
  isMasterArtworkIntegrationEnabled,
  listProductionArtworkProviders,
} from "../artwork/production-bridge";
import { isMasterMetadataIntegrationEnabled } from "../metadata/production-bridge";
import { resolveProductionCanonicalId } from "../production-map";
import type { MasterIntegrationConfig } from "../types";
import { getUiArtworkProviders } from "./artwork-ui-adapter";
import { getUiMetadataPayload } from "./metadata-ui-adapter";
import {
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
  getSharePath,
  toUiProductionContext,
} from "./shared";
import type { UiArtworkProviderOption, UiMetadataPayload, UiProductionContext } from "./types";

export function isMasterUiArtworkEnabled(): boolean {
  return isMasterArtworkIntegrationEnabled();
}

export function isMasterUiMetadataEnabled(): boolean {
  return isMasterMetadataIntegrationEnabled();
}

export function isMasterUiIntegrationActive(): boolean {
  return isMasterUiArtworkEnabled() || isMasterUiMetadataEnabled();
}

export { toUiProductionContext, getFavoriteIdentityKey, getRecentIdentityKey, getCopyIdentityValue, getSharePath };

export function resolveUiCanonicalId(context: UiProductionContext, rootDir?: string): string {
  return resolveProductionCanonicalId(context.hexcode, context.productionType, rootDir);
}

export function getUiProductionArtworkProviders(
  context: UiProductionContext,
  rootDir?: string,
): readonly UiArtworkProviderOption[] {
  if (!isMasterUiArtworkEnabled()) {
    return Object.freeze([]);
  }

  const canonicalId = resolveUiCanonicalId(context, rootDir);
  const providers = listProductionArtworkProviders(context.hexcode, context.productionType, { rootDir });
  if (providers.length === 0) {
    return Object.freeze([]);
  }

  return getUiArtworkProviders(canonicalId, rootDir);
}

export function getUiProductionMetadata(
  context: UiProductionContext,
  rootDir?: string,
): UiMetadataPayload | null {
  if (!isMasterUiMetadataEnabled()) {
    return null;
  }

  const canonicalId = resolveUiCanonicalId(context, rootDir);
  return getUiMetadataPayload(canonicalId, rootDir);
}

export function runWithIntegrationFlags<T>(overrides: Partial<MasterIntegrationConfig>, fn: () => T): T {
  const config = MASTER_INTEGRATION_CONFIG as MasterIntegrationConfig;
  const previous = {
    masterIntegrationEnabled: config.masterIntegrationEnabled,
    masterArtworkEnabled: config.masterArtworkEnabled,
    masterMetadataEnabled: config.masterMetadataEnabled,
    masterSearchEnabled: config.masterSearchEnabled,
    masterSEOEnabled: config.masterSEOEnabled,
  };

  Object.assign(config, overrides);
  try {
    return fn();
  } finally {
    Object.assign(config, previous);
  }
}
