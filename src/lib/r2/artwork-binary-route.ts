import type { ArtworkProvider } from "@/lib/master/artwork/types";
import {
  extractBareSourceId,
  extractHexFromArtworkSourceId,
  extractHexFromNotoFilename,
  extractHexFromTwemojiFilename,
  isPrivateUseSequence,
  normalizeHexSequence,
} from "@/lib/master/identity/normalize";
import { R2KeyValidationError } from "@/lib/master/r2/keys";
import { getAllowedArtworkProviders } from "@/lib/master/r2/licenses";
import { sha256Hex } from "@/lib/master/r2/sharding";
import type { MasterR2Adapter } from "./master-r2";
import { isArtworkPubliclyServable } from "./license-matrix";
import { isArtworkPathPublicEligible } from "@/lib/master/public/license-coverage";

const PROVIDER_SET = new Set<string>(getAllowedArtworkProviders());
const IMAGE_FORMAT_EXTENSION = /\.(svg|png|webp|gif|jpg|jpeg)$/i;

function parseSourceIdAndFormat(assetPath: string): { sourceId: string; format: string } {
  const formatMatch = assetPath.match(IMAGE_FORMAT_EXTENSION);
  if (!formatMatch) {
    throw new R2KeyValidationError("Invalid artwork asset path");
  }

  const format = formatMatch[1]!.toLowerCase();
  const colonCount = assetPath.split(":").length - 1;

  // Multi-segment sourceIds (noto/twemoji/fluent filenames) keep the trailing extension in sourceId.
  if (colonCount >= 2) {
    return { sourceId: assetPath, format };
  }

  const sourceId = assetPath.slice(0, assetPath.length - formatMatch[0].length);
  if (!sourceId) {
    throw new R2KeyValidationError("Invalid artwork asset path");
  }

  return { sourceId, format };
}

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
  const { sourceId, format } = parseSourceIdAndFormat(assetPath);

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

function buildCanonicalIdCandidates(provider: ArtworkProvider, sourceId: string): readonly string[] {
  const candidates = new Set<string>();

  const addUnicode = (hex: string | null | undefined) => {
    if (!hex) {
      return;
    }
    if (isPrivateUseSequence(hex)) {
      candidates.add(`source:${provider}:${extractBareSourceId(provider, sourceId)}`);
    } else {
      candidates.add(`unicode:${hex}`);
    }
  };

  const primary = resolveCanonicalIdForArtworkSource(provider, sourceId);
  if (primary) {
    candidates.add(primary);
  }

  addUnicode(extractHexFromArtworkSourceId(sourceId));

  const lastSegment = sourceId.split(":").pop() ?? "";
  if (provider === "noto") {
    addUnicode(extractHexFromNotoFilename(lastSegment));
  } else if (provider === "twemoji") {
    addUnicode(extractHexFromTwemojiFilename(lastSegment));
  } else if (provider === "openmoji") {
    const hex = sourceId.match(/:([0-9A-F-]+)$/i)?.[1];
    addUnicode(hex ? normalizeHexSequence(hex) : null);
  }

  return [...candidates];
}

function synthesizeFluentArtworkPath(sourceId: string): string | null {
  const filePart = sourceId.split(":").pop() ?? "";
  const match = filePart.match(/^(.+)\.(svg|png)$/i);
  if (!match) {
    return null;
  }

  const base = match[1]!;
  const ext = match[2]!.toLowerCase();
  const folderToken = base.split("_")[0];
  if (!folderToken) {
    return null;
  }

  const folder = folderToken.charAt(0).toUpperCase() + folderToken.slice(1).toLowerCase();
  let variant = "Color";
  if (base.includes("flat")) {
    variant = "Flat";
  } else if (base.includes("high_contrast")) {
    variant = "High Contrast";
  }

  return `artwork/fluent/assets/${folder}/${variant}/${base}.${ext}`;
}

async function loadArtworkBytesFromPath(
  adapter: MasterR2Adapter,
  provider: ArtworkProvider,
  path: string,
  format: string,
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  if (!isArtworkPathPublicEligible(provider, path)) {
    return null;
  }

  const recordResult = await adapter.getArtworkRecord(sha256Hex(path));
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
  for (const canonicalId of buildCanonicalIdCandidates(provider, sourceId)) {
    const identityResult = await adapter.getIdentity(canonicalId);
    const artworkEntries = (identityResult?.data?.artwork?.[provider] ?? []) as IdentityArtworkEntry[];
    const match = artworkEntries.find((entry) => entry.sourceId === sourceId);
    if (match?.path) {
      const resolved = await loadArtworkBytesFromPath(adapter, provider, match.path, format);
      if (resolved) {
        return resolved;
      }
    }
  }

  if (provider === "fluent") {
    const synthesizedPath = synthesizeFluentArtworkPath(sourceId);
    if (synthesizedPath) {
      return await loadArtworkBytesFromPath(adapter, provider, synthesizedPath, format);
    }
  }

  return null;
}

export async function isPublicArtworkRequestAllowed(
  adapter: MasterR2Adapter,
  provider: ArtworkProvider,
): Promise<boolean> {
  const matrix = await adapter.getLicenseMatrix();
  return isArtworkPubliclyServable(provider, matrix);
}
