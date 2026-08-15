import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { getArtworkProviderPolicy } from "@/lib/master/public/license-registry";
import {
  ARTWORK_PRIORITY_ORDER,
  isPublicArtworkProvider,
  resolveArtworkAvailability,
} from "./provider-architecture";

export interface ArtworkAssetRef {
  readonly sourceId: string;
  readonly path: string;
  readonly format: string;
  readonly variant?: string | null;
}

export interface ArtworkIdentityInput {
  readonly canonicalId: string;
  readonly artwork: Partial<Record<ArtworkProvider, readonly ArtworkAssetRef[]>>;
}

export interface PreferredArtworkResult {
  readonly provider: ArtworkProvider;
  readonly asset: ArtworkAssetRef;
  readonly url: string | null;
  readonly format: string;
  readonly license: string;
  readonly provenance: string;
  readonly style: string;
  readonly fallbackRank: number;
  readonly publiclyServed: boolean;
  readonly availability: "public" | "indexed" | "missing";
}

const PROVIDER_LICENSES: Record<ArtworkProvider, string> = {
  noto: "Apache-2.0 / OFL",
  fluent: "MIT",
  openmoji: "CC BY-SA 4.0",
  twemoji: "CC BY 4.0",
};

const PROVIDER_PROVENANCE: Record<ArtworkProvider, string> = {
  noto: "Google Noto Emoji",
  fluent: "Microsoft Fluent Emoji",
  openmoji: "OpenMoji Project",
  twemoji: "Twemoji (Twitter/X contributors)",
};

function formatFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "svg") return "svg";
  if (ext === "png") return "png";
  return ext ?? "unknown";
}

function buildArtworkUrl(provider: ArtworkProvider, asset: ArtworkAssetRef): string | null {
  if (!isPublicArtworkProvider(provider)) return null;
  const format = formatFromPath(asset.path);
  if (format === "unknown") return null;
  return `/api/artwork/${provider}/${asset.sourceId}.${format}`;
}

function pickPrimaryAsset(assets: readonly ArtworkAssetRef[]): ArtworkAssetRef | null {
  if (assets.length === 0) return null;
  const svg = assets.find((a) => formatFromPath(a.path) === "svg");
  return svg ?? assets[0] ?? null;
}

/** Single centralized artwork resolver (8.62-B). Missing preferred artwork != missing identity. */
export function resolvePreferredArtwork(
  identity: ArtworkIdentityInput,
): PreferredArtworkResult | null {
  for (let rank = 0; rank < ARTWORK_PRIORITY_ORDER.length; rank++) {
    const provider = ARTWORK_PRIORITY_ORDER[rank]!;
    const assets = identity.artwork[provider];
    if (!assets || assets.length === 0) continue;

    const asset = pickPrimaryAsset(assets);
    if (!asset) continue;

    const policy = getArtworkProviderPolicy(provider);
    const format = formatFromPath(asset.path);

    return Object.freeze({
      provider,
      asset,
      url: buildArtworkUrl(provider, asset),
      format,
      license: PROVIDER_LICENSES[provider],
      provenance: PROVIDER_PROVENANCE[provider],
      style: asset.variant ?? "default",
      fallbackRank: rank + 1,
      publiclyServed: policy.publicServingAllowed,
      availability: resolveArtworkAvailability(provider, true),
    });
  }

  return null;
}

/** Resolve preferred publicly-served artwork only (for OG/SEO images). */
export function resolvePublicPreferredArtwork(
  identity: ArtworkIdentityInput,
): PreferredArtworkResult | null {
  for (const provider of ARTWORK_PRIORITY_ORDER) {
    if (!isPublicArtworkProvider(provider)) continue;
    const assets = identity.artwork[provider];
    if (!assets?.length) continue;
    const asset = pickPrimaryAsset(assets);
    if (!asset) continue;
    const url = buildArtworkUrl(provider, asset);
    if (!url) continue;
    return Object.freeze({
      provider,
      asset,
      url,
      format: formatFromPath(asset.path),
      license: PROVIDER_LICENSES[provider],
      provenance: PROVIDER_PROVENANCE[provider],
      style: asset.variant ?? "default",
      fallbackRank: ARTWORK_PRIORITY_ORDER.indexOf(provider) + 1,
      publiclyServed: true,
      availability: "public" as const,
    });
  }
  return null;
}
