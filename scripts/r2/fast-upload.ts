/**
 * EmojiQuick R2 fast bulk uploader — upload only, 429-safe.
 * Run: npm run r2:fast-upload
 */
import { readFileSync, existsSync, writeFileSync, unlinkSync, renameSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { R2_BUCKET_NAME } from "./wrangler-r2";
import { putObjectHttp } from "./r2-http-client";
import { AdaptiveConcurrency, GlobalRateLimiter, sleep } from "./r2-upload-limiter";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const MIN_CONCURRENCY = 8;
const MAX_CONCURRENCY = 32;
const MAX_ATTEMPTS_PER_KEY = 12;
const SAVE_EVERY = 150;
const HEARTBEAT_MS = 45_000;
const RETRY_COOLDOWN_MS = 5_000;
const PROGRESS_PATH = join(exportDir, "manifests", "r2-phase-8-40-progress.json");
const EXPORT_MANIFEST_PATH = join(exportDir, "manifests", "r2-export-manifest.json");
const MANIFEST_CACHE_PATH = join(exportDir, "manifests", "r2-fast-upload-manifest-cache.json");
const LOCK_PATH = join(exportDir, "manifests", "r2-fast-upload.lock");

type TerminalStatus = "UPLOADED" | "EXISTING_MATCH" | "FAILED";

interface ManifestEntry {
  objectKey: string;
  localPath: string;
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
  completed: Record<string, TerminalStatus | string>;
  failures: Array<{ objectKey: string; error: string }>;
  uploadEngine?: string;
  concurrency?: number;
  rate429?: number;
  rateTimeout?: number;
}

let shuttingDown = false;
let saveProgressFn: (() => void) | null = null;

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".json": return "application/json";
    case ".svg": return "image/svg+xml";
    case ".png": return "image/png";
    default: return "application/octet-stream";
  }
}

function writeJsonAtomic(path: string, value: unknown): void {
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  renameSync(tmp, path);
}

function formatDuration(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function isRetryable(status: number, body: string): boolean {
  if (status === 429 || status === 408 || status === 500 || status === 502 || status === 503 || status === 504) return true;
  const lower = body.toLowerCase();
  return lower.includes("econnreset") || lower.includes("timeout") || lower.includes("temporarily unavailable");
}

function validateExportManifest(): void {
  if (!existsSync(EXPORT_MANIFEST_PATH)) return;
  const manifest = JSON.parse(readFileSync(EXPORT_MANIFEST_PATH, "utf8")) as { objectCounts?: { total?: number } };
  if (manifest.objectCounts?.total !== undefined && manifest.objectCounts.total !== EXPECTED_OBJECTS) {
    throw new Error(`Export manifest total ${manifest.objectCounts.total} !== ${EXPECTED_OBJECTS}`);
  }
}

function loadManifestCached(): ManifestEntry[] {
  if (existsSync(MANIFEST_CACHE_PATH)) {
    const cached = JSON.parse(readFileSync(MANIFEST_CACHE_PATH, "utf8")) as ManifestEntry[];
    if (cached.length === EXPECTED_OBJECTS) return cached;
  }
  const lines = readFileSync(join(exportDir, "manifests", "r2-checksums.sha256"), "utf8").split(/\r?\n/).filter(Boolean);
  const entries: ManifestEntry[] = [];
  for (const line of lines) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    if (!match) throw new Error(`Invalid checksum line: ${line.slice(0, 80)}`);
    const objectKey = match[2]!;
    const localPath = join(exportDir, ...objectKey.split("/"));
    if (!existsSync(localPath)) throw new Error(`Missing local file: ${objectKey}`);
    entries.push({ objectKey, localPath, contentType: contentTypeFor(localPath) });
  }
  if (entries.length !== EXPECTED_OBJECTS) throw new Error(`Manifest count ${entries.length} !== ${EXPECTED_OBJECTS}`);
  writeJsonAtomic(MANIFEST_CACHE_PATH, entries);
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

function isDone(status: string | undefined): boolean {
  return status === "UPLOADED" || status === "EXISTING_MATCH";
}

function acquireLock(): void {
  if (existsSync(LOCK_PATH)) {
    const existing = readFileSync(LOCK_PATH, "utf8").trim();
    const pid = Number(existing.split(/\s+/)[0]);
    if (pid && pid !== process.pid) {
      try {
        process.kill(pid, 0);
        throw new Error(`Another fast-upload is running (lock: ${existing})`);
      } catch {
        unlinkSync(LOCK_PATH);
      }
    }
  }
  writeFileSync(LOCK_PATH, `${process.pid} ${new Date().toISOString()}\n`, "utf8");
}

function releaseLock(): void {
  if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH);
}

