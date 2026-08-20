import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { verifyFrozenChecksums } from "../../src/lib/master/release/build";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";
import { R2_BUCKET_NAME, bucketExists, isR2AccountEnabled, runWranglerWithRetry } from "./wrangler-r2";
import { putObjectWithRetry } from "./r2-http-client";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const MIN_CONCURRENCY = 8;
const START_CONCURRENCY = 20;
const MAX_CONCURRENCY = 48;
const MAX_RETRIES = 8;

type ObjectStatus = "UPLOADED" | "EXISTING_MATCH" | "FAILED";

interface ManifestEntry {
  objectKey: string;
  sha256: string;
  localPath: string;
  bytes: number;
  contentType: string;
}

interface ProgressState {
  phase: string;
  startedAt: string;
  updatedAt: string;
  total: number;
  uploaded: number;
  existingMatch: number;
  skipped: number;
  failed: number;
  retried: number;
  bytesUploaded: number;
  bytesVerified: number;
  lastCompletedObject: string | null;
  completed: Record<string, ObjectStatus | string>;
  failures: Array<{ objectKey: string; error: string }>;
  uploadEngine?: string;
  concurrency?: number;
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".json": return "application/json";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    default: return "application/octet-stream";
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadManifest(): ManifestEntry[] {
  const lines = readFileSync(join(exportDir, "manifests", "r2-checksums.sha256"), "utf8").split(/\r?\n/).filter(Boolean);
  const entries: ManifestEntry[] = [];
  for (const line of lines) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    if (!match) throw new Error(`Invalid checksum line: ${line.slice(0, 80)}`);
    const [, sha256, objectKey] = match;
    const localPath = join(exportDir, ...objectKey.split("/"));
    if (!existsSync(localPath)) throw new Error(`Missing local file: ${objectKey}`);
    entries.push({
      objectKey,
      sha256,
      localPath,
      bytes: statSync(localPath).size,
      contentType: contentTypeFor(localPath),
    });
  }
  if (entries.length !== EXPECTED_OBJECTS) throw new Error(`Manifest count ${entries.length} !== ${EXPECTED_OBJECTS}`);
  return entries;
}

function reconcileProgressCounts(progress: ProgressState): void {
  let uploaded = 0;
  let existingMatch = 0;
  let failed = 0;
  for (const status of Object.values(progress.completed)) {
    if (status === "UPLOADED") uploaded += 1;
    else if (status === "EXISTING_MATCH") existingMatch += 1;
    else if (status === "FAILED") failed += 1;
  }
  progress.uploaded = uploaded;
  progress.existingMatch = existingMatch;
  progress.failed = failed;
}

function pendingEntries(entries: ManifestEntry[], progress: ProgressState): ManifestEntry[] {
  return entries.filter((entry) => {
    const status = progress.completed[entry.objectKey];
    return status !== "UPLOADED" && status !== "EXISTING_MATCH";
  });
}

class AdaptiveConcurrency {
  current: number;
  private last429At = 0;
  private lastIncreaseAt = Date.now();

  constructor(readonly min: number, start: number, readonly max: number) {
    this.current = start;
  }

  onSuccess(): void {
    if (Date.now() - this.last429At > 120_000 && Date.now() - this.lastIncreaseAt > 120_000 && this.current < this.max) {
      this.current = Math.min(this.max, this.current + 2);
      this.lastIncreaseAt = Date.now();
    }
  }

  on429(retryAfterSec: number): number {
    this.last429At = Date.now();
    this.current = Math.max(this.min, this.current - 4);
    return retryAfterSec > 0 ? retryAfterSec * 1000 : 45_000;
  }
}

async function uploadEntry(entry: ManifestEntry, progress: ProgressState, adaptive: AdaptiveConcurrency): Promise<ObjectStatus> {
  const body = readFileSync(entry.localPath);
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const result = await putObjectWithRetry(entry.objectKey, body, entry.contentType, 1);
    if (result.ok) {
      progress.bytesUploaded += entry.bytes;
      adaptive.onSuccess();
      return "UPLOADED";
    }
    progress.retried += 1;
    if (result.status === 429) {
      const waitMs = adaptive.on429(result.retryAfterSec);
      await new Promise((r) => setTimeout(r, waitMs + Math.floor(Math.random() * 250)));
    } else if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt + Math.floor(Math.random() * 250)));
    } else {
      progress.failures.push({ objectKey: entry.objectKey, error: result.body.slice(0, 200) });
      return "FAILED";
    }
  }
  return "FAILED";
}

async function runPool(entries: ManifestEntry[], progress: ProgressState, adaptive: AdaptiveConcurrency, onUpdate: () => void): Promise<void> {
  let index = 0;
  let active = 0;
  await new Promise<void>((resolve, reject) => {
    const next = (): void => {
      while (active < adaptive.current && index < entries.length) {
        const entry = entries[index]!;
        index += 1;
        active += 1;
        void uploadEntry(entry, progress, adaptive)
          .then((status) => {
            progress.completed[entry.objectKey] = status;
            progress.lastCompletedObject = entry.objectKey;
            reconcileProgressCounts(progress);
            const done = progress.uploaded + progress.existingMatch;
            if (done % 25 === 0) onUpdate();
          })
          .catch((error: unknown) => reject(error instanceof Error ? error : new Error(String(error))))
          .finally(() => {
            active -= 1;
            if (index >= entries.length && active === 0) resolve();
            else next();
          });
      }
    };
    next();
  });
}

