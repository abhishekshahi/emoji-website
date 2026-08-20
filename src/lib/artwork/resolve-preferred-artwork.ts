import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { getArtworkProviderPolicy } from "@/lib/master/public/license-registry";
import { isArtworkPathPublicEligible } from "@/lib/master/public/license-coverage";
import { buildPublicArtworkApiUrl } from "@/lib/master/public/artwork-api-url";
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
  readonly url: string;
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

/** Per-asset license gate — provider registry + path classification for Noto/Fluent. */
export function isAssetPubliclyEligible(
  provider: ArtworkProvider,
  asset: ArtworkAssetRef,
): boolean {
  if (!isPublicArtworkProvider(provider)) return false;
  if (provider === "noto" || provider === "fluent") {
    return isArtworkPathPublicEligible(provider, asset.path);
  }
  return true;
}

function buildPermittedArtworkUrl(
  provider: ArtworkProvider,
  asset: ArtworkAssetRef,
): string | null {
  if (!isAssetPubliclyEligible(provider, asset)) return null;
  const format = formatFromPath(asset.path);
  if (format === "unknown") return null;
  return buildPublicArtworkApiUrl(provider, asset.sourceId, format);
}

/**
 * Single authoritative artwork resolver (Phase 8.62-C).
 * Priority: Noto → Fluent → OpenMoji → Twemoji → (no other provider tier in catalog).
 * Skips license-blocked assets and continues fallback. Missing preferred artwork ≠ missing identity.
 */
export function resolvePreferredArtwork(
  identity: ArtworkIdentityInput,
): PreferredArtworkResult | null {
  for (let rank = 0; rank < ARTWORK_PRIORITY_ORDER.length; rank++) {
    const provider = ARTWORK_PRIORITY_ORDER[rank]!;
    const assets = identity.artwork[provider];
    if (!assets || assets.length === 0) continue;

    const asset = pickPrimaryAsset(assets, identity.canonicalId);
    if (!asset) continue;

    const url = buildPermittedArtworkUrl(provider, asset);
    if (!url) continue;

    const policy = getArtworkProviderPolicy(provider);
    const format = formatFromPath(asset.path);

    return Object.freeze({
      provider,
      asset,
      url,
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

/** Alias — public OG/SEO images use the same permitted priority chain. */
export function resolvePublicPreferredArtwork(
  identity: ArtworkIdentityInput,
): PreferredArtworkResult | null {
  return resolvePreferredArtwork(identity);
}