class UploadStats {
  private windowStart = Date.now();
  private windowDone = 0;
  private windowRequests = 0;
  activeWorkers = 0;

  recordSuccess(): void {
    this.windowDone += 1;
    this.windowRequests += 1;
  }

  recordRequest(): void {
    this.windowRequests += 1;
  }

  objectsPerMin(): number {
    const elapsed = (Date.now() - this.windowStart) / 60000;
    return elapsed > 0 ? Number((this.windowDone / elapsed).toFixed(1)) : 0;
  }

  requestsPerMin(): number {
    const elapsed = (Date.now() - this.windowStart) / 60000;
    return elapsed > 0 ? Number((this.windowRequests / elapsed).toFixed(1)) : 0;
  }

  resetWindow(): void {
    this.windowStart = Date.now();
    this.windowDone = 0;
    this.windowRequests = 0;
  }
}

async function uploadOnce(
  entry: ManifestEntry,
  limiter: GlobalRateLimiter,
  stats: UploadStats,
): Promise<{ ok: boolean; status: number; body: string; retryAfterSec: number }> {
  await limiter.waitForSlot();
  stats.recordRequest();
  const body = readFileSync(entry.localPath);
  const result = await putObjectHttp(entry.objectKey, body, entry.contentType);
  return result;
}

