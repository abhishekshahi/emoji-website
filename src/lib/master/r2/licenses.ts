import type { ArtworkProvider } from "@/lib/master/artwork/types";
import { canPublicServeArtworkProvider } from "@/lib/master/public/asset-rights";
import type { R2ProviderLicense } from "./types";

const PROVIDER_LICENSES: Record<
  ArtworkProvider,
  Omit<R2ProviderLicense, "provider" | "artworkCount">
> = {
  openmoji: {
    license: "CC BY-SA 4.0",
    licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
    attribution: "OpenMoji – the open-source emoji and icon project. License: CC BY-SA 4.0",
    sourceURL: "https://openmoji.org/",
    publiclyServed: true,
  },
  noto: {
    license: "Apache-2.0 / OFL",
    licenseURL: "https://github.com/googlefonts/noto-emoji/blob/main/svg/LICENSE",
    attribution: "Noto Emoji by Google LLC — Apache-2.0 (images) / OFL 1.1 (fonts)",
    sourceURL: "https://github.com/googlefonts/noto-emoji",
    publiclyServed: true,
  },
  twemoji: {
    license: "CC BY 4.0",
    licenseURL: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Copyright 2025 Twitter, Inc and other contributors",
    sourceURL: "https://github.com/jdecked/twemoji",
    publiclyServed: true,
  },
  fluent: {
    license: "MIT",
    licenseURL: "https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE",
    attribution: "Fluent Emoji by Microsoft Corporation. License: MIT",
    sourceURL: "https://github.com/microsoft/fluentui-emoji",
    publiclyServed: true,
  },
};

export function getProviderLicense(
  provider: ArtworkProvider,
  artworkCount = 0,
): R2ProviderLicense {
  return {
    provider,
    artworkCount,
    ...PROVIDER_LICENSES[provider],
  };
}

export function isProviderPubliclyServed(provider: ArtworkProvider): boolean {
  return canPublicServeArtworkProvider(provider);
}

export function getAllowedArtworkProviders(): readonly ArtworkProvider[] {
  return ["openmoji", "noto", "twemoji", "fluent"];
}

export function contentTypeForFormat(format: string): string {
  const lower = format.toLowerCase();
  if (lower === "svg") return "image/svg+xml";
  if (lower === "png") return "image/png";
  return "application/octet-stream";
}
