import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { verifyFrozenChecksums } from "../../src/lib/master/release/build";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";
import {
  MASTER_ARTWORK_RECORD_COUNT,
  MASTER_IDENTITY_COUNT,
  PUBLIC_SITEMAP_URL_COUNT,
} from "../../src/lib/master/r2/catalog";
import {
  R2_ACCOUNT_ID,
  clearWranglerTokenCache,
  getObjectHttp,
  headObjectHttp,
  readWranglerOAuthToken,
} from "./r2-http-client";
import { AdaptiveConcurrency, GlobalRateLimiter } from "./r2-upload-limiter";
import {
  R2_BUCKET_NAME,
  bucketExists,
  isR2AccountEnabled,
  runWranglerWithRetry,
} from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const UNIQUE_ARTWORK = 39_652;
const DUPLICATE_REFS = 419;
const HEAD_SAMPLE_SIZE = Number(process.env.R2_HEAD_SAMPLE_SIZE ?? "200");
const HEAD_MIN_CONCURRENCY = 32;
const HEAD_START_CONCURRENCY = 64;
const HEAD_MAX_CONCURRENCY = 128;
const HEARTBEAT_MS = 45_000;

const verificationPath = join(exportDir, "manifests", "r2-phase-8-51-verification.json");
const reconciliationPath = join(exportDir, "manifests", "r2-phase-8-51-reconciliation.json");
const reportPath = join(exportDir, "PHASE-8.51-FAST-VERIFICATION-REPORT.md");
const remoteListCachePath = join(exportDir, "manifests", "r2-phase-8-50-remote-list.json");
const phase844Path = join(exportDir, "manifests", "r2-phase-8-44-final.json");
const wranglerConfigPath = join(rootDir, "wrangler.jsonc");

const EXPECTED_UNEXPECTED = [
  "licenses/LICENSE-MATRIX.json",
  "manifests/master-manifest.json",
  "test-benchmark-delete-me.json",
] as const;

