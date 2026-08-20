import type { ArtworkProvider } from "@/lib/master/canonical/types";

export type LicenseVerificationStatus = "verified" | "partial" | "unverified" | "restricted";

export interface LicenseRegistryEntry {
  readonly provider: string;
  readonly assetType: string;
  readonly license: string;
  readonly licenseURL: string;
  readonly copyright: string;
  readonly attributionRequired: boolean;
  readonly publicServingAllowed: boolean;
  readonly publicDownloadAllowed: boolean;
  readonly commercialUseAllowed: boolean | "conditional";
  readonly modificationAllowed: boolean | "conditional";
  readonly shareAlikeRequired: boolean;
  readonly sourceURL: string;
  readonly verificationStatus: LicenseVerificationStatus;
  readonly verificationDate: string;
  readonly notes: string;
}

export const LICENSE_REGISTRY: readonly LicenseRegistryEntry[] = [
  {
    provider: "OpenMoji",
    assetType: "emoji graphics (SVG/PNG)",
    license: "CC BY-SA 4.0",
    licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
    copyright: "OpenMoji Project",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: true,
    sourceURL: "https://openmoji.org/",
    verificationStatus: "verified",
    verificationDate: "2026-08-09",
    notes: "Official OpenMoji graphics license. Attribution and ShareAlike required.",
  },
  {
    provider: "OpenMoji Extras",
    assetType: "supplemental graphics (SVG/PNG)",
    license: "CC BY-SA 4.0",
    licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
    copyright: "OpenMoji Project and individual authors",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: true,
    sourceURL: "https://openmoji.org/",
    verificationStatus: "verified",
    verificationDate: "2026-08-09",
    notes: "OpenMoji Extras beyond standard Unicode set. Per-design author attribution on detail pages where required.",
  },
  {
    provider: "Twemoji",
    assetType: "emoji graphics (SVG/PNG)",
    license: "CC BY 4.0",
    licenseURL: "https://creativecommons.org/licenses/by/4.0/",
    copyright: "Copyright Twitter, Inc and other contributors",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/jdecked/twemoji",
    verificationStatus: "verified",
    verificationDate: "2026-08-09",
    notes: "Graphics license per official Twemoji repository. Code license is separate.",
  },
  {
    provider: "Noto Emoji",
    assetType: "emoji fonts",
    license: "SIL Open Font License 1.1",
    licenseURL: "https://github.com/googlefonts/noto-emoji/blob/main/fonts/LICENSE",
    copyright: "Google LLC",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/googlefonts/noto-emoji",
    verificationStatus: "verified",
    verificationDate: "2026-08-16",
    notes:
      "Noto Emoji fonts under SIL OFL 1.1. Public serve/download permitted with OFL attribution and license preservation requirements.",
  },
  {
    provider: "Noto Emoji",
    assetType: "emoji image resources (SVG/PNG)",
    license: "Apache License 2.0",
    licenseURL: "https://github.com/googlefonts/noto-emoji/blob/main/svg/LICENSE",
    copyright: "Google LLC",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/googlefonts/noto-emoji",
    verificationStatus: "verified",
    verificationDate: "2026-08-16",
    notes:
      "Noto SVG/image resources under Apache-2.0 per official svg/LICENSE. Distinct from OFL-licensed font binaries.",
  },
  {
    provider: "Fluent Emoji",
    assetType: "emoji graphics (PNG)",
    license: "MIT License",
    licenseURL: "https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE",
    copyright: "Microsoft Corporation",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/microsoft/fluentui-emoji",
    verificationStatus: "verified",
    verificationDate: "2026-08-16",
    notes:
      "Fluent Emoji repository MIT license verified. Preserve Microsoft copyright and LICENSE notice on redistribution.",
  },
  {
    provider: "Unicode",
    assetType: "emoji character data",
    license: "Unicode Terms of Use",
    licenseURL: "https://www.unicode.org/copyright.html",
    copyright: "Unicode, Inc.",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: false,
    shareAlikeRequired: false,
    sourceURL: "https://www.unicode.org/emoji/",
    verificationStatus: "verified",
    verificationDate: "2026-08-09",
    notes: "Unicode data is not artwork. Use according to Unicode Terms of Use.",
  },
  {
    provider: "CLDR",
    assetType: "annotations and locale data",
    license: "Unicode Terms of Use",
    licenseURL: "https://www.unicode.org/copyright.html",
    copyright: "Unicode, Inc.",
    attributionRequired: true,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: false,
    shareAlikeRequired: false,
    sourceURL: "https://cldr.unicode.org/",
    verificationStatus: "verified",
    verificationDate: "2026-08-09",
    notes: "CLDR rights are separate from artwork rights.",
  },
  {
    provider: "Emojibase",
    assetType: "metadata annotations",
    license: "MIT",
    licenseURL: "https://opensource.org/licenses/MIT",
    copyright: "Emojibase contributors",
    attributionRequired: false,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/milesj/emojibase",
    verificationStatus: "verified",
    verificationDate: "2026-08-09",
    notes: "Metadata annotations used with provenance.",
  },
  {
    provider: "Emojilib",
    assetType: "keywords",
    license: "MIT",
    licenseURL: "https://opensource.org/licenses/MIT",
    copyright: "Emojilib contributors",
    attributionRequired: false,
    publicServingAllowed: true,
    publicDownloadAllowed: true,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/muan/emojilib",
    verificationStatus: "verified",
    verificationDate: "2026-08-09",
    notes: "Keyword data with source attribution.",
  },
  {
    provider: "EmojiNet",
    assetType: "definitions and senses",
    license: "CC BY-NC-SA 4.0",
    licenseURL: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
    copyright: "EmojiNet contributors",
    attributionRequired: true,
    publicServingAllowed: false,
    publicDownloadAllowed: false,
    commercialUseAllowed: false,
    modificationAllowed: true,
    shareAlikeRequired: true,
    sourceURL: "https://emojinet.knoesis.org/",
    verificationStatus: "restricted",
    verificationDate: "2026-08-09",
    notes:
      "RESTRICTED: CC BY-NC-SA 4.0 non-commercial. EmojiNet definitions and senses are indexed privately and are NOT publicly served, downloaded, or indexed on EmojiQuick.",
  },
] as const;

