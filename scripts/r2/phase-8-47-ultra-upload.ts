import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { R2_BUCKET_NAME } from "./wrangler-r2";
import { putObjectWithRetry } from "./r2-http-client";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const MIN_CONCURRENCY = 12;
const START_CONCURRENCY = 32;
const MAX_CONCURRENCY = 64;
const MAX_RETRIES = 8;
const SAVE_EVERY = 200;
const HEARTBEAT_MS = 30_000;

type ObjectStatus = "UPLOADED" | "EXISTING_MATCH" | "FAILED";

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
  completed: Record<string, ObjectStatus | string>;
  failures: Array<{ objectKey: string; error: string }>;
  uploadEngine?: string;
  concurrency?: number;
  rate429?: number;
  rateTimeout?: number;
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

function loadManifestCached(): ManifestEntry[] {
  const cachePath = join(exportDir, "manifests", "r2-phase-8-47-manifest-cache.json");
  if (existsSync(cachePath)) {
    return JSON.parse(readFileSync(cachePath, "utf8")) as ManifestEntry[];
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
  writeJson(cachePath, entries);
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
    if (Date.now() - this.last429At > 45_000 && Date.now() - this.lastIncreaseAt > 45_000 && this.current < this.max) {
      this.current = Math.min(this.max, this.current + 4);
      this.lastIncreaseAt = Date.now();
    }
  }

  on429(retryAfterSec: number): number {
    this.last429At = Date.now();
    this.current = Math.max(this.min, this.current - 8);
    return retryAfterSec > 0 ? retryAfterSec * 1000 : 45_000;
  }
}

class UploadStats {
  count429 = 0;
  countTimeout = 0;
  completedSinceHeartbeat = 0;
  private windowStart = Date.now();
  private windowDone = 0;

  record429(): void { this.count429 += 1; }
  recordTimeout(): void { this.countTimeout += 1; }
  recordSuccess(): void {
    this.completedSinceHeartbeat += 1;
    this.windowDone += 1;
  }
  rollingRatePerMin(): number {
    const elapsed = (Date.now() - this.windowStart) / 60000;
    if (elapsed <= 0) return 0;
    return Number((this.windowDone / elapsed).toFixed(1));
  }
  resetWindow(): void {
    this.windowStart = Date.now();
    this.windowDone = 0;
    this.completedSinceHeartbeat = 0;
  }
}

async function uploadEntry(
  entry: ManifestEntry,
  progress: ProgressState,
  adaptive: AdaptiveConcurrency,
  stats: UploadStats,
): Promise<ObjectStatus> {
  const body = readFileSync(entry.localPath);
  const result = await putObjectWithRetry(entry.objectKey, body, entry.contentType, MAX_RETRIES);
  if (result.ok) {
    progress.bytesUploaded += body.length;
    adaptive.onSuccess();
    stats.recordSuccess();
    return "UPLOADED";
  }
  progress.retried += 1;
  if (result.status === 429) {
    stats.record429();
    progress.rate429 = (progress.rate429 ?? 0) + 1;
    const waitMs = adaptive.on429(result.retryAfterSec);
    await new Promise((r) => setTimeout(r, waitMs + Math.floor(Math.random() * 500)));
  } else if (result.body.toLowerCase().includes("timeout")) {
    stats.recordTimeout();
    progress.rateTimeout = (progress.rateTimeout ?? 0) + 1;
  }
  progress.failures.push({ objectKey: entry.objectKey, error: result.body.slice(0, 200) });
  return "FAILED";
}

