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
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../../src/lib/master/r2/catalog";
import {
  R2_ACCOUNT_ID,
  getObjectHttp,
  readWranglerOAuthToken,
} from "./r2-http-client";
import {
  R2_BUCKET_NAME,
  bucketExists,
  isR2AccountEnabled,
  runWranglerWithRetry,
} from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const VERIFY_CONCURRENCY = 12;

const verificationPath = join(exportDir, "manifests", "r2-phase-8-50-verification.json");
const reconciliationPath = join(exportDir, "manifests", "r2-phase-8-50-reconciliation.json");
const reportPath = join(exportDir, "PHASE-8.50-R2-FINAL-VERIFICATION.md");
const phase844Path = join(exportDir, "manifests", "r2-phase-8-44-final.json");
const wranglerConfigPath = join(rootDir, "wrangler.jsonc");

const API_LIST_BASE = `https://api.cloudflare.com/client/v4/accounts/${R2_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects`;

interface CanonicalEntry {
  objectKey: string;
  sha256: string;
  bytes: number;
}

interface VerifyStats {
  verified: number;
  checksumMismatch: string[];
  missing: string[];
  unableToVerify: string[];
  retries: number;
}

type R2BucketLike = {
  get(key: string): Promise<{ arrayBuffer(): Promise<ArrayBuffer> } | null>;
};

type MasterR2Env = { MASTER_R2: R2BucketLike };

let platformProxy: Awaited<ReturnType<typeof getPlatformProxy<MasterR2Env>>> | null = null;

function sha256Buf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string): void {
  console.log(`[${new Date().toISOString()}] ${message}`);
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
  const token = readWranglerOAuthToken();
  let lastError = "unknown";
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(Number(process.env.R2_HTTP_TIMEOUT_MS ?? "90000")),
      });
      const body = await res.clone().text();
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
    log(`Listed remote objects page ${page}: cumulative ${map.size}`);

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

async function downloadRemoteForChecksum(objectKey: string): Promise<Buffer | null> {
  if (objectKey.includes("..")) {
    return downloadViaPlatformProxy(objectKey);
  }
  return getObjectHttp(objectKey);
}

async function downloadWithRetry(objectKey: string, stats: VerifyStats, maxAttempts = 6): Promise<Buffer | null> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const bytes = await downloadRemoteForChecksum(objectKey);
      if (bytes) return bytes;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isRetryableHttp(0, message) && attempt >= maxAttempts - 1) return null;
    }
    stats.retries += 1;
    await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 250));
  }
  return null;
}

async function verifyChecksums(
  entries: CanonicalEntry[],
  remoteMap: Map<string, number>,
  concurrency = VERIFY_CONCURRENCY,
): Promise<VerifyStats> {
  const stats: VerifyStats = {
    verified: 0,
    checksumMismatch: [],
    missing: [],
    unableToVerify: [],
    retries: 0,
  };
  let idx = 0;
  let active = 0;
  const started = Date.now();

  await new Promise<void>((resolve) => {
    const next = (): void => {
      while (active < concurrency && idx < entries.length) {
        const entry = entries[idx]!;
        idx += 1;
        active += 1;
        void (async () => {
          if (!remoteMap.has(entry.objectKey)) {
            stats.missing.push(entry.objectKey);
            return;
          }
          const remote = await downloadWithRetry(entry.objectKey, stats);
          if (!remote) {
            stats.unableToVerify.push(entry.objectKey);
            return;
          }
          if (remote.length !== entry.bytes) {
            return;
          }
          if (remoteSha256(entry.objectKey, remote) !== entry.sha256) {
            stats.checksumMismatch.push(entry.objectKey);
          } else {
            stats.verified += 1;
          }
        })().finally(() => {
          const done =
            stats.verified +
            stats.checksumMismatch.length +
            stats.missing.length +
            stats.unableToVerify.length;
          if (done % 500 === 0 || done === entries.length) {
            const elapsed = ((Date.now() - started) / 1000).toFixed(1);
            const rate = done > 0 ? (done / ((Date.now() - started) / 1000)).toFixed(1) : "0";
            log(`Checksum verify: ${done}/${entries.length} (${rate}/s, ${elapsed}s elapsed)`);
          }
          active -= 1;
          if (idx >= entries.length && active === 0) resolve();
          else next();
        });
      }
    };
    next();
  });

  return stats;
}

