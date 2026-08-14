import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { R2ArtworkKeyEntry, R2IdentityRecord, R2Manifest } from "../types";
import type { MasterDataProvider, MasterDataProviderContext } from "./types";
import { assertSafeR2Key } from "../keys";

interface LocalCache {
  manifest: R2Manifest | null;
  artworkByRecordKey: Map<string, R2ArtworkKeyEntry>;
  artworkByStorageKey: Map<string, R2ArtworkKeyEntry>;
  artworkByCanonical: Map<string, R2ArtworkKeyEntry[]>;
  identityByShard: Map<string, R2IdentityRecord[]>;
}

export class LocalMasterDataProvider implements MasterDataProvider {
  private readonly exportRootDir: string;
  private cache: LocalCache | null = null;

  constructor(context: MasterDataProviderContext) {
    this.exportRootDir = context.exportRootDir;
  }

  private loadCache(): LocalCache {
    if (this.cache) {
      return this.cache;
    }

    const manifestPath = join(this.exportRootDir, "manifests", "r2-manifest.json");
    if (!existsSync(manifestPath)) {
      throw new Error(`Local R2 export not found at ${manifestPath}. Run npm run r2:prepare first.`);
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as R2Manifest;
    const artworkIndexPath = join(
      this.exportRootDir,
      manifest.artworkIndexKey.replace(/^emojiquick\//, ""),
    );
    const artworkKeys = JSON.parse(readFileSync(artworkIndexPath, "utf8")) as R2ArtworkKeyEntry[];

    const artworkById = new Map<string, R2ArtworkKeyEntry>();
    const artworkByStorageKey = new Map<string, R2ArtworkKeyEntry>();
    const artworkByCanonical = new Map<string, R2ArtworkKeyEntry[]>();
    for (const entry of artworkKeys) {
      artworkById.set(entry.recordKey, entry);
      artworkByStorageKey.set(entry.storageKey, entry);
      const bucket = artworkByCanonical.get(entry.canonicalId) ?? [];
      bucket.push(entry);
      artworkByCanonical.set(entry.canonicalId, bucket);
    }

    const identityByShard = new Map<string, R2IdentityRecord[]>();
    for (const shard of manifest.identityShards) {
      const shardPath = join(this.exportRootDir, shard.objectKey.replace(/^emojiquick\//, ""));
      identityByShard.set(shard.shardId, JSON.parse(readFileSync(shardPath, "utf8")) as R2IdentityRecord[]);
    }

    this.cache = {
      manifest,
      artworkByRecordKey: artworkById,
      artworkByStorageKey,
      artworkByCanonical,
      identityByShard,
    };
    return this.cache;
  }

  async getManifest(): Promise<R2Manifest | null> {
    try {
      return this.loadCache().manifest;
    } catch {
      return null;
    }
  }

  async getIdentity(canonicalId: string): Promise<R2IdentityRecord | null> {
    const cache = this.loadCache();
    for (const shard of cache.identityByShard.values()) {
      const match = shard.find((record) => record.canonicalId === canonicalId);
      if (match) {
        return match;
      }
    }
    return null;
  }

  async getArtworkKey(artworkId: string): Promise<R2ArtworkKeyEntry | null> {
    const cache = this.loadCache();
    for (const entry of cache.artworkByRecordKey.values()) {
      if (entry.artworkId === artworkId) {
        return entry;
      }
    }
    return null;
  }

  async getArtworkBytes(storageKey: string): Promise<Uint8Array | null> {
    assertSafeR2Key(storageKey);
    const relative = storageKey.replace(/^emojiquick\//, "");
    const absolute = join(this.exportRootDir, relative);
    if (!existsSync(absolute)) {
      return null;
    }
    return readFileSync(absolute);
  }

  async listArtworkKeysForCanonical(canonicalId: string): Promise<readonly R2ArtworkKeyEntry[]> {
    return this.loadCache().artworkByCanonical.get(canonicalId) ?? [];
  }

  async isArtworkKeyAllowed(storageKey: string): Promise<boolean> {
    assertSafeR2Key(storageKey);
    return this.loadCache().artworkByStorageKey.has(storageKey);
  }
}
