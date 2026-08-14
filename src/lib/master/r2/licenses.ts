import type { ArtworkProvider } from "@/lib/master/artwork/types";
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
    license: "Apache-2.0",
    licenseURL: "https://www.apache.org/licenses/LICENSE-2.0",
    attribution: "Google Noto Emoji project",
    sourceURL: "https://github.com/googlefonts/noto-emoji",
    publiclyServed: false,
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
    licenseURL: "https://opensource.org/licenses/MIT",
    attribution: "Microsoft Corporation",
    sourceURL: "https://github.com/microsoft/fluentui-emoji",
    publiclyServed: false,
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
  return PROVIDER_LICENSES[provider].publiclyServed;
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
