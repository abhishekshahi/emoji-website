import { isUtilityArtwork } from "@/lib/master/artwork/variants";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import type { RawMetadataIndexRecord, CanonicalMetadataIndexEntry } from "@/lib/master/metadata/types";
import type { CanonicalNameRecord, CanonicalSearchIndexEntry, CanonicalSeoRecord } from "@/lib/master/reconciliation/types";
import type { CanonicalSemanticIndexEntry, SemanticSearchTermEntry } from "@/lib/master/semantic/types";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry, MasterReleaseManifest } from "@/lib/master/release/types";
import {
  EXPECTED_RELEASE_ID,
  EXPECTED_RELEASE_PHASE,
  EXPECTED_RELEASE_STATUS,
  integrationDataPaths,
} from "./config";
import type {
  MasterArtworkEntry,
  MasterArtworkLookup,
  MasterDataCache,
  ReleaseVerificationResult,
} from "./types";
import { MasterIntegrationError } from "./types";

let cachedReader: MasterDataCache | null = null;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  Object.freeze(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      deepFreeze(item);
    }
  } else {
    for (const key of Object.keys(value)) {
      const nested = (value as Record<string, unknown>)[key];
      if (typeof nested === "object" && nested !== null && !Object.isFrozen(nested)) {
        deepFreeze(nested);
      }
    }
  }

  return value;
}

function toArtworkFormat(format: string): "svg" | "png" {
  return format.toLowerCase() === "png" ? "png" : "svg";
}

function isExposableArtworkRecord(record: ArtworkMasterRecord): boolean {
  if (record.status === "utility-support") {
    return false;
  }
  if (record.canonicalId === "source:noto:noto.png:noto.png") {
    return false;
  }
  if (isUtilityArtwork(record.sourceId, record.filePath)) {
    return false;
  }
  return true;
}

function buildArtworkLookup(
  canonicalArtworkIndex: Array<{
    canonicalId: string;
    artwork: { openmoji: string[]; noto: string[]; twemoji: string[]; fluent: string[] };
  }>,
  artworkById: Map<string, ArtworkMasterRecord>,
): Map<string, MasterArtworkLookup["providers"]> {
  const lookup = new Map<string, MasterArtworkLookup["providers"]>();

  for (const entry of canonicalArtworkIndex) {
    const providers = {
      openmoji: entry.artwork.openmoji
        .map((id) => artworkById.get(id))
        .filter((record): record is ArtworkMasterRecord => record !== undefined)
        .map(toMasterArtworkEntry)
        .filter((record): record is MasterArtworkEntry => record !== null),
      noto: entry.artwork.noto
        .map((id) => artworkById.get(id))
        .filter((record): record is ArtworkMasterRecord => record !== undefined)
        .map(toMasterArtworkEntry)
        .filter((record): record is MasterArtworkEntry => record !== null),
      twemoji: entry.artwork.twemoji
        .map((id) => artworkById.get(id))
        .filter((record): record is ArtworkMasterRecord => record !== undefined)
        .map(toMasterArtworkEntry)
        .filter((record): record is MasterArtworkEntry => record !== null),
      fluent: entry.artwork.fluent
        .map((id) => artworkById.get(id))
        .filter((record): record is ArtworkMasterRecord => record !== undefined)
        .map(toMasterArtworkEntry)
        .filter((record): record is MasterArtworkEntry => record !== null),
    };

    lookup.set(
      entry.canonicalId,
      deepFreeze({
        openmoji: providers.openmoji,
        noto: providers.noto,
        twemoji: providers.twemoji,
        fluent: providers.fluent,
      }),
    );
  }

  return lookup;
}

function toMasterArtworkEntry(record: ArtworkMasterRecord): MasterArtworkEntry | null {
  if (!isExposableArtworkRecord(record)) {
    return null;
  }

  return deepFreeze({
    provider: record.provider,
    artworkId: record.artworkId,
    canonicalId: record.canonicalId,
    sourceId: record.sourceId,
    path: record.publicPath,
    localPath: record.filePath,
    format: toArtworkFormat(record.format),
    variant: record.artworkVariant || null,
    license: record.license,
    licenseURL: record.licenseURL,
    attribution: record.attribution,
    checksum: record.checksum,
    checksumVerified: record.checksumVerified,
    duplicateBinary: record.duplicateBinary,
    duplicateBinaryGroupId: record.duplicateBinaryGroupId,
    sourceVersion: record.sourceVersion,
  });
}

