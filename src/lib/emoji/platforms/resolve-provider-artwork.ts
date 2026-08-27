import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { buildPublicArtworkApiUrl } from "@/lib/master/public/artwork-api-url";
import { ARTWORK_PRIORITY_ORDER } from "@/lib/artwork/provider-architecture";
import type {
  ArtworkAssetRef,
  ArtworkIdentityInput,
  PreferredArtworkResult,
} from "@/lib/artwork/resolve-preferred-artwork";
import {
  isAssetPubliclyEligible,
  resolvePreferredArtwork,
} from "@/lib/artwork/resolve-preferred-artwork";

const PROVIDER_LABELS: Record<ArtworkProvider, string> = {
  noto: "Noto Emoji (Google)",
  fluent: "Fluent Emoji (Microsoft)",
  openmoji: "OpenMoji",
  twemoji: "Twemoji (X contributors)",
};

const PROVIDER_LICENSES: Record<ArtworkProvider, string> = {
  noto: "Apache-2.0 / OFL",
  fluent: "MIT",
  openmoji: "CC BY-SA 4.0",
  twemoji: "CC BY 4.0",
};

function hexFromCanonical(canonicalId: string): string | null {
  if (!canonicalId.startsWith("unicode:")) return null;
  return canonicalId.slice("unicode:".length).toLowerCase();
}

function scorePrimaryAsset(asset: ArtworkAssetRef, canonicalHex: string | null): number {
  let score = 0;
  const path = asset.path.toLowerCase();
  const source = asset.sourceId.toLowerCase();
  if (path.endsWith(".svg")) score += 100;
  if (canonicalHex) {
    const underscored = canonicalHex.replace(/-/g, "_");
    const exactToken = `emoji_u${underscored}`;
    if (path.includes(exactToken)) score += 80;
    if (path.includes(`${exactToken}.`)) score += 40;
    if (!canonicalHex.includes("-")) {
      if (path.includes("200d") || source.includes("200d")) score -= 60;
    }
  }
  return score;
}

function pickPrimaryAsset(
  assets: readonly ArtworkAssetRef[],
  canonicalId?: string,
): ArtworkAssetRef | null {
  if (assets.length === 0) return null;
  const canonicalHex = canonicalId ? hexFromCanonical(canonicalId) : null;
  return [...assets].sort(
    (left, right) => scorePrimaryAsset(right, canonicalHex) - scorePrimaryAsset(left, canonicalHex),
  )[0] ?? null;
}

function formatFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "svg";
  if (ext === "png") return "png";
  return ext ?? "unknown";
}

function buildPermittedArtworkUrl(
  provider: ArtworkProvider,
  asset: ArtworkAssetRef,
  hexcode: string,
): string | null {
  if (!isAssetPubliclyEligible(provider, asset)) return null;
  if (provider === "openmoji") {
    return getOpenMojiArtworkPath(hexcode.toUpperCase()) ?? getOpenMojiArtworkPath(hexcode);
  }
  const format = formatFromPath(asset.path);
  if (format === "unknown") return null;
  return buildPublicArtworkApiUrl(provider, asset.sourceId, format);
}

/** Resolve one open-source provider artwork URL when license policy permits. */
export function resolveProviderArtwork(
  identity: ArtworkIdentityInput,
  provider: ArtworkProvider,
  hexcode: string,
): PreferredArtworkResult | null {
  const assets = identity.artwork[provider];
  if (!assets?.length) return null;
  const asset = pickPrimaryAsset(assets, identity.canonicalId);
  if (!asset) return null;
  const url = buildPermittedArtworkUrl(provider, asset, hexcode);
  if (!url) return null;
  return Object.freeze({
    provider,
    asset,
    url,
    format: formatFromPath(asset.path),
    license: PROVIDER_LICENSES[provider],
    provenance: PROVIDER_LABELS[provider],
    style: asset.variant ?? "default",
    fallbackRank: ARTWORK_PRIORITY_ORDER.indexOf(provider) + 1,
    publiclyServed: true,
    availability: "public",
  });
}

export function resolveAllPublicProviderArtworks(
  identity: ArtworkIdentityInput,
  hexcode: string,
): readonly PreferredArtworkResult[] {
  const out: PreferredArtworkResult[] = [];
  for (const provider of ARTWORK_PRIORITY_ORDER) {
    const resolved = resolveProviderArtwork(identity, provider, hexcode);
    if (resolved) out.push(resolved);
  }
  return out;
}

export function getProviderLabel(provider: ArtworkProvider): string {
  return PROVIDER_LABELS[provider];
}

export { resolvePreferredArtwork };
