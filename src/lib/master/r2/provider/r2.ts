import type { R2ArtworkKeyEntry, R2IdentityRecord, R2Manifest } from "../types";
import type { MasterDataProvider } from "./types";
import { assertSafeR2Key } from "../keys";

export interface R2BucketBinding {
  get(key: string): Promise<{ body: ReadableStream | null; httpMetadata?: { contentType?: string } } | null>;
  head(key: string): Promise<{ size: number; httpMetadata?: { contentType?: string } } | null>;
}

export class R2MasterDataProvider implements MasterDataProvider {
  private manifestCache: R2Manifest | null = null;
  private artworkIndexCache: Map<string, R2ArtworkKeyEntry> | null = null;

  constructor(private readonly bucket: R2BucketBinding) {}

  private async loadManifest(): Promise<R2Manifest> {
    if (this.manifestCache) {
      return this.manifestCache;
    }
    const object = await this.bucket.get("emojiquick/manifests/r2-manifest.json");
    if (!object?.body) {
      throw new Error("R2 manifest not found");
    }
    const text = await new Response(object.body).text();
    this.manifestCache = JSON.parse(text) as R2Manifest;
    return this.manifestCache;
  }

  private async loadArtworkIndex(): Promise<Map<string, R2ArtworkKeyEntry>> {
    if (this.artworkIndexCache) {
      return this.artworkIndexCache;
    }
    const manifest = await this.loadManifest();
    const key = manifest.artworkIndexKey;
    const object = await this.bucket.get(key);
    if (!object?.body) {
      throw new Error("R2 artwork index not found");
    }
    const entries = JSON.parse(await new Response(object.body).text()) as R2ArtworkKeyEntry[];
    this.artworkIndexCache = new Map(entries.map((entry) => [entry.storageKey, entry]));
    return this.artworkIndexCache;
  }

  async getManifest(): Promise<R2Manifest | null> {
    try {
      return await this.loadManifest();
    } catch {
      return null;
    }
  }

  async getIdentity(canonicalId: string): Promise<R2IdentityRecord | null> {
    const manifest = await this.loadManifest();
    for (const shard of manifest.identityShards) {
      const object = await this.bucket.get(shard.objectKey);
      if (!object?.body) continue;
      const records = JSON.parse(await new Response(object.body).text()) as R2IdentityRecord[];
      const match = records.find((record) => record.canonicalId === canonicalId);
      if (match) return match;
    }
    return null;
  }

  async getArtworkKey(artworkId: string): Promise<R2ArtworkKeyEntry | null> {
    const index = await this.loadArtworkIndex();
    for (const entry of index.values()) {
      if (entry.artworkId === artworkId) {
        return entry;
      }
    }
    return null;
  }

  async getArtworkBytes(storageKey: string): Promise<Uint8Array | null> {
    assertSafeR2Key(storageKey);
    const object = await this.bucket.get(storageKey);
    if (!object?.body) return null;
    const buffer = await new Response(object.body).arrayBuffer();
    return new Uint8Array(buffer);
  }

  async listArtworkKeysForCanonical(canonicalId: string): Promise<readonly R2ArtworkKeyEntry[]> {
    const index = await this.loadArtworkIndex();
    return [...index.values()].filter((entry) => entry.canonicalId === canonicalId);
  }

  async isArtworkKeyAllowed(storageKey: string): Promise<boolean> {
    assertSafeR2Key(storageKey);
    const index = await this.loadArtworkIndex();
    return index.has(storageKey);
  }
}
