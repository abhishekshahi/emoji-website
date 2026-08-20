import type { ArtworkProvider } from "@/lib/master/artwork/types";
import artworkLicenseIndex from "@/data/master/artwork/artwork-license-index.json";
import {
  LICENSE_REGISTRY,
  type LicenseRegistryEntry,
  type LicenseVerificationStatus,
} from "./license-registry";

/** Registry verification statuses (normalized uppercase). */
export type AssetVerificationStatus =
  | "VERIFIED"
  | "PENDING"
  | "PARTIAL"
  | "RESTRICTED"
  | "REJECTED";

export interface AssetRightsRecord {
  readonly assetId: string;
  readonly provider: string;
  readonly providerVersion: string | null;
  readonly assetType: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly sourceUrl: string;
  readonly copyrightHolder: string;
  readonly attributionText: string;
  readonly commercialUseAllowed: boolean | "conditional";
  readonly publicServeAllowed: boolean;
  readonly downloadAllowed: boolean;
  readonly modificationAllowed: boolean | "conditional";
  readonly shareAlikeRequired: boolean;
  readonly verificationStatus: AssetVerificationStatus;
  readonly verificationMethod: string;
  readonly verifiedAt: string;
  readonly verificationNotes: string;
  readonly artworkCount: number | null;
}

export interface RightsDashboardStats {
  readonly providers: readonly {
    readonly provider: string;
    readonly assetCount: number;
    readonly verified: number;
    readonly pending: number;
    readonly partial: number;
    readonly restricted: number;
    readonly rejected: number;
    readonly publicServe: number;
    readonly downloadable: number;
    readonly lastVerificationDate: string;
  }[];
  readonly totals: {
    readonly registryEntries: number;
    readonly verified: number;
    readonly pending: number;
    readonly partial: number;
    readonly restricted: number;
    readonly rejected: number;
    readonly publicServe: number;
    readonly downloadable: number;
    readonly artworkRecordsIndexed: number;
  };
}

export interface AttributionBlock {
  readonly provider: string;
  readonly license: string;
  readonly licenseUrl: string;
  readonly attributionText: string;
  readonly sourceUrl: string;
  readonly category: "artwork" | "unicode" | "metadata" | "restricted";
}

const RESTRICTED_SOURCE_KEYS = new Set(["emojinet", "emojinet"]);

