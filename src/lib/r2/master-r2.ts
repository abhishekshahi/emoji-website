import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cache } from "react";
import { isMasterR2ApiEnabled } from "@/lib/master/r2/config";
import { resolveMasterR2Binding } from "./binding";
import { MasterDataUnavailableError, MasterObjectNotFoundError } from "./errors";
import {
  artworkBinaryKey,
  artworkRecordKey,
  assertSafeObjectKey,
  identityKey,
  licenseKey,
  manifestKey,
  metadataKey,
  provenanceKey,
  searchKey,
  semanticKey,
} from "./keys";
import { loadLicenseMatrix } from "./license-matrix";
import type {
  CanonicalArtworkRecord,
  CanonicalIdentityRecord,
  CanonicalSearchRecord,
  LicenseMatrix,
  MasterR2ReadResult,
  R2BucketBinding,
} from "./types";

const DEFAULT_EXPORT_ROOT = join(process.cwd(), "r2-export");
const R2_READ_TIMEOUT_MS = 8000;
const R2_MAX_READ_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withReadTimeout<T>(promise: Promise<T>, timeoutMs = R2_READ_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("R2 read timeout")), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export interface MasterR2Options {
  readonly exportRoot?: string;
  readonly binding?: R2BucketBinding | null;
  readonly readTimeoutMs?: number;
  readonly maxReadRetries?: number;
}

async function readBindingJson<T>(binding: R2BucketBinding, key: string): Promise<T | null> {
  assertSafeObjectKey(key);
  const object = await binding.get(key);
  if (!object?.body) return null;
  const text = await new Response(object.body).text();
  return JSON.parse(text.replace(/\n$/, "")) as T;
}

