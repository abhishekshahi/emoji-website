import type { ArtworkProvider } from "./types";

const UTILITY_SOURCE_IDS = new Set(["noto-artwork:noto.png:noto.png"]);

export function isUtilityArtwork(sourceId: string, stagedPath: string): boolean {
  if (UTILITY_SOURCE_IDS.has(sourceId)) {
    return true;
  }

  return stagedPath === "artwork/noto/images/noto.png";
}

export function normalizeArtworkVariant(
  provider: ArtworkProvider,
  format: string,
  variant: string | null,
  stagedPath: string,
): string {
  if (provider === "openmoji") {
    return "svg";
  }

  if (provider === "twemoji") {
    if (format === "svg" || stagedPath.includes("/svg/")) {
      return "svg";
    }
    return "png";
  }

  if (provider === "noto") {
    if (format === "svg" || stagedPath.includes("/svg/")) {
      return "svg";
    }
    const sizeMatch = stagedPath.match(/\/png\/(\d+)\//);
    if (sizeMatch) {
      return `png-${sizeMatch[1]}`;
    }
    return "png";
  }

  if (provider === "fluent") {
    if (variant) {
      return variant.toLowerCase();
    }

    if (stagedPath.includes("/3D/")) {
      return "3d";
    }
    if (stagedPath.includes("/Color/")) {
      return "color";
    }
    if (stagedPath.includes("/Flat/")) {
      return "flat";
    }
    if (stagedPath.includes("/High Contrast/")) {
      return "high-contrast";
    }
  }

  return format.toLowerCase() || "unknown";
}

export function buildArtworkId(provider: ArtworkProvider, sourceId: string): string {
  return `${provider}:${sourceId}`;
}

export function buildPublicPath(provider: ArtworkProvider, stagedPath: string): string {
  const relative = stagedPath.replace(/^artwork\/[^/]+\//, "");
  return `public/${provider}/${relative}`;
}

export function buildRawRecordRef(provider: string, sourceId: string): string {
  return `master/raw/raw-artwork-records.json#${provider}:${sourceId}`;
}