export function normalizeSourceKey(source: string): string {
  return source.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isRestrictedMetadataSource(source: string): boolean {
  return RESTRICTED_SOURCE_KEYS.has(normalizeSourceKey(source));
}

export function isRestrictedProvider(provider: string): boolean {
  return RESTRICTED_SOURCE_KEYS.has(normalizeSourceKey(provider));
}

export function mapVerificationStatus(status: LicenseVerificationStatus): AssetVerificationStatus {
  switch (status) {
    case "verified":
      return "VERIFIED";
    case "partial":
      return "PARTIAL";
    case "unverified":
      return "PENDING";
    case "restricted":
      return "RESTRICTED";
    default:
      return "PENDING";
  }
}

export function registryEntryToRightsRecord(
  entry: LicenseRegistryEntry,
  artworkCount: number | null = null,
): AssetRightsRecord {
  const restricted = isRestrictedProvider(entry.provider);
  const status = restricted ? "RESTRICTED" : mapVerificationStatus(entry.verificationStatus);
  const publicServe =
    !restricted &&
    status === "VERIFIED" &&
    entry.publicServingAllowed;
  const download =
    !restricted &&
    status === "VERIFIED" &&
    entry.publicDownloadAllowed;

  return Object.freeze({
    assetId: `${entry.provider}:${entry.assetType}`,
    provider: entry.provider,
    providerVersion: null,
    assetType: entry.assetType,
    license: entry.license,
    licenseUrl: entry.licenseURL,
    sourceUrl: entry.sourceURL,
    copyrightHolder: entry.copyright,
    attributionText: buildAttributionText(entry),
    commercialUseAllowed: entry.commercialUseAllowed,
    publicServeAllowed: publicServe,
    downloadAllowed: download,
    modificationAllowed: entry.modificationAllowed,
    shareAlikeRequired: entry.shareAlikeRequired,
    verificationStatus: status,
    verificationMethod: "license-registry-audit",
    verifiedAt: entry.verificationDate,
    verificationNotes: entry.notes,
    artworkCount,
  });
}

function buildAttributionText(entry: LicenseRegistryEntry): string {
  if (entry.provider === "OpenMoji") {
    return "OpenMoji – the open-source emoji and icon project. License: CC BY-SA 4.0";
  }
  if (entry.provider === "Twemoji") {
    return "Copyright Twitter, Inc and other contributors. License: CC BY 4.0";
  }
  if (entry.provider === "Noto Emoji" && entry.assetType.includes("font")) {
    return "Noto Emoji fonts by Google LLC. License: SIL Open Font License 1.1 (see fonts/LICENSE).";
  }
  if (entry.provider === "Noto Emoji" && entry.assetType.includes("image")) {
    return "Noto Emoji image/SVG resources by Google LLC. License: Apache License 2.0 (see svg/LICENSE).";
  }
  if (entry.provider === "Fluent Emoji") {
    return "Fluent Emoji by Microsoft Corporation. License: MIT (see repository LICENSE).";
  }
  if (entry.attributionRequired) {
    return `${entry.copyright}. License: ${entry.license}`;
  }
  return entry.copyright;
}

/** Central public-serve gate — frontend must not bypass this. */
export function canPublicServeRegistryEntry(entry: LicenseRegistryEntry): boolean {
  if (isRestrictedProvider(entry.provider)) return false;
  return mapVerificationStatus(entry.verificationStatus) === "VERIFIED" && entry.publicServingAllowed;
}

/** Central download gate. */
export function canDownloadRegistryEntry(entry: LicenseRegistryEntry): boolean {
  if (isRestrictedProvider(entry.provider)) return false;
  return mapVerificationStatus(entry.verificationStatus) === "VERIFIED" && entry.publicDownloadAllowed;
}

const ARTWORK_PROVIDER_MAP: Record<ArtworkProvider, string> = {
  openmoji: "OpenMoji",
  twemoji: "Twemoji",
  noto: "Noto Emoji",
  fluent: "Fluent Emoji",
};

export function canPublicServeArtworkProvider(provider: ArtworkProvider): boolean {
  const label = ARTWORK_PROVIDER_MAP[provider];
  const entries = LICENSE_REGISTRY.filter((e) => e.provider === label);
  if (!entries.length) return false;
  return entries.some((e) => canPublicServeRegistryEntry(e));
}

export function canDownloadArtworkProvider(provider: ArtworkProvider): boolean {
  const label = ARTWORK_PROVIDER_MAP[provider];
  const entries = LICENSE_REGISTRY.filter((e) => e.provider === label);
  if (!entries.length) return false;
  return entries.some((e) => canDownloadRegistryEntry(e));
}

export function filterPublicDefinitions<T extends { text: string; source: string }>(
  definitions: readonly T[],
): readonly T[] {
  return Object.freeze(definitions.filter((d) => !isRestrictedMetadataSource(d.source)));
}

export function filterPublicMetadataSource(source: string): boolean {
  return !isRestrictedMetadataSource(source);
}

export function sanitizePublicProvenanceSource(source: string): string {
  return isRestrictedMetadataSource(source) ? "restricted-source" : source;
}

export function getAssetRightsRegistry(): readonly AssetRightsRecord[] {
  const artworkCounts = new Map<string, number>();
  for (const row of artworkLicenseIndex) {
    const label =
      row.provider === "openmoji"
        ? "OpenMoji"
        : row.provider === "twemoji"
          ? "Twemoji"
          : row.provider === "noto"
            ? "Noto Emoji"
            : row.provider === "fluent"
              ? "Fluent Emoji"
              : row.provider;
    artworkCounts.set(label, (artworkCounts.get(label) ?? 0) + row.artworkCount);
  }

  return Object.freeze(
    LICENSE_REGISTRY.map((entry) =>
      registryEntryToRightsRecord(entry, artworkCounts.get(entry.provider) ?? null),
    ),
  );
}

function categoryForProvider(provider: string): AttributionBlock["category"] {
  if (isRestrictedProvider(provider)) return "restricted";
  if (
    provider === "Unicode" ||
    provider === "CLDR"
  ) {
    return "unicode";
  }
  if (
    provider === "Emojibase" ||
    provider === "Emojilib" ||
    provider === "EmojiNet"
  ) {
    return "metadata";
  }
  return "artwork";
}

export function getAttributionBlocks(): readonly AttributionBlock[] {
  return Object.freeze(
    LICENSE_REGISTRY.map((entry) =>
      Object.freeze({
        provider: entry.provider,
        license: entry.license,
        licenseUrl: entry.licenseURL,
        attributionText: buildAttributionText(entry),
        sourceUrl: entry.sourceURL,
        category: categoryForProvider(entry.provider),
      }),
    ),
  );
}

export function getRightsDashboardStats(): RightsDashboardStats {
  const registry = getAssetRightsRegistry();
  const providerMap = new Map<string, RightsDashboardStats["providers"][number]>();

  for (const record of registry) {
    const bucket =
      providerMap.get(record.provider) ??
      Object.freeze({
        provider: record.provider,
        assetCount: 0,
        verified: 0,
        pending: 0,
        partial: 0,
        restricted: 0,
        rejected: 0,
        publicServe: 0,
        downloadable: 0,
        lastVerificationDate: record.verifiedAt,
      });

    const next = {
      ...bucket,
      assetCount: bucket.assetCount + (record.artworkCount ?? 0),
      verified: bucket.verified + (record.verificationStatus === "VERIFIED" ? 1 : 0),
      pending: bucket.pending + (record.verificationStatus === "PENDING" ? 1 : 0),
      partial: bucket.partial + (record.verificationStatus === "PARTIAL" ? 1 : 0),
      restricted: bucket.restricted + (record.verificationStatus === "RESTRICTED" ? 1 : 0),
      rejected: bucket.rejected + (record.verificationStatus === "REJECTED" ? 1 : 0),
      publicServe: bucket.publicServe + (record.publicServeAllowed ? 1 : 0),
      downloadable: bucket.downloadable + (record.downloadAllowed ? 1 : 0),
      lastVerificationDate:
        record.verifiedAt > bucket.lastVerificationDate ? record.verifiedAt : bucket.lastVerificationDate,
    };
    providerMap.set(record.provider, Object.freeze(next));
  }

  const providers = Object.freeze([...providerMap.values()]);
  const totals = Object.freeze({
    registryEntries: registry.length,
    verified: registry.filter((r) => r.verificationStatus === "VERIFIED").length,
    pending: registry.filter((r) => r.verificationStatus === "PENDING").length,
    partial: registry.filter((r) => r.verificationStatus === "PARTIAL").length,
    restricted: registry.filter((r) => r.verificationStatus === "RESTRICTED").length,
    rejected: registry.filter((r) => r.verificationStatus === "REJECTED").length,
    publicServe: registry.filter((r) => r.publicServeAllowed).length,
    downloadable: registry.filter((r) => r.downloadAllowed).length,
    artworkRecordsIndexed: artworkLicenseIndex.reduce((sum, row) => sum + row.artworkCount, 0),
  });

  return Object.freeze({ providers, totals });
}
