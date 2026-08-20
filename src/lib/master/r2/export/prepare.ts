import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { CanonicalMetadataIndexEntry } from "@/lib/master/metadata/types";
import type { CanonicalSemanticIndexEntry } from "@/lib/master/semantic/types";
import type { CanonicalSearchIndexEntry } from "@/lib/master/reconciliation/types";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import type {
  R2ArtworkKeyEntry,
  R2IdentityRecord,
  R2Manifest,
  R2ShardManifestEntry,
} from "../types";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../catalog";
import { R2_SHARD_SIZE } from "../config";
import {
  buildArtworkIndexKey,
  buildArtworkStorageKey,
  buildIdentityShardKey,
  buildManifestKey,
  buildMetadataShardKey,
  buildSearchShardKey,
  buildSemanticShardKey,
} from "../keys";
import {
  contentTypeForFormat,
  getProviderLicense,
  isProviderPubliclyServed,
} from "../licenses";
import { shardIdForIndex, shardRecords, sha256Hex, stableSortBy } from "../sharding";
import { EXPECTED_RELEASE_ID } from "@/lib/master/integration/config";
import { R2_DATASET_VERSION } from "../types";

export interface R2ExportInput {
  readonly canonicalRecords: readonly CanonicalEmojiRecord[];
  readonly artworkRecords: readonly ArtworkMasterRecord[];
  readonly metadataRecords: readonly CanonicalMetadataIndexEntry[];
  readonly semanticRecords: readonly CanonicalSemanticIndexEntry[];
  readonly searchRecords: readonly CanonicalSearchIndexEntry[];
  readonly productionSlugByCanonicalId: ReadonlyMap<string, string>;
  readonly artworkRootDir: string;
  readonly readFile: (path: string) => Buffer;
  readonly fileExists: (path: string) => boolean;
  readonly copyFile: (source: string, destination: string) => void;
  readonly writeJson: (path: string, value: unknown) => void;
  readonly writeText: (path: string, content: string) => void;
  readonly mkdir: (path: string) => void;
  readonly exportRootDir: string;
}

export interface R2PreparedObject {
  readonly relativePath: string;
  readonly bytes: number;
  readonly sha256: string;
}

function toIdentityRecord(
  record: CanonicalEmojiRecord,
  productionSlugByCanonicalId: ReadonlyMap<string, string>,
): R2IdentityRecord {
  const artworkIds = [
    ...record.artwork.openmoji,
    ...record.artwork.noto,
    ...record.artwork.twemoji,
    ...record.artwork.fluent,
  ].map((entry) => entry.sourceId);

  const productionSlug = productionSlugByCanonicalId.get(record.canonicalId) ?? null;

  return {
    canonicalId: record.canonicalId,
    emoji: record.emoji,
    unicodeSequence: record.unicodeSequence,
    identityType: record.identityType,
    isUnicode: record.isUnicode,
    seoEligible: productionSlug !== null,
    productionSlug,
    artworkIds,
    metadataRefCount: record.metadataRefs.length,
    semanticRefCount: record.semanticRefs.length,
  };
}

function writeShard<T>(
  input: R2ExportInput,
  shardKeyBuilder: (shardId: string) => string,
  records: readonly T[],
): { entries: R2PreparedObject[]; manifest: R2ShardManifestEntry[] } {
  const shards = shardRecords(records, R2_SHARD_SIZE);
  const entries: R2PreparedObject[] = [];
  const manifest: R2ShardManifestEntry[] = [];

  shards.forEach((shard, index) => {
    const shardId = shardIdForIndex(index);
    const objectKey = shardKeyBuilder(shardId);
    const relativePath = objectKey.replace(/^emojiquick\//, "");
    const absolutePath = `${input.exportRootDir}/${relativePath}`;
    input.mkdir(absolutePath.substring(0, absolutePath.lastIndexOf("/")));
    const payload = `${JSON.stringify(shard)}\n`;
    input.writeText(absolutePath, payload);
    const sha256 = sha256Hex(payload);
    const bytes = Buffer.byteLength(payload, "utf8");
    entries.push({ relativePath, bytes, sha256 });
    manifest.push({
      shardId,
      objectKey,
      recordCount: shard.length,
      bytes,
      sha256,
    });
  });

  return { entries, manifest };
}


export function buildProductionSlugMapFromEntries(
  entries: readonly { canonicalId: string; productionId: string; productionType: "standard" | "extra" }[],
  slugByProductionId: ReadonlyMap<string, string>,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    const slug = slugByProductionId.get(`${entry.productionType}:${entry.productionId}`);
    if (slug) {
      map.set(entry.canonicalId, slug);
    }
  }
  return map;
}