const ARTWORK_PROVIDER_LABELS: Record<ArtworkProvider, string> = {
  openmoji: "OpenMoji",
  twemoji: "Twemoji",
  noto: "Noto Emoji",
  fluent: "Fluent Emoji",
};

export function getArtworkProviderPolicy(provider: ArtworkProvider): {
  publicServingAllowed: boolean;
  publicDownloadAllowed: boolean;
} {
  const label = ARTWORK_PROVIDER_LABELS[provider];
  const entries = LICENSE_REGISTRY.filter((entry) => entry.provider === label);
  return {
    publicServingAllowed: entries.some(
      (entry) => entry.verificationStatus === "verified" && entry.publicServingAllowed,
    ),
    publicDownloadAllowed: entries.some(
      (entry) => entry.verificationStatus === "verified" && entry.publicDownloadAllowed,
    ),
  };
}

export function getLicenseEntriesForProvider(provider: string): readonly LicenseRegistryEntry[] {
  return LICENSE_REGISTRY.filter((entry) => entry.provider.toLowerCase().includes(provider.toLowerCase()));
}

export function getLicenseRegistrySummary(): {
  totalEntries: number;
  verified: number;
  partial: number;
  unverified: number;
  restricted: number;
} {
  let verified = 0;
  let partial = 0;
  let unverified = 0;
  let restricted = 0;
  for (const entry of LICENSE_REGISTRY) {
    if (entry.verificationStatus === "verified") verified += 1;
    if (entry.verificationStatus === "partial") partial += 1;
    if (entry.verificationStatus === "unverified") unverified += 1;
    if (entry.verificationStatus === "restricted") restricted += 1;
  }
  return { totalEntries: LICENSE_REGISTRY.length, verified, partial, unverified, restricted };
}