async function runUploader(
  entries: ManifestEntry[],
  progress: ProgressState,
  adaptive: AdaptiveConcurrency,
  limiter: GlobalRateLimiter,
  stats: UploadStats,
  onSave: () => void,
): Promise<void> {
  const entryByKey = new Map(entries.map((e) => [e.objectKey, e]));
  const attemptCount = new Map<string, number>();
  const retryQueue: string[] = [];
  const retryReadyAt = new Map<string, number>();
  let sinceSave = 0;

  const pendingKeys = entries
    .map((e) => e.objectKey)
    .filter((key) => !isDone(progress.completed[key]));

  for (const [key, status] of Object.entries(progress.completed)) {
    if (status === "FAILED") {
      delete progress.completed[key];
      retryQueue.push(key);
    }
  }
  reconcileProgressCounts(progress);

  let pendingIndex = 0;

  const takeNextKey = (): string | null => {
    while (pendingIndex < pendingKeys.length) {
      const key = pendingKeys[pendingIndex]!;
      pendingIndex += 1;
      if (isDone(progress.completed[key])) continue;
      return key;
    }
    const now = Date.now();
    for (let i = 0; i < retryQueue.length; i += 1) {
      const key = retryQueue[i]!;
      if (isDone(progress.completed[key])) {
        retryQueue.splice(i, 1);
        i -= 1;
        continue;
      }
      const ready = retryReadyAt.get(key) ?? 0;
      if (ready <= now) {
        retryQueue.splice(i, 1);
        return key;
      }
    }
    return null;
  };

  const retryLater = (key: string, delayMs: number): void => {
    if (!retryQueue.includes(key)) retryQueue.push(key);
    retryReadyAt.set(key, Date.now() + delayMs);
  };

  await new Promise<void>((resolve, reject) => {
    let active = 0;

    const pump = (): void => {
      if (shuttingDown && active === 0) {
        resolve();
        return;
      }

      while (!shuttingDown && active < adaptive.current) {
        const key = takeNextKey();
        if (!key) {
          if (active === 0) {
            const hasFutureRetry = retryQueue.some((k) => (retryReadyAt.get(k) ?? 0) > Date.now());
            if (!hasFutureRetry && pendingIndex >= pendingKeys.length) {
              resolve();
              return;
            }
            if (hasFutureRetry) {
              const nextReady = Math.min(...retryQueue.map((k) => retryReadyAt.get(k) ?? Date.now()));
              setTimeout(pump, Math.max(100, nextReady - Date.now()));
            }
          }
          break;
        }

        const entry = entryByKey.get(key);
        if (!entry) continue;

        active += 1;
        stats.activeWorkers = active;

        void (async () => {
          try {
            const result = await uploadOnce(entry, limiter, stats);
            if (result.ok) {
              if (!isDone(progress.completed[key])) {
                progress.completed[key] = "UPLOADED";
                progress.lastCompletedObject = key;
                progress.bytesUploaded += statSync(entry.localPath).size;
                reconcileProgressCounts(progress);
                adaptive.onSuccess();
                limiter.recordSuccess();
                stats.recordSuccess();
                sinceSave += 1;
                if (sinceSave >= SAVE_EVERY) {
                  sinceSave = 0;
                  onSave();
                }
              }
              return;
            }

            progress.retried += 1;
            const attempts = (attemptCount.get(key) ?? 0) + 1;
            attemptCount.set(key, attempts);

            if (result.status === 429) {
              progress.rate429 = (progress.rate429 ?? 0) + 1;
              adaptive.on429();
              const pauseMs = limiter.record429(result.retryAfterSec);
              retryLater(key, pauseMs + Math.floor(Math.random() * 1000));
              return;
            }

            if (result.status === 408 || result.body.toLowerCase().includes("timeout")) {
              progress.rateTimeout = (progress.rateTimeout ?? 0) + 1;
              limiter.recordTimeout();
            }

            if (isRetryable(result.status, result.body) && attempts < MAX_ATTEMPTS_PER_KEY) {
              const backoff = Math.min(60_000, 1000 * 2 ** Math.min(attempts, 6)) + Math.floor(Math.random() * 500);
              retryLater(key, backoff);
              return;
            }

            if (!isDone(progress.completed[key])) {
              progress.completed[key] = "FAILED";
              progress.failures.push({ objectKey: key, error: result.body.slice(0, 200) });
              reconcileProgressCounts(progress);
            }
          } catch (error: unknown) {
            reject(error instanceof Error ? error : new Error(String(error)));
          } finally {
            active -= 1;
            stats.activeWorkers = active;
            pump();
          }
        })();
      }
    };

    pump();
  });
}

function printHeartbeat(
  progress: ProgressState,
  stats: UploadStats,
  adaptive: AdaptiveConcurrency,
  limiter: GlobalRateLimiter,
  retryQueueSize: number,
  startedAt: number,
): void {
  const done = progress.uploaded + progress.existingMatch;
  const pending = EXPECTED_OBJECTS - done - progress.failed;
  const pct = ((done / EXPECTED_OBJECTS) * 100).toFixed(2);
  const rate = stats.objectsPerMin();
  const elapsed = Date.now() - startedAt;
  const etaMs = rate > 0 ? (pending / rate) * 60000 : 0;
  const pauseMs = limiter.pauseRemainingMs();
  console.log(
    `[heartbeat] ${done}/${EXPECTED_OBJECTS} (${pct}%) | pending=${pending} retryQ=${retryQueueSize} failed=${progress.failed} | objects/min=${rate} req/min=${stats.requestsPerMin()} | concurrency=${adaptive.current} workers=${stats.activeWorkers} | 429=${limiter.total429} timeout=${limiter.totalTimeouts}${pauseMs > 0 ? ` | paused=${formatDuration(pauseMs)}` : ""} | elapsed=${formatDuration(elapsed)} eta=${rate > 0 ? formatDuration(etaMs) : "?"}`,
  );
}