function countPrefix(keys: Iterable<string>, prefix: string): number {
  let count = 0;
  for (const key of keys) {
    if (key.startsWith(prefix)) count += 1;
  }
  return count;
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

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const startMs = Date.now();
  log("Phase 8.50 READ-ONLY R2 verification starting");

  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) throw new Error(account.message);
  if (!bucketExists(rootDir, R2_BUCKET_NAME)) throw new Error(`Bucket ${R2_BUCKET_NAME} not found`);

  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, frozenChecksums);
  if (frozen.status !== "PASS") {
    throw new Error("HARD STOP: frozen 8.10 checksum failure");
  }

  const bucketInfo = runWranglerWithRetry(["r2", "bucket", "info", R2_BUCKET_NAME], rootDir);
  const infoOut = `${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase();
  const publicAccess = infoOut.includes("public access: true");
  if (publicAccess) {
    throw new Error("HARD STOP: bucket public access enabled");
  }

  const entries = loadCanonicalEntries();
  const expectedKeys = new Set(entries.map((e) => e.objectKey));
  const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);

  log("Listing all remote objects via Cloudflare API");
  const { map: remoteMap, conflicts: listConflicts } = await listAllRemoteObjects();
  const remoteKeys = [...remoteMap.keys()];

  const missingObjects = entries.filter((e) => !remoteMap.has(e.objectKey)).map((e) => e.objectKey);
  const unexpectedObjects = remoteKeys.filter((key) => !expectedKeys.has(key));

  const sizeMismatches: string[] = [];
  for (const entry of entries) {
    const remoteSize = remoteMap.get(entry.objectKey);
    if (remoteSize === undefined) continue;
    if (remoteSize !== entry.bytes) sizeMismatches.push(entry.objectKey);
  }

  log("Starting full SHA-256 checksum verification");
  const checksumStats = await verifyChecksums(entries, remoteMap);

  const categoryCounts = {
    identities: countPrefix(remoteKeys, "identities/"),
    metadata: countPrefix(remoteKeys, "metadata/"),
    semantic: countPrefix(remoteKeys, "semantic/"),
    search: countPrefix(remoteKeys, "search/"),
    provenance: countPrefix(remoteKeys, "provenance/"),
    artwork: countPrefix(remoteKeys, "artwork/"),
    artworkRecords: countPrefix(remoteKeys, "artwork-records/"),
    manifests: countPrefix(remoteKeys, "manifests/"),
    licenses: countPrefix(remoteKeys, "licenses/"),
  };

  const local = validateLocalExport();
  const production = await productionChecks();
  const keycap = production.find((e) => e.url.includes("/emoji/keycap"));
  const sitemapUrlCount = await countSitemapUrls();
  const phase844Tests = readPhase844Tests();

  const exportManifest = JSON.parse(
    readFileSync(join(exportDir, "manifests", "r2-export-manifest.json"), "utf8"),
  ) as { licenseClassifications?: unknown };

  const seoMode = parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE);
  const elapsedMs = Date.now() - startMs;
  const elapsedSec = elapsedMs / 1000;
  const verifyThroughput = checksumStats.verified > 0 ? checksumStats.verified / elapsedSec : 0;

  const scores = {
    objectCount: remoteMap.size === EXPECTED_OBJECTS,
    missingZero: missingObjects.length === 0 && checksumStats.missing.length === 0,
    unexpectedZero: unexpectedObjects.length === 0,
    conflictsZero: listConflicts.length === 0,
    sizeMismatchesZero: sizeMismatches.length === 0,
    checksumsVerified:
      checksumStats.verified === EXPECTED_OBJECTS &&
      checksumStats.checksumMismatch.length === 0 &&
      checksumStats.unableToVerify.length === 0,
    identities: categoryCounts.identities === MASTER_IDENTITY_COUNT,
    artworkRecords: categoryCounts.artworkRecords === MASTER_ARTWORK_RECORD_COUNT,
    uniqueArtworkBinaries: categoryCounts.artwork === 39_652,
    duplicateBinaryRefs: (local.duplicateBinaryRefs as number) === 419,
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
    productionHttp:
      keycap?.status === 200 &&
      !keycap?.location &&
      production.every((e) => e.status === 200),
    localDataIntegrity:
      (local.counts as { identities: number }).identities === MASTER_IDENTITY_COUNT &&
      (local.artworkRecords as number) === MASTER_ARTWORK_RECORD_COUNT &&
      (local.uniqueBinaries as number) === 39_652 &&
      (local.duplicateBinaryRefs as number) === 419 &&
      (local.canonicalTotal as number) +
        (local.counts as { licenses: number; manifests: number }).licenses +
        (local.counts as { licenses: number; manifests: number }).manifests === EXPECTED_OBJECTS,
  };

  const passCount = Object.values(scores).filter(Boolean).length;
  const totalCriteria = Object.keys(scores).length;
  const allPass = passCount === totalCriteria;
  const finalDecision = allPass ? "PASS" : remoteMap.size < EXPECTED_OBJECTS ? "INCOMPLETE" : "FAIL";

  if (platformProxy) {
    await platformProxy.dispose();
    platformProxy = null;
  }

  const verification = {
    phase: "8.50",
    startedAt,
    completedAt: new Date().toISOString(),
    elapsedMs,
    elapsedSec: Number(elapsedSec.toFixed(1)),
    method: "Cloudflare R2 API list + HTTP GET SHA-256 (JSON/md/txt strip trailing newline)",
    expected: EXPECTED_OBJECTS,
    remoteObjects: remoteMap.size,
    verified: checksumStats.verified,
    checksumMismatch: checksumStats.checksumMismatch.length,
    missing: missingObjects.length,
    unableToVerify: checksumStats.unableToVerify.length,
    sizeMismatches: sizeMismatches.length,
    unexpected: unexpectedObjects.length,
    conflicts: listConflicts.length,
    retries: checksumStats.retries,
    verifyThroughputPerSec: Number(verifyThroughput.toFixed(2)),
    sampleChecksumMismatches: checksumStats.checksumMismatch.slice(0, 20),
    sampleUnableToVerify: checksumStats.unableToVerify.slice(0, 20),
    sampleMissing: missingObjects.slice(0, 20),
    sampleUnexpected: unexpectedObjects.slice(0, 20),
    finalDecision,
  };

  const reconciliation = {
    phase: "8.50",
    generatedAt: verification.completedAt,
    startedAt,
    elapsedMs,
    expectedObjects: EXPECTED_OBJECTS,
    remoteObjects: remoteMap.size,
    missingObjects,
    unexpectedObjects,
    conflicts: listConflicts,
    sizeMismatches,
    checksumMismatches: checksumStats.checksumMismatch,
    unableToVerify: checksumStats.unableToVerify,
    verified: checksumStats.verified,
    categoryCounts,
    identities: { expected: MASTER_IDENTITY_COUNT, remote: categoryCounts.identities },
    artworkRecords: { expected: MASTER_ARTWORK_RECORD_COUNT, remote: categoryCounts.artworkRecords },
    uniqueArtworkBinaries: { expected: 39_652, remote: categoryCounts.artwork },
    duplicateBinaryReferences: { expected: 419, local: local.duplicateBinaryRefs },
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
    sitemap: { expected: 4522, actual: sitemapUrlCount, pass: sitemapUrlCount === 4522 },
    tests: phase844Tests,
    readinessScores: scores,
    finalScore: `${passCount}/${totalCriteria}`,
    overallStatus: finalDecision,
  };

  writeFileSync(verificationPath, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  writeFileSync(reconciliationPath, `${JSON.stringify(reconciliation, null, 2)}\n`, "utf8");

  const report = [
    "# Phase 8.50 — R2 Final Verification",
    "",
    `Generated: ${verification.completedAt}`,
    `Started: ${startedAt}`,
    `Elapsed: ${verification.elapsedSec}s`,
    "",
    "## Executive Result",
    `**${finalDecision}** (${passCount}/${totalCriteria} criteria met)`,
    "",
    "## Object Count",
    `- Expected: ${EXPECTED_OBJECTS}`,
    `- Remote: ${remoteMap.size}`,
    `- Missing: ${missingObjects.length}`,
    `- Unexpected: ${unexpectedObjects.length}`,
    `- Conflicts: ${listConflicts.length}`,
    "",
    "## Size Verification",
    `- Size mismatches: ${sizeMismatches.length}`,
    "",
    "## Checksum Verification",
    `- Verified: ${checksumStats.verified}`,
    `- Checksum mismatches: ${checksumStats.checksumMismatch.length}`,
    `- Unable to verify: ${checksumStats.unableToVerify.length}`,
    `- Retries: ${checksumStats.retries}`,
    `- Throughput: ${verification.verifyThroughputPerSec}/s`,
    "",
    "## Category Counts (remote)",
    ...Object.entries(categoryCounts).map(([k, v]) => `- ${k}: ${v}`),
    "",
    "## Identity Coverage",
    `- ${categoryCounts.identities} / ${MASTER_IDENTITY_COUNT}`,
    "",
    "## Artwork",
    `- Records: ${categoryCounts.artworkRecords} / ${MASTER_ARTWORK_RECORD_COUNT}`,
    `- Unique binaries: ${categoryCounts.artwork} / 39652`,
    `- Duplicate refs (local): ${local.duplicateBinaryRefs} / 419`,
    `- Artwork ID collisions: ${local.artworkIdCollisions}`,
    `- SHA-256 key architecture: ${local.sha256KeyArchitecture ? "PASS" : "FAIL"}`,
    "",
    "## Metadata / Semantic / Search / Provenance",
    `- Metadata: ${categoryCounts.metadata} / ${MASTER_IDENTITY_COUNT}`,
    `- Semantic: ${categoryCounts.semantic} / ${MASTER_IDENTITY_COUNT}`,
    `- Search: ${categoryCounts.search} / ${MASTER_IDENTITY_COUNT}`,
    `- Provenance: ${categoryCounts.provenance} / ${MASTER_IDENTITY_COUNT}`,
    "",
    "## Security & Privacy",
    `- Bucket: ${R2_BUCKET_NAME}`,
    `- Privacy: ${publicAccess ? "PUBLIC" : "PRIVATE"}`,
    `- Public access: ${publicAccess ? "ENABLED" : "DISABLED"}`,
    "",
    "## Frozen Release 8.10",
    `- ${frozen.byteIdentical}/${frozen.filesCompared} ${frozen.status}`,
    "",
    "## Production HTTP",
    ...production.map((e) => `- ${e.url} -> ${e.status}${e.location ? ` Location:${e.location}` : ""}`),
    "",
    "## SEO / Rollout",
    `- CANARY: ${seoMode}`,
    `- masterSEOEnabled: ${MASTER_INTEGRATION_CONFIG.masterSEOEnabled}`,
    `- masterArtworkEnabled: ${MASTER_INTEGRATION_CONFIG.masterArtworkEnabled}`,
    "",
    "## Readiness Criteria",
    ...Object.entries(scores).map(([k, v]) => `- ${k}: ${v ? "PASS" : "FAIL"}`),
    "",
    `## Final Decision: **${finalDecision}**`,
  ].join("\n");

  writeFileSync(reportPath, `${report}\n`, "utf8");

  log(
    `Phase 8.50 complete: ${finalDecision} (${passCount}/${totalCriteria}) — remote ${remoteMap.size}/${EXPECTED_OBJECTS}, verified ${checksumStats.verified}/${EXPECTED_OBJECTS}`,
  );
}

main().catch(async (error: unknown) => {
  if (platformProxy) {
    await platformProxy.dispose();
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