async function runPool(
  entries: ManifestEntry[],
  progress: ProgressState,
  adaptive: AdaptiveConcurrency,
  stats: UploadStats,
  onUpdate: () => void,
): Promise<string[]> {
  const deferred: string[] = [];
  let index = 0;
  let active = 0;
  let sinceSave = 0;

  await new Promise<void>((resolve, reject) => {
    const next = (): void => {
      while (active < adaptive.current && index < entries.length) {
        const entry = entries[index]!;
        index += 1;
        active += 1;
        void uploadEntry(entry, progress, adaptive, stats)
          .then((status) => {
            progress.completed[entry.objectKey] = status;
            progress.lastCompletedObject = entry.objectKey;
            reconcileProgressCounts(progress);
            if (status === "FAILED") deferred.push(entry.objectKey);
            sinceSave += 1;
            if (sinceSave >= SAVE_EVERY) {
              sinceSave = 0;
              onUpdate();
            }
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

  return deferred;
}

function writeUploadComplete(progress: ProgressState): void {
  const done = progress.uploaded + progress.existingMatch;
  const payload = {
    phase: "8.47",
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
    uploadEngine: "cloudflare-r2-http-ultra",
    concurrency: progress.concurrency,
    rate429: progress.rate429 ?? 0,
    rateTimeout: progress.rateTimeout ?? 0,
    verification: "NOT_STARTED",
    status: done >= EXPECTED_OBJECTS && progress.failed === 0 ? "UPLOAD_COMPLETE" : "INCOMPLETE",
  };
  writeJson(join(exportDir, "manifests", "r2-phase-8-47-upload-complete.json"), payload);
  writeFileSync(
    join(exportDir, "PHASE-8.47-UPLOAD-COMPLETE.md"),
    `# PHASE 8.47 — UPLOAD COMPLETE\n\nObjects: ${done} / ${EXPECTED_OBJECTS}\n100%\n\nVerification: NOT STARTED\n`,
    "utf8",
  );
}

async function main(): Promise<void> {
  console.log("Phase 8.47 — ultra-fast R2 upload (HTTP only, no verification)");

  const progressPath = join(exportDir, "manifests", "r2-phase-8-40-progress.json");
  const resuming = existsSync(progressPath);
  const entries = loadManifestCached();
  const progress: ProgressState = resuming
    ? (JSON.parse(readFileSync(progressPath, "utf8")) as ProgressState)
    : {
        phase: "8.47",
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
        uploadEngine: "cloudflare-r2-http-ultra",
      };

  if (resuming) {
    for (const [objectKey, status] of Object.entries(progress.completed)) {
      if (status === "FAILED") delete progress.completed[objectKey];
    }
    progress.failures = [];
    reconcileProgressCounts(progress);
  }

  const resumeConcurrency = progress.concurrency && progress.concurrency >= MIN_CONCURRENCY
    ? Math.min(MAX_CONCURRENCY, progress.concurrency + 8)
    : START_CONCURRENCY;
  const adaptive = new AdaptiveConcurrency(MIN_CONCURRENCY, resumeConcurrency, MAX_CONCURRENCY);
  const stats = new UploadStats();
  progress.uploadEngine = "cloudflare-r2-http-ultra";
  progress.concurrency = adaptive.current;

  const saveProgress = (): void => {
    reconcileProgressCounts(progress);
    progress.updatedAt = new Date().toISOString();
    progress.concurrency = adaptive.current;
    writeJson(progressPath, progress);
  };

  let queue = pendingEntries(entries, progress);
  console.log(`Uploading ${queue.length} pending via HTTP ultra (${adaptive.current} concurrent, ${entries.length - queue.length} already complete)`);

  const heartbeat = setInterval(() => {
    const done = progress.uploaded + progress.existingMatch;
    const pct = ((done / progress.total) * 100).toFixed(2);
    const rate = stats.rollingRatePerMin();
    console.log(
      `[heartbeat] ${done}/${progress.total} (${pct}%) rate≈${rate}/min pending=${EXPECTED_OBJECTS - done} concurrency=${adaptive.current} 429=${stats.count429} timeout=${stats.countTimeout} last=${progress.lastCompletedObject ?? "n/a"}`,
    );
    stats.resetWindow();
    saveProgress();
  }, HEARTBEAT_MS);

  while (queue.length > 0) {
    const deferred = await runPool(queue, progress, adaptive, stats, saveProgress);
    saveProgress();
    if (deferred.length === 0) break;
    for (const objectKey of deferred) delete progress.completed[objectKey];
    progress.failures = [];
    reconcileProgressCounts(progress);
    queue = entries.filter((e) => deferred.includes(e.objectKey));
    console.log(`Retrying deferred batch: ${queue.length} objects at concurrency ${adaptive.current}`);
  }

  clearInterval(heartbeat);
  saveProgress();

  if (progress.failed > 0) throw new Error(`Upload failures: ${progress.failed}`);

  const done = progress.uploaded + progress.existingMatch;
  writeUploadComplete(progress);
  console.log(`UPLOAD COMPLETE ${done}/${EXPECTED_OBJECTS} 100%`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});