function setupShutdownHandlers(): void {
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[shutdown] ${signal} — saving progress...`);
    saveProgressFn?.();
    releaseLock();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function main(): Promise<void> {
  console.log("EmojiQuick R2 fast upload — upload only (429-safe)");
  console.log(`Bucket: ${R2_BUCKET_NAME} (PRIVATE)`);

  validateExportManifest();
  acquireLock();
  setupShutdownHandlers();

  process.env.R2_HTTP_MAX_CONNECTIONS ??= "64";
  process.env.R2_HTTP_TIMEOUT_MS ??= "60000";

  const resuming = existsSync(PROGRESS_PATH);
  const entries = loadManifestCached();
  const progress: ProgressState = resuming
    ? (JSON.parse(readFileSync(PROGRESS_PATH, "utf8")) as ProgressState)
    : {
        phase: "8.48",
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
        uploadEngine: "fast-upload-http-v2",
      };

  for (const [objectKey, status] of Object.entries(progress.completed)) {
    if (status === "FAILED") delete progress.completed[objectKey];
  }
  progress.failures = [];
  reconcileProgressCounts(progress);

  const had429 = (progress.rate429 ?? 0) > 0;
  const startConcurrency = had429
    ? Math.max(MIN_CONCURRENCY, Math.min(16, progress.concurrency ?? 16))
    : Math.min(MAX_CONCURRENCY, Math.max(20, progress.concurrency ?? 24));

  const adaptive = new AdaptiveConcurrency(MIN_CONCURRENCY, startConcurrency, MAX_CONCURRENCY);
  const limiter = new GlobalRateLimiter();
  const stats = new UploadStats();
  progress.uploadEngine = "fast-upload-http-v2";
  progress.concurrency = adaptive.current;

  const saveProgress = (): void => {
    reconcileProgressCounts(progress);
    progress.updatedAt = new Date().toISOString();
    progress.concurrency = adaptive.current;
    progress.uploadEngine = "fast-upload-http-v2";
    writeJsonAtomic(PROGRESS_PATH, progress);
  };
  saveProgressFn = saveProgress;
  saveProgress();

  const doneCount = Object.values(progress.completed).filter((s) => isDone(s as string)).length;
  console.log(`Resuming: ${doneCount}/${EXPECTED_OBJECTS} complete, concurrency=${adaptive.current}${had429 ? " (cautious after 429)" : ""}`);

  const uploadStarted = Date.now();
  let retryQueueSize = 0;
  const heartbeat = setInterval(() => {
    printHeartbeat(progress, stats, adaptive, limiter, retryQueueSize, uploadStarted);
    stats.resetWindow();
    saveProgress();
  }, HEARTBEAT_MS);

  await runUploader(entries, progress, adaptive, limiter, stats, saveProgress);

  clearInterval(heartbeat);
  saveProgress();
  releaseLock();

  if (shuttingDown) return;

  const done = progress.uploaded + progress.existingMatch;
  if (done < EXPECTED_OBJECTS || progress.failed > 0) {
    throw new Error(`Incomplete: ${done}/${EXPECTED_OBJECTS}, failed=${progress.failed}`);
  }

  writeJsonAtomic(join(exportDir, "manifests", "r2-phase-8-48-upload-complete.json"), {
    phase: "8.48",
    generatedAt: new Date().toISOString(),
    bucket: R2_BUCKET_NAME,
    privacy: "PRIVATE",
    completed: done,
    status: "UPLOAD_COMPLETE",
    verification: "NOT_STARTED",
  });

  console.log("");
  console.log("UPLOAD COMPLETE");
  console.log(`${EXPECTED_OBJECTS}/${EXPECTED_OBJECTS}`);
}

main().catch((error: unknown) => {
  releaseLock();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});