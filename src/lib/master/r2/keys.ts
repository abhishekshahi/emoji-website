import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { R2_MAX_ARTWORK_KEY_LENGTH } from "./config";
import { R2_BUCKET_PREFIX } from "./types";
import { getAllowedArtworkProviders } from "./licenses";

const PROVIDER_SET = new Set<string>(getAllowedArtworkProviders());

export function buildR2ObjectKey(...segments: readonly string[]): string {
  return [R2_BUCKET_PREFIX, ...segments].join("/");
}

export function buildArtworkStorageKey(provider: ArtworkProvider, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^artwork\//, "");
  return buildR2ObjectKey("artwork", provider, normalized);
}

export function buildIdentityShardKey(shardId: string): string {
  return buildR2ObjectKey("identities", `${shardId}.json`);
}

export function buildMetadataShardKey(shardId: string): string {
  return buildR2ObjectKey("metadata", `${shardId}.json`);
}

export function buildSemanticShardKey(shardId: string): string {
  return buildR2ObjectKey("semantic", `${shardId}.json`);
}

export function buildSearchShardKey(shardId: string): string {
  return buildR2ObjectKey("search", `${shardId}.json`);
}

export function buildManifestKey(): string {
  return buildR2ObjectKey("manifests", "r2-manifest.json");
}

export function buildArtworkIndexKey(): string {
  return buildR2ObjectKey("indexes", "artwork-keys.json");
}

export class R2KeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "R2KeyValidationError";
  }
}

export function assertSafeR2Key(key: string): void {
  if (!key || key.length > R2_MAX_ARTWORK_KEY_LENGTH) {
    throw new R2KeyValidationError("R2 key is empty or too long");
  }
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new R2KeyValidationError("R2 key contains unsafe path segments");
  }
  if (!key.startsWith(`${R2_BUCKET_PREFIX}/`)) {
    throw new R2KeyValidationError("R2 key is outside approved bucket prefix");
  }
}

function assertSafeAssetSegment(segment: string): void {
  if (!segment || segment === "." || segment === "..") {
    throw new R2KeyValidationError("Invalid artwork asset path");
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    throw new R2KeyValidationError("Invalid artwork asset path encoding");
  }

  if (decoded === "." || decoded === ".." || decoded.includes("/") || decoded.includes("\\")) {
    throw new R2KeyValidationError("Invalid artwork asset path");
  }
}

export function parseArtworkApiPath(
  provider: string,
  assetSegments: readonly string[],
): { provider: ArtworkProvider; assetPath: string; storageKey: string } {
  if (!PROVIDER_SET.has(provider)) {
    throw new R2KeyValidationError(`Unknown artwork provider: ${provider}`);
  }

  if (!assetSegments.length) {
    throw new R2KeyValidationError("Invalid artwork asset path");
  }

  for (const segment of assetSegments) {
    assertSafeAssetSegment(segment);
  }

  const assetPath = assetSegments.join("/");
  const storageKey = buildArtworkStorageKey(provider as ArtworkProvider, assetPath);
  assertSafeR2Key(storageKey);

  return {
    provider: provider as ArtworkProvider,
    assetPath,
    storageKey,
  };
}

export function encodeCanonicalIdForApi(canonicalId: string): string {
  return encodeURIComponent(canonicalId);
}

export function decodeCanonicalIdFromApi(encoded: string): string {
  return decodeURIComponent(encoded);
}