function readLocalJson<T>(exportRoot: string, key: string): T | null {
  assertSafeObjectKey(key);
  const path = join(exportRoot, key.replace(/\//g, "\\"));
  if (!existsSync(path)) return null;
  const text = readFileSync(path, "utf8").replace(/\n$/, "");
  return JSON.parse(text) as T;
}

async function readLocalBytes(exportRoot: string, key: string): Promise<Uint8Array | null> {
  assertSafeObjectKey(key);
  const path = join(exportRoot, key.replace(/\//g, "\\"));
  if (!existsSync(path)) return null;
  return readFileSync(path);
}

async function readBindingBytes(binding: R2BucketBinding, key: string): Promise<Uint8Array | null> {
  assertSafeObjectKey(key);
  const object = await binding.get(key);
  if (!object?.body) return null;
  return new Uint8Array(await new Response(object.body).arrayBuffer());
}

export class MasterR2Adapter {
  private readonly exportRoot: string;
  private readonly binding: R2BucketBinding | null;
  private readonly readTimeoutMs: number;
  private readonly maxReadRetries: number;
  private readonly requestMemo = new Map<string, Promise<unknown>>();

  constructor(options: MasterR2Options = {}) {
    this.exportRoot = options.exportRoot ?? DEFAULT_EXPORT_ROOT;
    this.binding = options.binding ?? null;
    this.readTimeoutMs = options.readTimeoutMs ?? R2_READ_TIMEOUT_MS;
    this.maxReadRetries = options.maxReadRetries ?? R2_MAX_READ_RETRIES;
  }

  get isR2Binding(): boolean {
    return this.binding !== null;
  }

  private memo<T>(key: string, loader: () => Promise<T>): Promise<T> {
    const existing = this.requestMemo.get(key);
    if (existing) return existing as Promise<T>;
    const promise = loader().finally(() => {
      if (this.requestMemo.get(key) === promise) {
        this.requestMemo.delete(key);
      }
    });
    this.requestMemo.set(key, promise);
    return promise;
  }

  private async withReadRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxReadRetries; attempt += 1) {
      try {
        return await withReadTimeout(operation(), this.readTimeoutMs);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxReadRetries) {
          await sleep(25 * (attempt + 1));
        }
      }
    }
    throw lastError;
  }

  private async readJson<T>(objectKey: string): Promise<MasterR2ReadResult<T> | null> {
    if (this.binding) {
      try {
        const data = await this.withReadRetry(() => readBindingJson<T>(this.binding!, objectKey));
        if (data) return { data, source: "r2" };
      } catch {
        // fall through to local
      }
    }

    try {
      const data = readLocalJson<T>(this.exportRoot, objectKey);
      if (data) return { data, source: "local" };
    } catch {
      return null;
    }

    return null;
  }

  private async readBytes(objectKey: string): Promise<Uint8Array | null> {
    if (this.binding) {
      try {
        const bytes = await this.withReadRetry(() => readBindingBytes(this.binding!, objectKey));
        if (bytes) return bytes;
      } catch {
        // fall through
      }
    }

    try {
      return await readLocalBytes(this.exportRoot, objectKey);
    } catch {
      return null;
    }
  }

  async getIdentity(canonicalId: string): Promise<MasterR2ReadResult<CanonicalIdentityRecord> | null> {
    return this.memo(`identity:${canonicalId}`, () => this.readJson<CanonicalIdentityRecord>(identityKey(canonicalId)));
  }

  async getMetadata(canonicalId: string): Promise<MasterR2ReadResult<Record<string, unknown>> | null> {
    return this.memo(`metadata:${canonicalId}`, () => this.readJson<Record<string, unknown>>(metadataKey(canonicalId)));
  }

  async getSemantic(canonicalId: string): Promise<MasterR2ReadResult<Record<string, unknown>> | null> {
    return this.memo(`semantic:${canonicalId}`, () => this.readJson<Record<string, unknown>>(semanticKey(canonicalId)));
  }

  async getSearch(canonicalId: string): Promise<MasterR2ReadResult<CanonicalSearchRecord> | null> {
    return this.memo(`search:${canonicalId}`, () => this.readJson<CanonicalSearchRecord>(searchKey(canonicalId)));
  }

  async getProvenance(canonicalId: string): Promise<MasterR2ReadResult<Record<string, unknown>> | null> {
    return this.memo(`provenance:${canonicalId}`, () => this.readJson<Record<string, unknown>>(provenanceKey(canonicalId)));
  }

  async getArtworkRecord(filePathHash: string): Promise<MasterR2ReadResult<CanonicalArtworkRecord> | null> {
    return this.memo(`artwork-record:${filePathHash}`, () =>
      this.readJson<CanonicalArtworkRecord>(artworkRecordKey(filePathHash)),
    );
  }

  async getArtworkBinary(checksum: string, ext: "svg" | "png" | "bin"): Promise<Uint8Array | null> {
    return this.memo(`artwork-binary:${checksum}.${ext}`, () => this.readBytes(artworkBinaryKey(checksum, ext)));
  }

  async getManifest(fileName: string): Promise<MasterR2ReadResult<Record<string, unknown>> | null> {
    return this.memo(`manifest:${fileName}`, () => this.readJson<Record<string, unknown>>(manifestKey(fileName)));
  }

  async getLicenseMatrix(): Promise<LicenseMatrix | null> {
    const fromStore = await this.readJson<LicenseMatrix>(licenseKey("LICENSE-MATRIX.json"));
    if (fromStore) return fromStore.data;
    return loadLicenseMatrix(this.exportRoot);
  }

  async requireIdentity(canonicalId: string): Promise<CanonicalIdentityRecord> {
    const result = await this.getIdentity(canonicalId);
    if (!result) throw new MasterObjectNotFoundError();
    return result.data;
  }
}

let adapterSingleton: MasterR2Adapter | null = null;

export async function getMasterR2Adapter(options?: MasterR2Options): Promise<MasterR2Adapter | null> {
  if (!isMasterR2ApiEnabled()) {
    return null;
  }

  if (!options && adapterSingleton) {
    return adapterSingleton;
  }

  const binding = options?.binding !== undefined ? options.binding : await resolveMasterR2Binding();
  const adapter = new MasterR2Adapter({ ...options, binding });
  if (!options) {
    adapterSingleton = adapter;
  }
  return adapter;
}

export function resetMasterR2AdapterCache(): void {
  adapterSingleton = null;
}

type PublicIdentityPayload = Readonly<{
  identity: CanonicalIdentityRecord | null;
  search: CanonicalSearchRecord | null;
}>;

/** Bounded immutable cross-request cache — safe read-only after insert. */
const PUBLIC_IDENTITY_PAYLOAD_CACHE_MAX = 512;
const publicIdentityPayloadCache = new Map<string, PublicIdentityPayload>();

export function resetPublicIdentityPayloadCache(): void {
  publicIdentityPayloadCache.clear();
}

function getCachedPublicIdentityPayload(canonicalId: string): PublicIdentityPayload | null {
  return publicIdentityPayloadCache.get(canonicalId) ?? null;
}

function setCachedPublicIdentityPayload(canonicalId: string, payload: PublicIdentityPayload): void {
  if (publicIdentityPayloadCache.size >= PUBLIC_IDENTITY_PAYLOAD_CACHE_MAX) {
    const oldest = publicIdentityPayloadCache.keys().next().value;
    if (oldest) {
      publicIdentityPayloadCache.delete(oldest);
    }
  }
  publicIdentityPayloadCache.set(canonicalId, payload);
}

/**
 * Minimal request-scoped R2 payload for public emoji pages.
 * Fetches only identity + search (2 reads) — metadata/semantic are omitted
 * because master identity pages do not render them and the extra reads caused
 * Worker CPU/subrequest exhaustion (HTTP 1102) under concurrent on-demand load.
 */
export const getPublicIdentityR2Payload = cache(async (canonicalId: string) => {
  const cached = getCachedPublicIdentityPayload(canonicalId);
  if (cached) {
    return cached;
  }

  const adapter = await getMasterR2Adapter();
  if (!adapter) return null;

  const [identityResult, searchResult] = await Promise.all([
    adapter.getIdentity(canonicalId),
    adapter.getSearch(canonicalId),
  ]);

  if (!identityResult?.data && !searchResult?.data) {
    return null;
  }

  const payload = Object.freeze({
    identity: identityResult?.data ?? null,
    search: searchResult?.data ?? null,
  }) as PublicIdentityPayload;

  setCachedPublicIdentityPayload(canonicalId, payload);
  return payload;
});

/** React request-level cache for emoji bundle reads. */
export const getEmojiMasterBundle = cache(async (canonicalId: string) => {
  const adapter = await getMasterR2Adapter();
  if (!adapter) return null;

  const [identity, metadata, semantic, search, provenance] = await Promise.all([
    adapter.getIdentity(canonicalId),
    adapter.getMetadata(canonicalId),
    adapter.getSemantic(canonicalId),
    adapter.getSearch(canonicalId),
    adapter.getProvenance(canonicalId),
  ]);

  if (!identity && !search && !metadata) {
    throw new MasterDataUnavailableError();
  }

  return Object.freeze({
    identity: identity?.data ?? null,
    metadata: metadata?.data ?? null,
    semantic: semantic?.data ?? null,
    search: search?.data ?? null,
    provenance: provenance?.data ?? null,
    sources: {
      identity: identity?.source ?? null,
      metadata: metadata?.source ?? null,
      semantic: semantic?.source ?? null,
      search: search?.source ?? null,
      provenance: provenance?.source ?? null,
    },
  });
});

export async function getArtworkBinaryForRecord(
  record: CanonicalArtworkRecord,
): Promise<Uint8Array | null> {
  const adapter = await getMasterR2Adapter();
  if (!adapter) return null;
  const ext = record.format.toLowerCase() === "png" ? "png" : record.format.toLowerCase() === "svg" ? "svg" : "bin";
  return adapter.getArtworkBinary(record.checksum, ext);
}
