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
    licenseURL: "https://scripts.sil.org/OFL",
    copyright: "Google LLC",
    attributionRequired: true,
    publicServingAllowed: false,
    publicDownloadAllowed: false,
    commercialUseAllowed: "conditional",
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/googlefonts/noto-emoji",
    verificationStatus: "partial",
    verificationDate: "2026-08-09",
    notes: "Font assets require OFL compliance. Not automatically interchangeable with image redistribution.",
  },
  {
    provider: "Noto Emoji",
    assetType: "emoji image resources",
    license: "Apache License 2.0",
    licenseURL: "https://www.apache.org/licenses/LICENSE-2.0",
    copyright: "Google LLC",
    attributionRequired: true,
    publicServingAllowed: false,
    publicDownloadAllowed: false,
    commercialUseAllowed: true,
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/googlefonts/noto-emoji",
    verificationStatus: "partial",
    verificationDate: "2026-08-09",
    notes: "Most image resources are Apache-2.0. Flag assets may have separate/public-domain treatment — per-asset audit required.",
  },
  {
    provider: "Fluent Emoji",
    assetType: "emoji graphics (PNG)",
    license: "MIT (repository)",
    licenseURL: "https://opensource.org/licenses/MIT",
    copyright: "Microsoft Corporation",
    attributionRequired: true,
    publicServingAllowed: false,
    publicDownloadAllowed: false,
    commercialUseAllowed: "conditional",
    modificationAllowed: true,
    shareAlikeRequired: false,
    sourceURL: "https://github.com/microsoft/fluentui-emoji",
    verificationStatus: "unverified",
    verificationDate: "2026-08-09",
    notes: "Repository is MIT-licensed; asset scope and notices require per-asset verification before public redistribution.",
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
    publicServingAllowed: true,
    publicDownloadAllowed: false,
    commercialUseAllowed: false,
    modificationAllowed: true,
    shareAlikeRequired: true,
    sourceURL: "https://emojinet.knoesis.org/",
    verificationStatus: "restricted",
    verificationDate: "2026-08-09",
    notes: "Non-commercial restriction applies. Definitions shown on-page with attribution; bulk redistribution not permitted.",
  },
] as const;

const ARTWORK_PROVIDER_POLICY: Record<
  ArtworkProvider,
  { publicServingAllowed: boolean; publicDownloadAllowed: boolean }
> = {
  openmoji: { publicServingAllowed: true, publicDownloadAllowed: true },
  twemoji: { publicServingAllowed: true, publicDownloadAllowed: true },
  noto: { publicServingAllowed: false, publicDownloadAllowed: false },
  fluent: { publicServingAllowed: false, publicDownloadAllowed: false },
};

export function getArtworkProviderPolicy(provider: ArtworkProvider): {
  publicServingAllowed: boolean;
  publicDownloadAllowed: boolean;
} {
  return ARTWORK_PROVIDER_POLICY[provider];
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