export function prepareR2Export(input: R2ExportInput): {
  manifest: R2Manifest;
  objects: R2PreparedObject[];
} {
  if (input.canonicalRecords.length !== MASTER_IDENTITY_COUNT) {
    throw new Error(`Expected ${MASTER_IDENTITY_COUNT} identities, got ${input.canonicalRecords.length}`);
  }
  if (input.artworkRecords.length !== MASTER_ARTWORK_RECORD_COUNT) {
    throw new Error(
      `Expected ${MASTER_ARTWORK_RECORD_COUNT} artwork records, got ${input.artworkRecords.length}`,
    );
  }

  const identityRecords = stableSortBy(
    input.canonicalRecords.map((record) => toIdentityRecord(record, input.productionSlugByCanonicalId)),
    (record) => record.canonicalId,
  );
  const metadataRecords = stableSortBy(input.metadataRecords, (record) => record.canonicalId);
  const semanticRecords = stableSortBy(input.semanticRecords, (record) => record.canonicalId);
  const searchRecords = stableSortBy(input.searchRecords, (record) => record.canonicalId);

  const objects: R2PreparedObject[] = [];

  const identity = writeShard(input, buildIdentityShardKey, identityRecords);
  const metadata = writeShard(input, buildMetadataShardKey, metadataRecords);
  const semantic = writeShard(input, buildSemanticShardKey, semanticRecords);
  const search = writeShard(input, buildSearchShardKey, searchRecords);
  objects.push(...identity.entries, ...metadata.entries, ...semantic.entries, ...search.entries);

  const checksumToStorageKey = new Map<string, string>();
  const artworkKeys: R2ArtworkKeyEntry[] = [];
  const providerCounts = { openmoji: 0, noto: 0, twemoji: 0, fluent: 0 };
  const formatCounts = { svg: 0, png: 0, other: 0 };
  let duplicateBinaryRecords = 0;
  let bytesSaved = 0;
  let uniqueArtworkFiles = 0;
  let artworkBytes = 0;

  const sortedArtwork = stableSortBy(input.artworkRecords, (record) => record.artworkId);

  for (const record of sortedArtwork) {
    const sourcePath = `${input.artworkRootDir}/${record.filePath.replace(/^artwork\//, "")}`;
    if (!input.fileExists(sourcePath)) {
      throw new Error(`Missing artwork file for ${record.artworkId}: ${sourcePath}`);
    }

    const storageKey = buildArtworkStorageKey(record.provider, record.filePath.replace(/^artwork\/[^/]+\//, ""));
    const relativePath = storageKey.replace(/^emojiquick\//, "");
    const destination = `${input.exportRootDir}/${relativePath}`;

    const existingKey = checksumToStorageKey.get(record.checksum);
    if (existingKey) {
      duplicateBinaryRecords += 1;
      const existingPath = `${input.exportRootDir}/${existingKey.replace(/^emojiquick\//, "")}`;
      if (input.fileExists(existingPath)) {
        bytesSaved += input.readFile(sourcePath).length;
      }
    } else {
      input.mkdir(destination.substring(0, destination.lastIndexOf("/")));
      input.copyFile(sourcePath, destination);
      checksumToStorageKey.set(record.checksum, storageKey);
      const fileBytes = input.readFile(destination).length;
      artworkBytes += fileBytes;
      uniqueArtworkFiles += 1;
      objects.push({
        relativePath,
        bytes: fileBytes,
        sha256: record.checksum,
      });
    }

    providerCounts[record.provider] += 1;
    const format =
      record.format.toLowerCase() === "png"
        ? "png"
        : record.format.toLowerCase() === "svg"
          ? "svg"
          : "other";
    formatCounts[format] += 1;

    artworkKeys.push({
      recordKey: record.filePath,
      artworkId: record.artworkId,
      provider: record.provider,
      storageKey: existingKey ?? storageKey,
      canonicalId: record.canonicalId,
      format,
      checksum: record.checksum,
      publiclyServed: isProviderPubliclyServed(record.provider),
      license: record.license,
      contentType: contentTypeForFormat(record.format),
    });
  }

  const artworkIndexKey = buildArtworkIndexKey();
  const artworkIndexRelative = artworkIndexKey.replace(/^emojiquick\//, "");
  const artworkIndexPath = `${input.exportRootDir}/${artworkIndexRelative}`;
  input.mkdir(artworkIndexPath.substring(0, artworkIndexPath.lastIndexOf("/")));
  const artworkIndexPayload = `${JSON.stringify(artworkKeys)}\n`;
  input.writeText(artworkIndexPath, artworkIndexPayload);
  objects.push({
    relativePath: artworkIndexRelative,
    bytes: Buffer.byteLength(artworkIndexPayload, "utf8"),
    sha256: sha256Hex(artworkIndexPayload),
  });

  const licenses = (["openmoji", "noto", "twemoji", "fluent"] as const).map((provider) =>
    getProviderLicense(provider, providerCounts[provider]),
  );

  const manifestWithoutHash: Omit<R2Manifest, "manifestSha256"> = {
    datasetVersion: R2_DATASET_VERSION,
    generatedAt: new Date().toISOString(),
    releaseId: EXPECTED_RELEASE_ID,
    totals: {
      identities: identityRecords.length,
      artworkRecords: sortedArtwork.length,
      artworkFiles: uniqueArtworkFiles,
      metadataRecords: metadataRecords.length,
      semanticRecords: semanticRecords.length,
      searchRecords: searchRecords.length,
      objects: objects.length + 1,
      bytes: objects.reduce((sum, object) => sum + object.bytes, 0),
    },
    providerCounts,
    formatCounts,
    licenses,
    identityShards: identity.manifest,
    metadataShards: metadata.manifest,
    semanticShards: semantic.manifest,
    searchShards: search.manifest,
    artworkIndexKey,
    deduplication: {
      duplicateBinaryRecords,
      bytesSaved,
      uniqueArtworkFiles,
    },
  };

  const manifestPayload = `${JSON.stringify(manifestWithoutHash)}\n`;
  const manifestSha256 = sha256Hex(manifestPayload);
  const manifest: R2Manifest = { ...manifestWithoutHash, manifestSha256 };

  const manifestRelative = buildManifestKey().replace(/^emojiquick\//, "");
  const manifestPath = `${input.exportRootDir}/${manifestRelative}`;
  input.mkdir(manifestPath.substring(0, manifestPath.lastIndexOf("/")));
  input.writeText(manifestPath, manifestPayload);
  objects.push({
    relativePath: manifestRelative,
    bytes: Buffer.byteLength(manifestPayload, "utf8"),
    sha256: manifestSha256,
  });

  return { manifest, objects };
}