const API_LIST_BASE = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects`;

interface CanonicalEntry {
  objectKey: string;
  sha256: string;
  bytes: number;
}

interface HeadSampleStats {
  sampled: number;
  headOk: number;
  headFailed: string[];
  sizeMismatches: string[];
  etagSamples: string[];
  retries: number;
}

interface SpotCheckStats {
  checked: number;
  verified: number;
  checksumMismatch: string[];
  sizeMismatches: string[];
  missing: string[];
  unableToVerify: string[];
  retries: number;
}

type R2BucketLike = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
  head(key: string): Promise<{ size: number } | null>;
};

type MasterR2Env = { MASTER_R2: R2BucketLike };

let platformProxy: Awaited<ReturnType<typeof getPlatformProxy<MasterR2Env>>> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let heartbeatLabel = "idle";

function sha256Buf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    log(`[heartbeat] ${heartbeatLabel}`);
  }, HEARTBEAT_MS);
}

function stopHeartbeat(): void {
  if (!heartbeatTimer) return;
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

function countFiles(dir: string): number {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    count += entry.isDirectory() ? countFiles(full) : 1;
  }
  return count;
}

function dirBytes(dir: string): number {
  if (!existsSync(dir)) return 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    bytes += entry.isDirectory() ? dirBytes(full) : statSync(full).size;
  }
  return bytes;
}

function loadCanonicalEntries(): CanonicalEntry[] {
  const lines = readFileSync(join(exportDir, "manifests", "r2-checksums.sha256"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  const entries: CanonicalEntry[] = [];
  for (const line of lines) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    if (!match) continue;
    const [, sha256, objectKey] = match;
    const localPath = join(exportDir, objectKey.replace(/\//g, "\\"));
    entries.push({ objectKey, sha256, bytes: statSync(localPath).size });
  }
  return entries;
}

function isRetryableHttp(status: number, body: string): boolean {
  if (status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  const lower = body.toLowerCase();
  return lower.includes("econnreset") || lower.includes("timeout") || lower.includes("temporarily unavailable");
}

async function fetchWithRetry(url: string, maxAttempts = 8): Promise<Response> {
  let lastError = "unknown";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const token = readWranglerOAuthToken();
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(Number(process.env.R2_HTTP_TIMEOUT_MS ?? "90000")),
      });
      const body = await res.clone().text();
      if (res.status === 401 && attempt < maxAttempts - 1) {
        clearWranglerTokenCache();
        await sleep(1000 * (attempt + 1));
        continue;
      }
      if (res.ok || !isRetryableHttp(res.status, body) || attempt >= maxAttempts - 1) {
        return res;
      }
      const retryAfter = res.headers.get("retry-after");
      const waitMs =
        retryAfter && /^\d+$/.test(retryAfter)
          ? (Number(retryAfter) + 1) * 1000
          : 500 * 2 ** attempt + Math.floor(Math.random() * 250);
      await sleep(waitMs);
    } catch (error: unknown) {
      lastError = error instanceof Error ? error.message : String(error);
      if (attempt >= maxAttempts - 1) throw new Error(lastError);
      await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 250));
    }
  }
  throw new Error(lastError);
}

async function listAllRemoteObjects(): Promise<{ map: Map<string, number>; conflicts: string[] }> {
  const map = new Map<string, number>();
  const conflicts: string[] = [];
  let cursor: string | undefined;
  let page = 0;
  while (true) {
    page += 1;
    const params = new URLSearchParams({ per_page: "1000" });
    if (cursor) params.set("cursor", cursor);
    const res = await fetchWithRetry(`${API_LIST_BASE}?${params.toString()}`);
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`R2 list failed (${res.status}): ${text.slice(0, 400)}`);
    }
    const parsed = JSON.parse(text) as {
      success?: boolean;
      result?: Array<{ key?: string; size?: number }> | {
        objects?: Array<{ key?: string; size?: number }>;
        truncated?: boolean;
        cursor?: string;
      };
      result_info?: { cursor?: string; is_truncated?: boolean };
    };

    const objects = Array.isArray(parsed.result)
      ? parsed.result
      : (parsed.result?.objects ?? []);

    for (const obj of objects) {
      if (!obj.key) continue;
      if (map.has(obj.key)) conflicts.push(obj.key);
      map.set(obj.key, obj.size ?? 0);
    }
    log(`Phase A list page ${page}: cumulative ${map.size}`);

    const truncated = Array.isArray(parsed.result)
      ? parsed.result_info?.is_truncated === true
      : parsed.result?.truncated === true;
    if (!truncated) break;
    cursor = Array.isArray(parsed.result)
      ? parsed.result_info?.cursor
      : parsed.result?.cursor;
    if (!cursor) break;
  }
  return { map, conflicts };
}

function remoteSha256(objectKey: string, bytes: Buffer): string {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".txt")) {
    return sha256Buf(Buffer.from(bytes.toString("utf8").replace(/\n$/, ""), "utf8"));
  }
  return sha256Buf(bytes);
}

async function getPlatformR2Proxy(): Promise<Awaited<ReturnType<typeof getPlatformProxy<MasterR2Env>>>> {
  if (!platformProxy) {
    platformProxy = await getPlatformProxy<MasterR2Env>({
      configPath: wranglerConfigPath,
      remoteBindings: true,
    });
  }
  return platformProxy;
}

async function downloadViaPlatformProxy(objectKey: string): Promise<Buffer | null> {
  const proxy = await getPlatformR2Proxy();
  const obj = await proxy.env.MASTER_R2.get(objectKey);
  if (!obj) return null;
  return Buffer.from(await obj.arrayBuffer());
}

async function headViaPlatformProxy(objectKey: string): Promise<number | null> {
  const proxy = await getPlatformR2Proxy();
  const obj = await proxy.env.MASTER_R2.head(objectKey);
  if (!obj) return null;
  return obj.size;
}

async function augmentRemoteMapWithDotKeys(
  remoteMap: Map<string, number>,
  entries: CanonicalEntry[],
): Promise<{ augmented: number; bindingMissing: string[]; probed: number }> {
  const dotEntries = entries.filter((entry) => entry.objectKey.includes(".."));
  const bindingMissing: string[] = [];
  let augmented = 0;

  log(`Phase B: binding probe for ${dotEntries.length} dot-key objects`);
  for (const entry of dotEntries) {
    if (remoteMap.has(entry.objectKey)) continue;
    const size = await headViaPlatformProxy(entry.objectKey);
    if (size === null) {
      bindingMissing.push(entry.objectKey);
      continue;
    }
    remoteMap.set(entry.objectKey, size);
    augmented += 1;
  }
  log(`Binding probe complete: ${augmented} augmented, ${bindingMissing.length} missing`);
  return { augmented, bindingMissing, probed: dotEntries.length };
}

function countCanonicalPrefix(
  entries: CanonicalEntry[],
  remoteMap: Map<string, number>,
  prefix: string,
): number {
  return entries.filter((entry) => entry.objectKey.startsWith(prefix) && remoteMap.has(entry.objectKey))
    .length;
}

function countPrefix(keys: Iterable<string>, prefix: string): number {
  let count = 0;
  for (const key of keys) {
    if (key.startsWith(prefix)) count += 1;
  }
  return count;
}

function pickHeadSample(entries: CanonicalEntry[], sampleSize: number): CanonicalEntry[] {
  const eligible = entries.filter((e) => !e.objectKey.includes(".."));
  if (eligible.length <= sampleSize) return eligible;
  const stride = Math.floor(eligible.length / sampleSize);
  const sample: CanonicalEntry[] = [];
  for (let i = 0; i < sampleSize; i += 1) {
    sample.push(eligible[i * stride]!);
  }
  return sample;
}

function pickSpotChecks(entries: CanonicalEntry[]): CanonicalEntry[] {
  const categories: Array<{ prefix: string; label: string }> = [
    { prefix: "identities/", label: "identities" },
    { prefix: "artwork/", label: "artwork" },
    { prefix: "artwork-records/", label: "artwork-records" },
    { prefix: "metadata/", label: "metadata" },
    { prefix: "semantic/", label: "semantic" },
    { prefix: "search/", label: "search" },
    { prefix: "provenance/", label: "provenance" },
    { prefix: "licenses/", label: "licenses" },
    { prefix: "manifests/", label: "manifests" },
  ];
  const picks: CanonicalEntry[] = [];
  for (const cat of categories) {
    const match = entries.find((e) => e.objectKey.startsWith(cat.prefix));
    if (match) picks.push(match);
  }
  const dotKey = entries.find((e) => e.objectKey.includes(".."));
  if (dotKey) picks.push(dotKey);
  return picks;
}

async function headWithLimiter(
  objectKey: string,
  limiter: GlobalRateLimiter,
  adaptive: AdaptiveConcurrency,
): Promise<{ ok: boolean; contentLength: number | null; etag: string | null; status: number }> {
  await limiter.waitForSlot();
  const result = await headObjectHttp(objectKey);
  if (result.status === 429) {
    limiter.record429(result.retryAfterSec);
    adaptive.on429();
    return { ok: false, contentLength: null, etag: null, status: result.status };
  }
  if (!result.ok) {
    if (result.status === 408 || result.status === 0) limiter.recordTimeout();
    return { ok: false, contentLength: null, etag: null, status: result.status };
  }
  limiter.recordSuccess();
  adaptive.onSuccess();
  return {
    ok: true,
    contentLength: result.contentLength,
    etag: result.etag,
    status: result.status,
  };
}

async function runHeadSample(
  sample: CanonicalEntry[],
  limiter: GlobalRateLimiter,
  adaptive: AdaptiveConcurrency,
): Promise<HeadSampleStats> {
  const stats: HeadSampleStats = {
    sampled: sample.length,
    headOk: 0,
    headFailed: [],
    sizeMismatches: [],
    etagSamples: [],
    retries: 0,
  };

  let idx = 0;
  let active = 0;
  const started = Date.now();

  await new Promise<void>((resolve) => {
    const next = (): void => {
      while (active < adaptive.current && idx < sample.length) {
        const entry = sample[idx]!;
        idx += 1;
        active += 1;
        void (async () => {
          let head = await headWithLimiter(entry.objectKey, limiter, adaptive);
          for (let attempt = 0; !head.ok && attempt < 4; attempt += 1) {
            stats.retries += 1;
            await sleep(500 * 2 ** attempt);
            head = await headWithLimiter(entry.objectKey, limiter, adaptive);
          }
          if (!head.ok) {
            stats.headFailed.push(entry.objectKey);
            return;
          }
          stats.headOk += 1;
          if (head.etag && stats.etagSamples.length < 5) {
            stats.etagSamples.push(`${entry.objectKey}: ${head.etag}`);
          }
          if (head.contentLength !== null && head.contentLength !== entry.bytes) {
            stats.sizeMismatches.push(entry.objectKey);
          }
        })().finally(() => {
          const done = stats.headOk + stats.headFailed.length;
          if (done % 50 === 0 || done === sample.length) {
            const elapsed = ((Date.now() - started) / 1000).toFixed(1);
            heartbeatLabel = `Phase B2 HEAD ${done}/${sample.length} concurrency=${adaptive.current} elapsed=${elapsed}s`;
          }
          active -= 1;
          if (idx >= sample.length && active === 0) resolve();
          else next();
        });
      }
    };
    next();
  });

  return stats;
}

async function downloadRemoteForChecksum(objectKey: string): Promise<Buffer | null> {
  if (objectKey.includes("..")) {
    return downloadViaPlatformProxy(objectKey);
  }
  return getObjectHttp(objectKey);
}

async function runSpotChecks(picks: CanonicalEntry[]): Promise<SpotCheckStats> {
  const stats: SpotCheckStats = {
    checked: picks.length,
    verified: 0,
    checksumMismatch: [],
    sizeMismatches: [],
    missing: [],
    unableToVerify: [],
    retries: 0,
  };

  for (const entry of picks) {
    heartbeatLabel = `Phase D spot-check ${stats.verified + stats.checksumMismatch.length + stats.missing.length + stats.unableToVerify.length}/${picks.length}`;
    let bytes: Buffer | null = null;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        bytes = await downloadRemoteForChecksum(entry.objectKey);
        if (bytes) break;
      } catch {
        stats.retries += 1;
        await sleep(500 * 2 ** attempt);
      }
    }
    if (!bytes) {
      stats.unableToVerify.push(entry.objectKey);
      continue;
    }
    if (bytes.length !== entry.bytes) {
      stats.sizeMismatches.push(entry.objectKey);
      continue;
    }
    if (remoteSha256(entry.objectKey, bytes) !== entry.sha256) {
      stats.checksumMismatch.push(entry.objectKey);
    } else {
      stats.verified += 1;
    }
  }

  return stats;
}

function validateLocalExport(): Record<string, unknown> {
  const counts = {
    identities: countFiles(join(exportDir, "identities")),
    artwork: countFiles(join(exportDir, "artwork")),
    artworkRecords: countFiles(join(exportDir, "artwork-records")),
    metadata: countFiles(join(exportDir, "metadata")),
    semantic: countFiles(join(exportDir, "semantic")),
    search: countFiles(join(exportDir, "search")),
    provenance: countFiles(join(exportDir, "provenance")),
    licenses: countFiles(join(exportDir, "licenses")),
    manifests: countFiles(join(exportDir, "manifests")),
  };

  const artworkIndex = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/artwork/artwork-master-index.json"), "utf8"),
  ) as Array<{ artworkId: string; filePath: string; checksum: string }>;

  let artworkIdCollisions = 0;
  const byArtworkId = new Map<string, number>();
  for (const record of artworkIndex) {
    byArtworkId.set(record.artworkId, (byArtworkId.get(record.artworkId) ?? 0) + 1);
  }
  for (const count of byArtworkId.values()) {
    if (count > 1) artworkIdCollisions += count - 1;
  }

  const checksumGroups = new Map<string, number>();
  for (const record of artworkIndex) {
    checksumGroups.set(record.checksum, (checksumGroups.get(record.checksum) ?? 0) + 1);
  }
  let duplicateBinaryRefs = 0;
  for (const count of checksumGroups.values()) {
    if (count > 1) duplicateBinaryRefs += count - 1;
  }

  const uniqueBinaries = new Set(artworkIndex.map((r) => r.checksum)).size;
  const recordFiles = readdirSync(join(exportDir, "artwork-records"));
  const sha256KeyPattern = /^[a-f0-9]{64}\.json$/;
  const sha256KeyCount = recordFiles.filter((f) => sha256KeyPattern.test(f)).length;

  const enrichmentSize = statSync(join(rootDir, "src/data/emoji-enrichment.json")).size;
  const searchEnrichmentSize = statSync(join(rootDir, "src/data/emoji-search-enrichment.json")).size;

  return {
    counts,
    canonicalTotal:
      counts.identities +
      counts.artwork +
      counts.artworkRecords +
      counts.metadata +
      counts.semantic +
      counts.search +
      counts.provenance,
    artworkRecords: artworkIndex.length,
    uniqueBinaries,
    duplicateBinaryRefs,
    artworkIdCollisions,
    sha256KeyArchitecture: sha256KeyCount === recordFiles.length,
    sha256KeyCount,
    exportBytes: dirBytes(exportDir),
    enrichmentBytes: enrichmentSize,
    searchEnrichmentBytes: searchEnrichmentSize,
    enrichmentUnder6MB: enrichmentSize < 6_500_000,
    searchEnrichmentCompact: searchEnrichmentSize < 2_000_000,
  };
}

async function countSitemapUrls(): Promise<number> {
  try {
    const res = await fetch("https://emojiquick.com/sitemap.xml");
    const text = await res.text();
    return (text.match(/<loc>/g) ?? []).length;
  } catch {
    return 0;
  }
}

async function productionChecks(): Promise<Array<{ url: string; status: number | null; location: string | null }>> {
  const urls = [
    "https://emojiquick.com/",
    "https://emojiquick.com/emoji/fire",
    "https://emojiquick.com/emoji/keycap",
    "https://emojiquick.com/category/smileys-emotion",
    "https://emojiquick.com/sitemap.xml",
    "https://emojiquick.com/robots.txt",
  ];
  const results = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      results.push({ url, status: res.status, location: res.headers.get("location") });
    } catch {
      results.push({ url, status: null, location: null });
    }
  }
  return results;
}

function readPhase844Tests(): Record<string, unknown> | null {
  if (!existsSync(phase844Path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(phase844Path, "utf8")) as { tests?: Record<string, unknown> };
    return parsed.tests ?? null;
  } catch {
    return null;
  }
}

function checksumStrategyDoc(): Record<string, unknown> {
  return {
    phase: "C",
    title: "Checksum verification strategy (FAST 8.51)",
    serverSha256: false,
    serverSha256Note: "Cloudflare R2 does not expose per-object SHA-256 checksums via the REST API.",
    etagIsSha256: false,
    etagNote: "R2 ETag values are opaque identifiers (often MD5-based for single-part uploads), not SHA-256.",
    fullContentSha256OnAllObjects: false,
    fullContentSha256Note:
      "Phase 8.50 performs full SHA-256 on all 114,498 objects; Phase 8.51 FAST uses list metadata size checks, HEAD sampling, and category spot checks only.",
    spotCheckSha256: true,
    spotCheckNote: "Phase D downloads ~10 representative objects and verifies SHA-256 against r2-checksums.sha256.",
    jsonTextNormalization:
      "JSON/md/txt objects strip trailing newline before SHA-256 to match export manifest conventions.",
    headSampleSize: HEAD_SAMPLE_SIZE,
    headConcurrency: { min: HEAD_MIN_CONCURRENCY, start: HEAD_START_CONCURRENCY, max: HEAD_MAX_CONCURRENCY },
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  startHeartbeat();
  heartbeatLabel = "Phase 8.51 FAST verify starting";
  log("Phase 8.51 FAST READ-ONLY R2 verification starting");

  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) throw new Error(account.message);
  if (!bucketExists(rootDir, R2_BUCKET_NAME)) throw new Error(`Bucket ${R2_BUCKET_NAME} not found`);

  // Phase E: frozen 8.10
  heartbeatLabel = "Phase E frozen 8.10 checksums";
  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, frozenChecksums);

  // Phase H: R2 privacy
  heartbeatLabel = "Phase H R2 bucket privacy";
  const bucketInfo = runWranglerWithRetry(["r2", "bucket", "info", R2_BUCKET_NAME], rootDir);
  const infoOut = `${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase();
  const publicAccess = infoOut.includes("public access: true");

  const entries = loadCanonicalEntries();
  const expectedKeys = new Set(entries.map((e) => e.objectKey));
  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);

  // Phase A: remote list (cache from 8.50 or REST list)
  heartbeatLabel = "Phase A remote object list";
  log("Phase A: loading remote object list");
  let remoteMap: Map<string, number>;
  let listConflicts: string[];
  const forceRemoteList = process.env.R2_FORCE_REMOTE_LIST === "1";
  if (existsSync(remoteListCachePath) && !forceRemoteList) {
    const cached = JSON.parse(readFileSync(remoteListCachePath, "utf8")) as {
      objects: Array<{ key: string; size: number }>;
      conflicts?: string[];
    };
    remoteMap = new Map(cached.objects.map((o) => [o.key, o.size]));
    listConflicts = cached.conflicts ?? [];
    log(`Loaded remote list cache: ${remoteMap.size} objects from ${remoteListCachePath}`);
  } else {
    const listed = await listAllRemoteObjects();
    remoteMap = listed.map;
    listConflicts = listed.conflicts;
    if (process.env.R2_SKIP_REMOTE_LIST !== "1") {
      writeFileSync(
        remoteListCachePath,
        `${JSON.stringify({
          generatedAt: new Date().toISOString(),
          count: remoteMap.size,
          objects: [...remoteMap.entries()].map(([key, size]) => ({ key, size })),
          conflicts: listConflicts,
        })}\n`,
        "utf8",
      );
    }
  }
  const restListCount = remoteMap.size;

  // Phase B: size from list metadata + dot-key binding probe
  heartbeatLabel = "Phase B size verification + dot-key probe";
  const dotKeyProbe = await augmentRemoteMapWithDotKeys(remoteMap, entries);
  const remoteKeys = [...remoteMap.keys()];
  const canonicalPresent = entries.filter((entry) => remoteMap.has(entry.objectKey)).length;

  const missingObjects = entries.filter((e) => !remoteMap.has(e.objectKey)).map((e) => e.objectKey);
  const unexpectedObjects = remoteKeys.filter((key) => !expectedKeys.has(key));

  const listSizeMismatches: string[] = [];
  for (const entry of entries) {
    const remoteSize = remoteMap.get(entry.objectKey);
    if (remoteSize === undefined) continue;
    if (remoteSize !== entry.bytes) listSizeMismatches.push(entry.objectKey);
  }

  // Phase C: document checksum strategy (no network)
  const checksumStrategy = checksumStrategyDoc();
  log("Phase C: checksum strategy documented (no full-object SHA-256 in FAST mode)");

  // Phase B2: HEAD sample
  heartbeatLabel = "Phase B2 HEAD sample";
  const headSample = pickHeadSample(entries, HEAD_SAMPLE_SIZE);
  const limiter = new GlobalRateLimiter();
  const adaptive = new AdaptiveConcurrency(HEAD_MIN_CONCURRENCY, HEAD_START_CONCURRENCY, HEAD_MAX_CONCURRENCY);
  log(`Phase B2: HEAD sample of ${headSample.length} objects (concurrency ${HEAD_MIN_CONCURRENCY}-${HEAD_MAX_CONCURRENCY})`);
  const headStats = await runHeadSample(headSample, limiter, adaptive);

  const sizeMismatches = [...new Set([...listSizeMismatches, ...headStats.sizeMismatches])];

  // Phase D: spot checks
  heartbeatLabel = "Phase D spot-check SHA-256";
  const spotPicks = pickSpotChecks(entries);
  log(`Phase D: spot-check SHA-256 on ${spotPicks.length} objects across categories`);
  const spotStats = await runSpotChecks(spotPicks);

  // Phase I: category counts
  heartbeatLabel = "Phase I category counts";
  const categoryCounts = {
    identities: countCanonicalPrefix(entries, remoteMap, "identities/"),
    metadata: countCanonicalPrefix(entries, remoteMap, "metadata/"),
    semantic: countCanonicalPrefix(entries, remoteMap, "semantic/"),
    search: countCanonicalPrefix(entries, remoteMap, "search/"),
    provenance: countCanonicalPrefix(entries, remoteMap, "provenance/"),
    artwork: countCanonicalPrefix(entries, remoteMap, "artwork/"),
    artworkRecords: countCanonicalPrefix(entries, remoteMap, "artwork-records/"),
    manifests: countPrefix(remoteKeys, "manifests/"),
    licenses: countPrefix(remoteKeys, "licenses/"),
  };

  const local = validateLocalExport();

  // Phase F: production HTTP
  heartbeatLabel = "Phase F production HTTP";
  const production = await productionChecks();
  const keycap = production.find((e) => e.url.includes("/emoji/keycap"));
  const sitemapUrlCount = await countSitemapUrls();
  const phase844Tests = readPhase844Tests();

  // Phase G: SEO flags
  heartbeatLabel = "Phase G SEO rollout flags";
  const seoMode = parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE);

  const exportManifest = JSON.parse(
    readFileSync(join(exportDir, "manifests", "r2-export-manifest.json"), "utf8"),
  ) as { licenseClassifications?: unknown };

  const elapsedMs = Date.now() - startMs;
  const elapsedSec = elapsedMs / 1000;

  const unexpectedSorted = [...unexpectedObjects].sort();
  const expectedUnexpectedSorted = [...EXPECTED_UNEXPECTED].sort();
  const unexpectedMatchesExpected =
    unexpectedSorted.length === expectedUnexpectedSorted.length &&
    unexpectedSorted.every((k, i) => k === expectedUnexpectedSorted[i]);

  const productionHttpPass =
    keycap?.status === 200 &&
    !keycap?.location &&
    production.every((e) => e.status === 200);

  const scores = {
    canonicalPresent: canonicalPresent === EXPECTED_OBJECTS,
    missingZero: missingObjects.length === 0,
    unexpectedExpected: unexpectedMatchesExpected,
    remoteTotal: remoteMap.size === EXPECTED_OBJECTS + EXPECTED_UNEXPECTED.length,
    conflictsZero: listConflicts.length === 0,
    listSizeMismatchesZero: listSizeMismatches.length === 0,
    headSamplePass: headStats.headFailed.length === 0 && headStats.sizeMismatches.length === 0,
    spotChecksPass:
      spotStats.checksumMismatch.length === 0 &&
      spotStats.sizeMismatches.length === 0 &&
      spotStats.unableToVerify.length === 0 &&
      spotStats.verified === spotPicks.length,
    identities: categoryCounts.identities === MASTER_IDENTITY_COUNT,
    artworkRecords: categoryCounts.artworkRecords === MASTER_ARTWORK_RECORD_COUNT,
    uniqueArtworkBinaries: categoryCounts.artwork === UNIQUE_ARTWORK,
    duplicateBinaryRefs: (local.duplicateBinaryRefs as number) === DUPLICATE_REFS,
    artworkIdCollisionsZero: (local.artworkIdCollisions as number) === 0,
    metadata: categoryCounts.metadata === MASTER_IDENTITY_COUNT,
    semantic: categoryCounts.semantic === MASTER_IDENTITY_COUNT,
    search: categoryCounts.search === MASTER_IDENTITY_COUNT,
    provenance: categoryCounts.provenance === MASTER_IDENTITY_COUNT,
    r2Private: !publicAccess,
    productionFlagsOff:
      !MASTER_INTEGRATION_CONFIG.masterSEOEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterArtworkEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterMetadataEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    canaryOff: seoMode === "OFF",
    fullOff: seoMode === "OFF",
    frozenIntegrity: frozen.status === "PASS",
    productionHttp: productionHttpPass,
    localDataIntegrity:
      (local.counts as { identities: number }).identities === MASTER_IDENTITY_COUNT &&
      (local.artworkRecords as number) === MASTER_ARTWORK_RECORD_COUNT &&
      (local.uniqueBinaries as number) === UNIQUE_ARTWORK &&
      (local.duplicateBinaryRefs as number) === DUPLICATE_REFS &&
      (local.canonicalTotal as number) +
        (local.counts as { licenses: number; manifests: number }).licenses +
        (local.counts as { licenses: number; manifests: number }).manifests === EXPECTED_OBJECTS,
    sitemap: sitemapUrlCount === PUBLIC_SITEMAP_URL_COUNT,
  };

  const passCount = Object.values(scores).filter(Boolean).length;
  const totalCriteria = Object.keys(scores).length;
  const allPass = passCount === totalCriteria;
  const finalDecision =
    allPass ? "PASS" : canonicalPresent < EXPECTED_OBJECTS ? "INCOMPLETE" : "FAIL";

  if (platformProxy) {
    await platformProxy.dispose();
    platformProxy = null;
  }

  stopHeartbeat();

  const verification = {
    phase: "8.51",
    mode: "FAST",
    startedAt,
    completedAt: new Date().toISOString(),
    elapsedMs,
    elapsedSec: Number(elapsedSec.toFixed(1)),
    method:
      "REST list (or cache) + list-metadata size + MASTER_R2 dot-key probe + HEAD sample + spot SHA-256",
    expected: EXPECTED_OBJECTS,
    restListCount,
    bindingAugmented: dotKeyProbe.augmented,
    dotKeysProbed: dotKeyProbe.probed,
    canonicalPresent,
    remoteObjects: remoteMap.size,
    missing: missingObjects.length,
    unexpected: unexpectedObjects.length,
    conflicts: listConflicts.length,
    listSizeMismatches: listSizeMismatches.length,
    headSample: {
      size: headStats.sampled,
      headOk: headStats.headOk,
      headFailed: headStats.headFailed.length,
      sizeMismatches: headStats.sizeMismatches.length,
      etagSamples: headStats.etagSamples,
      retries: headStats.retries,
      concurrencyFinal: adaptive.current,
    },
    spotChecks: {
      picked: spotPicks.length,
      verified: spotStats.verified,
      checksumMismatch: spotStats.checksumMismatch.length,
      sizeMismatches: spotStats.sizeMismatches.length,
      unableToVerify: spotStats.unableToVerify.length,
      retries: spotStats.retries,
    },
    checksumStrategy,
    sizeMismatchesTotal: sizeMismatches.length,
    checksumMismatches: spotStats.checksumMismatch.length,
    frozen: frozen.status,
    r2Privacy: publicAccess ? "PUBLIC" : "PRIVATE",
    productionHttp: productionHttpPass,
    finalDecision,
  };

  const reconciliation = {
    phase: "8.51",
    mode: "FAST",
    generatedAt: verification.completedAt,
    startedAt,
    elapsedMs,
    expectedObjects: EXPECTED_OBJECTS,
    expectedUnexpected: [...EXPECTED_UNEXPECTED],
    restListCount,
    bindingAugmented: dotKeyProbe.augmented,
    bindingMissing: dotKeyProbe.bindingMissing,
    dotKeysProbed: dotKeyProbe.probed,
    canonicalPresent,
    remoteObjects: remoteMap.size,
    missingObjects,
    unexpectedObjects,
    unexpectedMatchesExpected,
    conflicts: listConflicts,
    listSizeMismatches,
    headSampleMismatches: headStats.sizeMismatches,
    headFailed: headStats.headFailed,
    sizeMismatches,
    checksumMismatches: spotStats.checksumMismatch,
    spotCheckUnableToVerify: spotStats.unableToVerify,
    spotChecksVerified: spotStats.verified,
    spotCheckPicks: spotPicks.map((e) => e.objectKey),
    checksumStrategy,
    categoryCounts,
    identities: { expected: MASTER_IDENTITY_COUNT, remote: categoryCounts.identities },
    artworkRecords: { expected: MASTER_ARTWORK_RECORD_COUNT, remote: categoryCounts.artworkRecords },
    uniqueArtworkBinaries: { expected: UNIQUE_ARTWORK, remote: categoryCounts.artwork },
    duplicateBinaryReferences: { expected: DUPLICATE_REFS, local: local.duplicateBinaryRefs },
    metadata: { expected: MASTER_IDENTITY_COUNT, remote: categoryCounts.metadata },
    semantic: { expected: MASTER_IDENTITY_COUNT, remote: categoryCounts.semantic },
    search: { expected: MASTER_IDENTITY_COUNT, remote: categoryCounts.search },
    provenance: { expected: MASTER_IDENTITY_COUNT, remote: categoryCounts.provenance },
    licenses: { remote: categoryCounts.licenses },
    manifests: { remote: categoryCounts.manifests },
    artworkIdCollisions: local.artworkIdCollisions,
    sha256KeyArchitecture: local.sha256KeyArchitecture,
    totalBytes,
    storageGB: Number((totalBytes / 1e9).toFixed(4)),
    storageGiB: Number((totalBytes / 1024 ** 3).toFixed(4)),
    allowanceGB: 10,
    utilizationPercent: Number(((totalBytes / 10_000_000_000) * 100).toFixed(4)),
    remainingGB: Number(((10_000_000_000 - totalBytes) / 1e9).toFixed(4)),
    privacy: publicAccess ? "PUBLIC" : "PRIVATE",
    license: exportManifest.licenseClassifications,
    frozenRelease: { status: frozen.status, pass: `${frozen.byteIdentical}/${frozen.filesCompared}` },
    seo: {
      MASTER_SEO_ROLLOUT_MODE: seoMode,
      masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
      masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
      masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    },
    production: { checks: production, keycapNoRedirect: keycap?.status === 200 && !keycap?.location },
    sitemap: { expected: PUBLIC_SITEMAP_URL_COUNT, actual: sitemapUrlCount, pass: sitemapUrlCount === PUBLIC_SITEMAP_URL_COUNT },
    tests: phase844Tests,
    readinessScores: scores,
    finalScore: `${passCount}/${totalCriteria}`,
    overallStatus: finalDecision,
  };

  writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  writeFileSync(reconciliationPath, `${JSON.stringify(reconciliation, null, 2)}\n`, "utf8");

  const report = [
    "# Phase 8.51 — FAST R2 Verification",
    "",
    `Generated: ${verification.completedAt}`,
    `Started: ${startedAt}`,
    `Elapsed: ${verification.elapsedSec}s`,
    "",
    "## Executive Result",
    `**${finalDecision}** (${passCount}/${totalCriteria} criteria met)`,
    "",
    "## Phase A — Remote List",
    `- REST list count: ${restListCount}`,
    `- Cache: ${remoteListCachePath}`,
    `- Remote total (after dot-key probe): ${remoteMap.size}`,
    `- Conflicts: ${listConflicts.length}`,
    "",
    "## Phase B — Size Verification (list metadata + dot-keys)",
    `- Canonical present: ${canonicalPresent} / ${EXPECTED_OBJECTS}`,
    `- Missing: ${missingObjects.length}`,
    `- List size mismatches: ${listSizeMismatches.length}`,
    `- Dot-keys probed: ${dotKeyProbe.probed}`,
    `- Dot-keys augmented: ${dotKeyProbe.augmented}`,
    `- Dot-keys missing: ${dotKeyProbe.bindingMissing.length}`,
    "",
    "## Phase B2 — HEAD Sample",
    `- Sample size: ${headStats.sampled}`,
    `- HEAD OK: ${headStats.headOk}`,
    `- HEAD failed: ${headStats.headFailed.length}`,
    `- Size mismatches: ${headStats.sizeMismatches.length}`,
    `- Concurrency final: ${adaptive.current}`,
    `- ETag samples: ${headStats.etagSamples.join("; ") || "none"}`,
    "",
    "## Phase C — Checksum Strategy",
    "- R2 REST API does **not** provide server-side SHA-256 checksums",
    "- ETag is **not** SHA-256 (opaque / MD5-style for single-part uploads)",
    "- Full content SHA-256 on all 114,498 objects is **not** performed in FAST mode",
    "- Spot-check SHA-256 downloads verify representative objects against r2-checksums.sha256",
    "",
    "## Phase D — Spot Checks (SHA-256)",
    `- Picked: ${spotPicks.length}`,
    `- Verified: ${spotStats.verified}`,
    `- Checksum mismatches: ${spotStats.checksumMismatch.length}`,
    `- Size mismatches: ${spotStats.sizeMismatches.length}`,
    `- Unable to verify: ${spotStats.unableToVerify.length}`,
    "",
    "## Phase E — Frozen Release 8.10",
    `- ${frozen.byteIdentical}/${frozen.filesCompared} ${frozen.status}`,
    "",
    "## Phase F — Production HTTP",
    ...production.map((e) => `- ${e.url} -> ${e.status}${e.location ? ` Location:${e.location}` : ""}`),
    "",
    "## Phase G — SEO / Rollout",
    `- MASTER_SEO_ROLLOUT_MODE: ${seoMode}`,
    `- masterSEOEnabled: ${MASTER_INTEGRATION_CONFIG.masterSEOEnabled}`,
    `- masterArtworkEnabled: ${MASTER_INTEGRATION_CONFIG.masterArtworkEnabled}`,
    `- masterMetadataEnabled: ${MASTER_INTEGRATION_CONFIG.masterMetadataEnabled}`,
    `- masterSearchEnabled: ${MASTER_INTEGRATION_CONFIG.masterSearchEnabled}`,
    "",
    "## Phase H — R2 Privacy",
    `- Bucket: ${R2_BUCKET_NAME}`,
    `- Privacy: ${publicAccess ? "PUBLIC" : "PRIVATE"}`,
    "",
    "## Phase I — Category Counts (remote)",
    ...Object.entries(categoryCounts).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Unexpected Objects (expected 3)",
    ...unexpectedObjects.map((k) => `- ${k}`),
  ].join("\n");

  writeFileSync(reportPath, `${report}\n`, "utf8");

  console.log("");
  console.log("PHASE 8.51 COMPLETE");
  console.log(`Expected: ${EXPECTED_OBJECTS}`);
  console.log(`Remote: ${remoteMap.size}`);
  console.log(`Missing: ${missingObjects.length}`);
  console.log(`Unexpected: ${unexpectedObjects.length}`);
  console.log(`Size mismatches: ${sizeMismatches.length}`);
  console.log(`Checksum mismatches: ${spotStats.checksumMismatch.length}`);
  console.log(`R2 privacy: ${publicAccess ? "PUBLIC" : "PRIVATE"}`);
  console.log(`Frozen: ${frozen.status}`);
  console.log(`Production: ${productionHttpPass ? "PASS" : "FAIL"}`);
  console.log(`FINAL: ${finalDecision} (${passCount}/${totalCriteria})`);
  console.log("");

  log(
    `Phase 8.51 FAST complete: ${finalDecision} — canonical ${canonicalPresent}/${EXPECTED_OBJECTS}, remote ${remoteMap.size}`,
  );
}

main().catch(async (error: unknown) => {
  stopHeartbeat();
  if (platformProxy) {
    await platformProxy.dispose();
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Phase 8.51 FAST verification failed: ${message}`);
  if (error instanceof Error && error.stack) {
    console.error(error.stack);
  }
  process.exitCode = 1;
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection in phase-8-51-fast-verify:", reason);
  process.exitCode = 1;
});