function verifyRelease(manifest: MasterReleaseManifest, rootDir: string): ReleaseVerificationResult {
  const mismatches: string[] = [];

  if (manifest.releaseId !== EXPECTED_RELEASE_ID) {
    mismatches.push(`releaseId mismatch: expected ${EXPECTED_RELEASE_ID}, got ${manifest.releaseId}`);
  }
  if (manifest.phase !== EXPECTED_RELEASE_PHASE) {
    mismatches.push(`phase mismatch: expected ${EXPECTED_RELEASE_PHASE}, got ${manifest.phase}`);
  }
  if (manifest.status !== EXPECTED_RELEASE_STATUS) {
    mismatches.push(`status mismatch: expected ${EXPECTED_RELEASE_STATUS}, got ${manifest.status}`);
  }

  const { releaseDir } = integrationDataPaths(rootDir);
  const fileChecksums = readJson<FileChecksumEntry[]>(join(releaseDir, "master-file-checksums.json"));
  const checksumResult = verifyFrozenChecksums(rootDir, fileChecksums);

  if (checksumResult.status !== "PASS") {
    for (const mismatch of checksumResult.mismatches) {
      mismatches.push(`${mismatch.path}: ${mismatch.reason}`);
    }
  }

  if (mismatches.length > 0) {
    throw new MasterIntegrationError(
      `Master release verification failed: ${mismatches.join("; ")}`,
      mismatches.some((entry) => entry.includes("checksum")) ? "CHECKSUM_FAILURE" : "RELEASE_MISMATCH",
    );
  }

  return deepFreeze({
    verified: true,
    releaseId: manifest.releaseId,
    status: manifest.status,
    checksumStatus: checksumResult.status,
    mismatches: [],
  });
}

function indexByCanonicalId<T extends { canonicalId: string }>(records: T[]): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const record of records) {
    map.set(record.canonicalId, deepFreeze(record));
  }
  return map;
}

function buildMetadataByCanonical(records: RawMetadataIndexRecord[]): ReadonlyMap<string, RawMetadataIndexRecord[]> {
  const map = new Map<string, RawMetadataIndexRecord[]>();
  for (const record of records) {
    const existing = map.get(record.canonicalId) ?? [];
    existing.push(deepFreeze(record));
    map.set(record.canonicalId, existing);
  }
  return map;
}

function buildSemanticSearchTermMap(terms: SemanticSearchTermEntry[]): ReadonlyMap<string, SemanticSearchTermEntry> {
  const map = new Map<string, SemanticSearchTermEntry>();
  for (const term of terms) {
    map.set(term.normalizedTerm, deepFreeze(term));
  }
  return map;
}

export function initializeMasterReader(rootDir: string = process.cwd()): MasterDataCache {
  if (cachedReader) {
    return cachedReader;
  }

  const { releaseDir, masterDir } = integrationDataPaths(rootDir);
  const manifest = readJson<MasterReleaseManifest>(join(releaseDir, "master-release-manifest.json"));
  const releaseVerification = verifyRelease(manifest, rootDir);

  const canonicalRecords = readJson<CanonicalEmojiRecord[]>(join(masterDir, "canonical-emojis.json"));
  const artworkMasterIndex = readJson<ArtworkMasterRecord[]>(join(masterDir, "artwork/artwork-master-index.json"));
  const canonicalArtworkIndex = readJson<
    Array<{
      canonicalId: string;
      artwork: { openmoji: string[]; noto: string[]; twemoji: string[]; fluent: string[] };
    }>
  >(join(masterDir, "artwork/canonical-artwork-index.json"));
  const nameRecords = readJson<CanonicalNameRecord[]>(join(masterDir, "metadata/canonical-name-records.json"));
  const searchIndex = readJson<CanonicalSearchIndexEntry[]>(join(masterDir, "metadata/canonical-search-index.json"));
  const seoRecords = readJson<CanonicalSeoRecord[]>(join(masterDir, "metadata/canonical-seo-records.json"));
  const semanticIndex = readJson<CanonicalSemanticIndexEntry[]>(join(masterDir, "semantic/canonical-semantic-index.json"));
  const semanticSearchTerms = readJson<SemanticSearchTermEntry[]>(join(masterDir, "semantic/semantic-search-terms.json"));
  const rawMetadata = readJson<RawMetadataIndexRecord[]>(join(masterDir, "metadata/raw-metadata-index.json"));
  const canonicalMetadataIndex = readJson<CanonicalMetadataIndexEntry[]>(
    join(masterDir, "metadata/canonical-metadata-index.json"),
  );

  const artworkById = new Map<string, ArtworkMasterRecord>();
  for (const record of artworkMasterIndex) {
    artworkById.set(record.artworkId, deepFreeze(record));
  }

  const metadataById = new Map<string, RawMetadataIndexRecord>();
  for (const record of rawMetadata) {
    metadataById.set(record.metadataRecordId, deepFreeze(record));
  }

  cachedReader = deepFreeze({
    manifest: deepFreeze(manifest),
    releaseVerification,
    canonicalRecords: indexByCanonicalId(canonicalRecords),
    nameRecords: indexByCanonicalId(nameRecords),
    searchIndex: indexByCanonicalId(searchIndex),
    seoRecords: indexByCanonicalId(seoRecords),
    semanticIndex: indexByCanonicalId(semanticIndex),
    semanticSearchTerms: buildSemanticSearchTermMap(semanticSearchTerms),
    artworkById,
    artworkByCanonical: buildArtworkLookup(canonicalArtworkIndex, artworkById),
    metadataByCanonical: buildMetadataByCanonical(rawMetadata),
    metadataById,
    canonicalMetadataIndex: indexByCanonicalId(canonicalMetadataIndex),
  });

  return cachedReader;
}

export function getMasterReader(rootDir?: string): MasterDataCache {
  return initializeMasterReader(rootDir);
}

export function resetMasterReaderCache(): void {
  cachedReader = null;
}