function writeUploadComplete(progress: ProgressState, uploadDurationMs: number): void {
  const done = progress.uploaded + progress.existingMatch;
  const ratePerMin = uploadDurationMs > 0 ? Number(((done / uploadDurationMs) * 60000).toFixed(1)) : 0;
  const payload = {
    phase: "8.46",
    generatedAt: new Date().toISOString(),
    bucket: R2_BUCKET_NAME,
    privacy: "PRIVATE",
    expected: EXPECTED_OBJECTS,
    uploaded: progress.uploaded,
    existingMatch: progress.existingMatch,
    completed: done,
    failed: progress.failed,
    pending: EXPECTED_OBJECTS - done,
    retried: progress.retried,
    uploadEngine: "cloudflare-r2-http",
    concurrency: progress.concurrency,
    uploadDurationMinutes: Number((uploadDurationMs / 60000).toFixed(1)),
    averageRatePerMinute: ratePerMin,
    production: "UNCHANGED",
    canary: "OFF",
    full: "OFF",
    dns: "UNCHANGED",
    finalAudit: "PENDING",
    status: done >= EXPECTED_OBJECTS && progress.failed === 0 ? "UPLOAD_COMPLETE" : "INCOMPLETE",
  };
  writeJson(join(exportDir, "manifests", "r2-phase-8-45-upload-complete.json"), payload);
  writeJson(join(exportDir, "manifests", "r2-phase-8-46-upload-complete.json"), payload);
}

async function main(): Promise<void> {
  console.log("Phase 8.46 — fast R2 upload (HTTP, adaptive concurrency)");
  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) throw new Error(account.message);
  if (!bucketExists(rootDir, R2_BUCKET_NAME)) throw new Error(`Bucket ${R2_BUCKET_NAME} not found`);
  const bucketInfo = runWranglerWithRetry(["r2", "bucket", "info", R2_BUCKET_NAME], rootDir);
  if (`${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase().includes("public access: true")) {
    throw new Error("HARD STOP: bucket public access enabled");
  }
  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  if (verifyFrozenChecksums(rootDir, frozenChecksums).status !== "PASS") {
    throw new Error("HARD STOP: frozen 8.10 checksum failure");
  }
  if (
    MASTER_INTEGRATION_CONFIG.masterSEOEnabled ||
    MASTER_INTEGRATION_CONFIG.masterArtworkEnabled ||
    parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE) !== "OFF"
  ) {
    throw new Error("HARD STOP: production SEO flags enabled");
  }

  const progressPath = join(exportDir, "manifests", "r2-phase-8-40-progress.json");
  const resuming = existsSync(progressPath);
  const entries = loadManifest();
  const progress: ProgressState = resuming
    ? (JSON.parse(readFileSync(progressPath, "utf8")) as ProgressState)
    : {
        phase: "8.46",
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        total: entries.length,
        uploaded: 0,
        existingMatch: 0,
        skipped: 0,
        failed: 0,
        retried: 0,
        bytesUploaded: 0,
        bytesVerified: 0,
        lastCompletedObject: null,
        completed: {},
        failures: [],
        uploadEngine: "cloudflare-r2-http",
      };

  if (resuming) {
    for (const [objectKey, status] of Object.entries(progress.completed)) {
      if (status === "FAILED") delete progress.completed[objectKey];
    }
    progress.failures = [];
    reconcileProgressCounts(progress);
  }

  progress.uploadEngine = "cloudflare-r2-http";
  const adaptive = new AdaptiveConcurrency(MIN_CONCURRENCY, START_CONCURRENCY, MAX_CONCURRENCY);
  progress.concurrency = adaptive.current;

  const saveProgress = (): void => {
    reconcileProgressCounts(progress);
    progress.updatedAt = new Date().toISOString();
    progress.concurrency = adaptive.current;
    writeJson(progressPath, progress);
  };

  const queue = pendingEntries(entries, progress);
  console.log(`Uploading ${queue.length} pending via HTTP (${adaptive.current} concurrent, ${entries.length - queue.length} already complete)`);

  const uploadStarted = Date.now();
  const heartbeat = setInterval(() => {
    const done = progress.uploaded + progress.existingMatch;
    console.log(`[heartbeat] ${done}/${progress.total} complete, ${progress.failed} failed, concurrency=${adaptive.current}, last=${progress.lastCompletedObject ?? "n/a"}`);
    saveProgress();
  }, 60_000);

  await runPool(queue, progress, adaptive, saveProgress);
  clearInterval(heartbeat);
  saveProgress();

  if (progress.failed > 0) {
    console.log(`Retrying ${progress.failed} failed uploads...`);
    const failedKeys = new Set(Object.entries(progress.completed).filter(([, s]) => s === "FAILED").map(([k]) => k));
    for (const objectKey of Array.from(failedKeys)) delete progress.completed[objectKey];
    reconcileProgressCounts(progress);
    await runPool(entries.filter((e) => failedKeys.has(e.objectKey)), progress, adaptive, saveProgress);
    saveProgress();
  }

  if (progress.failed > 0) throw new Error(`Upload failures: ${progress.failed}`);

  const uploadDurationMs = Date.now() - uploadStarted;
  const done = progress.uploaded + progress.existingMatch;
  writeUploadComplete(progress, uploadDurationMs);
  console.log(`Phase 8.46 upload complete: ${done}/${EXPECTED_OBJECTS}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});