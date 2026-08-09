import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  ArtworkAttributionEntry,
  ArtworkChecksumEntry,
  ArtworkCoverageEntry,
  ArtworkIntegrityReport,
  ArtworkLicenseProviderEntry,
  ArtworkMasterRecord,
  ArtworkProvider,
  ArtworkStatus,
  CanonicalArtworkIndexEntry,
  CanonicalArtworkProviderRefs,
} from "./types";
import {
  buildArtworkId,
  buildPublicPath,
  buildRawRecordRef,
  isUtilityArtwork,
  normalizeArtworkVariant,
} from "./variants";

export type { ArtworkProvider } from "./types";

const ARTWORK_PROVIDERS: ArtworkProvider[] = ["openmoji", "noto", "twemoji", "fluent"];

export interface RawArtworkRecord {
  source: string;
  sourceVersion: string;
  sourceId: string;
  stagedPath: string;
  originalPath: string;
  format: string;
  variant: string | null;
  rawLicense: string;
  sourceURL: string;
  checksum: string | null;
}

export interface ArtworkIdentityMapping {
  provider: string;
  sourceId: string;
  canonicalIdentity: string;
  path: string;
  checksum: string | null;
  version: string;
  license: string;
  identityCategory: string;
  mappingMethod: string;
}

export interface ProviderLicenseInfo {
  license: string;
  licenseURL: string;
  attribution: string;
  sourceURL: string;
  copyright: string | null;
  sourceVersion: string;
}

export interface BuildArtworkDatabaseInput {
  rawArtworkRecords: RawArtworkRecord[];
  artworkIdentityIndex: ArtworkIdentityMapping[];
  canonicalIds: string[];
  rawArtworkRoot: string;
  providerLicenses: Record<ArtworkProvider, ProviderLicenseInfo>;
}

