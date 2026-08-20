import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { FULL_ARCHIVE_PREFIX } from "./types";
import { getAllowedArtworkProviders } from "../licenses";

const PROVIDER_SET = new Set<string>(getAllowedArtworkProviders());

const ALLOWED_ROOT_PREFIXES = ["master/", "manifests/"] as const;

export class FullArchiveKeyValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FullArchiveKeyValidationError";
  }
}

export function buildFullArchiveR2Key(...segments: readonly string[]): string {
  return [FULL_ARCHIVE_PREFIX, ...segments].join("/");
}

export function buildFullArchiveMasterKey(relativeToMaster: string): string {
  const normalized = relativeToMaster.replace(/\\/g, "/").replace(/^\/+/, "");
  return buildFullArchiveR2Key("master", normalized);
}

export function buildFullArchiveManifestKey(filename: string): string {
  return buildFullArchiveR2Key("manifests", filename);
}

export function assertSafeFullArchiveKey(key: string): void {
  if (!key || key.length > 1024) {
    throw new FullArchiveKeyValidationError("R2 key is empty or too long");
  }
  if (key.includes("..") || key.includes("\\") || key.startsWith("/")) {
    throw new FullArchiveKeyValidationError("R2 key contains unsafe path segments");
  }
  if (!key.startsWith(`${FULL_ARCHIVE_PREFIX}/`)) {
    throw new FullArchiveKeyValidationError("R2 key is outside approved archive prefix");
  }

  const relative = key.slice(FULL_ARCHIVE_PREFIX.length + 1);
  const allowed = ALLOWED_ROOT_PREFIXES.some((prefix) => relative.startsWith(prefix));
  if (!allowed) {
    throw new FullArchiveKeyValidationError(`R2 key must start with an approved prefix: ${ALLOWED_ROOT_PREFIXES.join(", ")}`);
  }
}

export function parseFullArchiveArtworkPath(
  provider: string,
  assetSegments: readonly string[],
): { provider: ArtworkProvider; assetPath: string; storageKey: string } {
  if (!PROVIDER_SET.has(provider)) {
    throw new FullArchiveKeyValidationError(`Unknown artwork provider: ${provider}`);
  }
  if (!assetSegments.length || assetSegments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new FullArchiveKeyValidationError("Invalid artwork asset path");
  }

  const assetPath = assetSegments.join("/");
  const storageKey = buildFullArchiveMasterKey(`raw/artwork/${provider}/${assetPath}`);
  assertSafeFullArchiveKey(storageKey);

  return {
    provider: provider as ArtworkProvider,
    assetPath,
    storageKey,
  };
}
