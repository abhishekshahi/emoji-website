import type { ArtworkProvider } from "@/lib/master/artwork/types";
import {
  extractBareSourceId,
  extractHexFromArtworkSourceId,
  isPrivateUseSequence,
} from "@/lib/master/identity/normalize";
import { R2KeyValidationError } from "@/lib/master/r2/keys";
import { getAllowedArtworkProviders } from "@/lib/master/r2/licenses";
import { sha256Hex } from "@/lib/master/r2/sharding";
import type { MasterR2Adapter } from "./master-r2";
import { isArtworkPubliclyServable } from "./license-matrix";

const PROVIDER_SET = new Set<string>(getAllowedArtworkProviders());

type IdentityArtworkEntry = {
  readonly provider: ArtworkProvider;
  readonly sourceId: string;
  readonly path: string;
};

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

export function parsePublicArtworkApiPath(
  provider: string,
  assetSegments: readonly string[],
): { provider: ArtworkProvider; sourceId: string; format: string } {
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
  const lastDot = assetPath.lastIndexOf(".");
  if (lastDot <= 0) {
    throw new R2KeyValidationError("Invalid artwork asset path");
  }

  const sourceId = assetPath.slice(0, lastDot);
  const format = assetPath.slice(lastDot + 1).toLowerCase();
  if (!sourceId || !format) {
    throw new R2KeyValidationError("Invalid artwork asset path");
  }

  return {
    provider: provider as ArtworkProvider,
    sourceId,
    format,
  };
}

function resolveCanonicalIdForArtworkSource(
  provider: ArtworkProvider,
  sourceId: string,
): string | null {
  const hex = extractHexFromArtworkSourceId(sourceId);
  if (hex) {
    if (isPrivateUseSequence(hex)) {
      return `source:${provider}:${extractBareSourceId(provider, sourceId)}`;
    }
    return `unicode:${hex}`;
  }

  return `source:${provider}:${extractBareSourceId(provider, sourceId)}`;
}

function contentTypeForFormat(format: string): string {
  if (format === "svg") return "image/svg+xml";
  if (format === "png") return "image/png";
  return "application/octet-stream";
}

export async function resolvePublicArtworkBinary(
  adapter: MasterR2Adapter,
  provider: ArtworkProvider,
  sourceId: string,
  format: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const canonicalId = resolveCanonicalIdForArtworkSource(provider, sourceId);
  if (!canonicalId) {
    return null;
  }

  const identityResult = await adapter.getIdentity(canonicalId);
  const artworkEntries = (identityResult?.data?.artwork?.[provider] ?? []) as IdentityArtworkEntry[];
  const match = artworkEntries.find((entry) => entry.sourceId === sourceId);
  if (!match?.path) {
    return null;
  }

  const recordResult = await adapter.getArtworkRecord(sha256Hex(match.path));
  const record = recordResult?.data;
  if (!record) {
    return null;
  }

  const ext =
    record.format.toLowerCase() === "png"
      ? "png"
      : record.format.toLowerCase() === "svg"
        ? "svg"
        : "bin";
  const bytes = await adapter.getArtworkBinary(record.checksum, ext);
  if (!bytes) {
    return null;
  }

  return {
    bytes,
    contentType: contentTypeForFormat(format || ext),
  };
}

export async function isPublicArtworkRequestAllowed(
  adapter: MasterR2Adapter,
  provider: ArtworkProvider,
): Promise<boolean> {
  const matrix = await adapter.getLicenseMatrix();
  return isArtworkPubliclyServable(provider, matrix);
}