export interface BuildArtworkDatabaseResult {
  artworkMasterIndex: ArtworkMasterRecord[];
  artworkChecksums: ArtworkChecksumEntry[];
  canonicalArtworkIndex: CanonicalArtworkIndexEntry[];
  artworkCoverageReport: ArtworkCoverageEntry[];
  artworkLicenseIndex: ArtworkLicenseProviderEntry[];
  artworkAttributionIndex: ArtworkAttributionEntry[];
  integrityReport: ArtworkIntegrityReport;
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function emptyProviderRefs(): CanonicalArtworkProviderRefs {
  return {
    openmoji: [],
    noto: [],
    twemoji: [],
    fluent: [],
  };
}

function artworkStatus(
  canonicalId: string,
  sourceId: string,
  stagedPath: string,
): ArtworkStatus {
  if (isUtilityArtwork(sourceId, stagedPath)) {
    return "utility-support";
  }

  if (canonicalId.startsWith("source:")) {
    return "source-specific";
  }

  return "active";
}

export function buildArtworkDatabase(input: BuildArtworkDatabaseInput): BuildArtworkDatabaseResult {
  const identityBySourceId = new Map<string, ArtworkIdentityMapping>();
  for (const mapping of input.artworkIdentityIndex) {
    identityBySourceId.set(`${mapping.provider}:${mapping.sourceId}`, mapping);
  }

  const artworkMasterIndex: ArtworkMasterRecord[] = [];
  const checksumEntries: ArtworkChecksumEntry[] = [];
  let missingFiles = 0;
  let checksumFailures = 0;
  let checksumVerified = 0;

  for (const record of input.rawArtworkRecords) {
    const provider = record.source as ArtworkProvider;
    if (!ARTWORK_PROVIDERS.includes(provider)) {
      continue;
    }

    const identity = identityBySourceId.get(`${provider}:${record.sourceId}`);
    const canonicalId = identity?.canonicalIdentity ?? `source:${provider}:${record.sourceId}`;
    const absolutePath = join(input.rawArtworkRoot, record.stagedPath);
    const fileExists = existsSync(absolutePath);
    if (!fileExists) {
      missingFiles += 1;
    }

    let checksum = record.checksum ?? "";
    let checksumIsVerified = false;
    if (fileExists) {
      const computed = sha256File(absolutePath);
      if (record.checksum) {
        checksumIsVerified = computed === record.checksum;
        if (!checksumIsVerified) {
          checksumFailures += 1;
        } else {
          checksumVerified += 1;
        }
        checksum = record.checksum;
      } else {
        checksum = computed;
        checksumIsVerified = true;
        checksumVerified += 1;
      }
    }

    const licenseInfo = input.providerLicenses[provider];
    const artworkId = buildArtworkId(provider, record.sourceId);
    const status = artworkStatus(canonicalId, record.sourceId, record.stagedPath);

    artworkMasterIndex.push({
      artworkId,
      provider,
      sourceVersion: record.sourceVersion,
      sourceId: record.sourceId,
      canonicalId,
      filePath: record.stagedPath,
      publicPath: buildPublicPath(provider, record.stagedPath),
      format: record.format.toLowerCase(),
      checksum,
      checksumVerified: checksumIsVerified,
      license: record.rawLicense || licenseInfo.license,
      licenseURL: licenseInfo.licenseURL,
      attribution: licenseInfo.attribution,
      artworkVariant: normalizeArtworkVariant(provider, record.format, record.variant, record.stagedPath),
      isUnicode: canonicalId.startsWith("unicode:"),
      status,
      duplicateBinary: false,
      duplicateBinaryGroupId: null,
      rawRecordRef: buildRawRecordRef(provider, record.sourceId),
    });

    checksumEntries.push({
      artworkId,
      checksum,
      checksumVerified: checksumIsVerified,
      filePath: record.stagedPath,
      duplicateBinary: false,
      duplicateBinaryGroupId: null,
      duplicateArtworkIds: [],
    });
  }

  const checksumGroups = new Map<string, string[]>();
  for (const entry of checksumEntries) {
    if (!entry.checksum) {
      continue;
    }
    const group = checksumGroups.get(entry.checksum) ?? [];
    group.push(entry.artworkId);
    checksumGroups.set(entry.checksum, group);
  }

  let duplicateBinaryRecords = 0;
  for (const [checksum, artworkIds] of checksumGroups.entries()) {
    if (artworkIds.length <= 1) {
      continue;
    }

    duplicateBinaryRecords += artworkIds.length;
    const groupId = `sha256:${checksum}`;
    for (const artworkId of artworkIds) {
      const master = artworkMasterIndex.find((record) => record.artworkId === artworkId);
      const checksumEntry = checksumEntries.find((entry) => entry.artworkId === artworkId);
      if (master) {
        master.duplicateBinary = true;
        master.duplicateBinaryGroupId = groupId;
      }
      if (checksumEntry) {
        checksumEntry.duplicateBinary = true;
        checksumEntry.duplicateBinaryGroupId = groupId;
        checksumEntry.duplicateArtworkIds = artworkIds.filter((id) => id !== artworkId);
      }
    }
  }

  const canonicalArtworkMap = new Map<string, CanonicalArtworkIndexEntry>();
  for (const canonicalId of input.canonicalIds) {
    canonicalArtworkMap.set(canonicalId, {
      canonicalId,
      isUnicode: canonicalId.startsWith("unicode:"),
      artwork: emptyProviderRefs(),
    });
  }

  for (const record of artworkMasterIndex) {
    if (record.status === "utility-support") {
      continue;
    }

    if (!canonicalArtworkMap.has(record.canonicalId)) {
      canonicalArtworkMap.set(record.canonicalId, {
        canonicalId: record.canonicalId,
        isUnicode: record.canonicalId.startsWith("unicode:"),
        artwork: emptyProviderRefs(),
      });
    }

    canonicalArtworkMap.get(record.canonicalId)!.artwork[record.provider].push(record.artworkId);
  }

  for (const entry of canonicalArtworkMap.values()) {
    for (const provider of ARTWORK_PROVIDERS) {
      entry.artwork[provider].sort();
    }
  }

  const canonicalArtworkIndex = [...canonicalArtworkMap.values()].sort((left, right) =>
    left.canonicalId.localeCompare(right.canonicalId),
  );

  const artworkCoverageReport: ArtworkCoverageEntry[] = input.canonicalIds
    .map((canonicalId) => {
      const entry = canonicalArtworkMap.get(canonicalId);
      return {
        canonicalId,
        openmoji: (entry?.artwork.openmoji.length ?? 0) > 0,
        noto: (entry?.artwork.noto.length ?? 0) > 0,
        twemoji: (entry?.artwork.twemoji.length ?? 0) > 0,
        fluent: (entry?.artwork.fluent.length ?? 0) > 0,
      };
    })
    .sort((left, right) => left.canonicalId.localeCompare(right.canonicalId));

  const providerCounts = Object.fromEntries(ARTWORK_PROVIDERS.map((provider) => [provider, 0])) as Record<
    ArtworkProvider,
    number
  >;
  const formatCounts: Record<string, number> = {};
  const variantCounts: Record<string, number> = {};
  const classificationCounts = {
    unicodeLinked: 0,
    sourceSpecific: 0,
    artworkOnly: 0,
    utilitySupport: 0,
  };

  for (const record of artworkMasterIndex) {
    providerCounts[record.provider] += 1;
    formatCounts[record.format] = (formatCounts[record.format] ?? 0) + 1;
    const variantKey = `${record.provider}:${record.artworkVariant}`;
    variantCounts[variantKey] = (variantCounts[variantKey] ?? 0) + 1;

    if (record.status === "utility-support") {
      classificationCounts.utilitySupport += 1;
    } else if (record.isUnicode) {
      classificationCounts.unicodeLinked += 1;
    } else if (record.status === "source-specific") {
      classificationCounts.sourceSpecific += 1;
    } else {
      classificationCounts.artworkOnly += 1;
    }
  }

  const pathSet = new Set<string>();
  let pathCollisions = 0;
  for (const record of artworkMasterIndex) {
    if (pathSet.has(record.filePath)) {
      pathCollisions += 1;
    }
    pathSet.add(record.filePath);
  }

  let withOpenmoji = 0;
  let withNoto = 0;
  let withTwemoji = 0;
  let withFluent = 0;
  let withTwoOrMoreProviders = 0;
  let withOneProvider = 0;
  let withNoArtwork = 0;

  for (const entry of artworkCoverageReport) {
    const providers = [entry.openmoji, entry.noto, entry.twemoji, entry.fluent];
    const count = providers.filter(Boolean).length;
    if (entry.openmoji) withOpenmoji += 1;
    if (entry.noto) withNoto += 1;
    if (entry.twemoji) withTwemoji += 1;
    if (entry.fluent) withFluent += 1;
    if (count >= 2) withTwoOrMoreProviders += 1;
    else if (count === 1) withOneProvider += 1;
    else withNoArtwork += 1;
  }

  const artworkLicenseIndex: ArtworkLicenseProviderEntry[] = ARTWORK_PROVIDERS.map((provider) => ({
    provider,
    license: input.providerLicenses[provider].license,
    licenseURL: input.providerLicenses[provider].licenseURL,
    attribution: input.providerLicenses[provider].attribution,
    sourceURL: input.providerLicenses[provider].sourceURL,
    sourceVersion: input.providerLicenses[provider].sourceVersion,
    artworkCount: providerCounts[provider],
  }));

  const artworkAttributionIndex: ArtworkAttributionEntry[] = ARTWORK_PROVIDERS.map((provider) => ({
    provider,
    attribution: input.providerLicenses[provider].attribution,
    license: input.providerLicenses[provider].license,
    licenseURL: input.providerLicenses[provider].licenseURL,
    sourceURL: input.providerLicenses[provider].sourceURL,
    copyright: input.providerLicenses[provider].copyright,
  }));

  const integrityReport: ArtworkIntegrityReport = {
    generatedAt: new Date().toISOString(),
    phase: "8.5",
    totals: {
      rawArtworkRecords: input.rawArtworkRecords.length,
      artworkMasterRecords: artworkMasterIndex.length,
      utilitySupportExcludedFromCanonical: artworkMasterIndex.filter(
        (record) => record.status === "utility-support",
      ).length,
      missingFiles,
      checksumFailures,
      checksumVerified,
      duplicateBinaryGroups: [...checksumGroups.values()].filter((group) => group.length > 1).length,
      duplicateBinaryRecords,
      pathCollisions,
    },
    providerCounts,
    formatCounts,
    variantCounts,
    classificationCounts,
    canonicalCoverage: {
      totalCanonicalIdentities: input.canonicalIds.length,
      withOpenmoji,
      withNoto,
      withTwemoji,
      withFluent,
      withTwoOrMoreProviders,
      withOneProvider,
      withNoArtwork,
    },
    constraints: {
      rawArtworkUnchanged: true,
      noArtworkDeleted: true,
      productionDataUnchanged: true,
      canonicalIdentitiesUnmodified: true,
    },
  };

  artworkMasterIndex.sort((left, right) => left.artworkId.localeCompare(right.artworkId));
  checksumEntries.sort((left, right) => left.artworkId.localeCompare(right.artworkId));

  return {
    artworkMasterIndex,
    artworkChecksums: checksumEntries,
    canonicalArtworkIndex,
    artworkCoverageReport,
    artworkLicenseIndex,
    artworkAttributionIndex,
    integrityReport,
  };
}

export function getFireArtworkRecords(records: ArtworkMasterRecord[]): ArtworkMasterRecord[] {
  return records.filter((record) => record.canonicalId === "unicode:1F525");
}
