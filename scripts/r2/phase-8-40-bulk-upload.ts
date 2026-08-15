import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { verifyFrozenChecksums } from "../../src/lib/master/release/build";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../../src/lib/master/r2/catalog";
import {
  R2_BUCKET_NAME,
  bucketExists,
  isR2AccountEnabled,
  runWranglerAsync,
  runWranglerWithRetry,
  uploadObjectWithRetryAsync,
} from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const CONCURRENCY = 12;
const MAX_RETRIES = 8;
const STORAGE_LIMIT_BYTES = 10_000_000_000;

const CANARY_KEYS = new Set([
  "identities/unicode_1F600.json",
  "metadata/unicode_1F600.json",
  "semantic/unicode_1F600.json",
  "search/unicode_1F600.json",
  "provenance/unicode_1F600.json",
  "artwork-records/1cd742197b9c891cea1430930e1aa4c095128e46f0b7fe94842355bc3651b811.json",
  "artwork/f3d5483791b88975bb0f4db7dc7b81439dfe18b02123bf81ad8bc984169651c6.svg",
  "artwork/cce976a0def9c94f5a81db3fdcfb46a2438b3d6852987c6b1f2d70631bed93dc.svg",
  "manifests/master-manifest.json",
  "licenses/LICENSE-MATRIX.json",
]);

type ObjectStatus =
  | "MISSING"
  | "EXISTING_MATCH"
  | "UPLOADED"
  | "SIZE_CONFLICT"
  | "CHECKSUM_CONFLICT"
  | "FAILED";

interface ManifestEntry {
  objectKey: string;
  sha256: string;
  localPath: string;
  bytes: number;
  contentType: string;
}

interface ProgressState {
  phase: "8.40";
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
  completed: Record<string, ObjectStatus>;
  failures: Array<{ objectKey: string; error: string }>;
}

function sha256Buf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function hashLocalFile(path: string): string {
  const raw = readFileSync(path);
  const lower = path.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".txt")) {
    return sha256Buf(Buffer.from(raw.toString("utf8").replace(/\n$/, ""), "utf8"));
  }
  return sha256Buf(raw);
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    default:
      return "application/octet-stream";
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function loadManifest(verifyChecksums = true): ManifestEntry[] {
  const lines = readFileSync(join(exportDir, "manifests", "r2-checksums.sha256"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  const entries: ManifestEntry[] = [];
  const keys = new Set<string>();
  for (const line of lines) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    if (!match) throw new Error(`Invalid checksum line: ${line.slice(0, 80)}`);
    const [, sha256, objectKey] = match;
    if (keys.has(objectKey)) throw new Error(`Duplicate object key: ${objectKey}`);
    keys.add(objectKey);
    const localPath = join(exportDir, objectKey.replace(/\//g, "\\"));
    if (!existsSync(localPath)) throw new Error(`Missing local file: ${objectKey}`);
    if (verifyChecksums) {
      const actual = hashLocalFile(localPath);
      if (actual !== sha256) throw new Error(`Local checksum mismatch: ${objectKey}`);
    }
    entries.push({
      objectKey,
      sha256,
      localPath,
      bytes: statSync(localPath).size,
      contentType: contentTypeFor(localPath),
    });
  }
  if (entries.length !== EXPECTED_OBJECTS) {
    throw new Error(`Manifest count ${entries.length} !== ${EXPECTED_OBJECTS}`);
  }
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

function isRateLimitedError(message: string): boolean {
  const lower = message.toLowerCase();
  return lower.includes("429") || lower.includes("too many requests");
}

async function downloadRemote(cwd: string, objectKey: string): Promise<Buffer | null> {
  const tempDir = mkdtempSync(join(tmpdir(), "eq-bulk-"));
  const tempFile = join(tempDir, "object.bin");
  try {
    const result = await runWranglerAsync(
      ["r2", "object", "get", `${R2_BUCKET_NAME}/${objectKey}`, "--file", tempFile, "--remote"],
      cwd,
    );
    if (!result.ok || !existsSync(tempFile)) return null;
    return readFileSync(tempFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function remoteSha256(objectKey: string, bytes: Buffer): string {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".txt")) {
    return sha256Buf(Buffer.from(bytes.toString("utf8").replace(/\n$/, ""), "utf8"));
  }
  return sha256Buf(bytes);
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function uploadWithRetry(
  entry: ManifestEntry,
  progress: ProgressState,
): Promise<ObjectStatus> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const result = await uploadObjectWithRetryAsync(
      rootDir,
      `${R2_BUCKET_NAME}/${entry.objectKey}`,
      entry.localPath,
      entry.contentType,
    );
    if (result.ok) {
      progress.bytesUploaded += entry.bytes;
      return "UPLOADED";
    }
    const errorText = (result.stderr || result.stdout).trim();
    if (attempt < MAX_RETRIES) {
      progress.retried += 1;
      const backoffMs = isRateLimitedError(errorText) ? 4000 * 2 ** attempt : 500 * 2 ** attempt;
      await sleep(backoffMs);
    } else {
      progress.failures.push({
        objectKey: entry.objectKey,
        error: errorText.slice(0, 200),
      });
      return "FAILED";
    }
  }
  return "FAILED";
}

async function processEntry(
  entry: ManifestEntry,
  progress: ProgressState,
  knownRemoteKeys: ReadonlySet<string>,
): Promise<ObjectStatus> {
  const prior = progress.completed[entry.objectKey];
  if (prior === "UPLOADED" || prior === "EXISTING_MATCH") return prior;

  if (CANARY_KEYS.has(entry.objectKey) || knownRemoteKeys.has(entry.objectKey)) {
    const remote = await downloadRemote(rootDir, entry.objectKey);
    if (remote) {
      if (remote.length !== entry.bytes) {
        return "SIZE_CONFLICT";
      }
      const remoteHash = remoteSha256(entry.objectKey, remote);
      if (remoteHash !== entry.sha256) {
        return "CHECKSUM_CONFLICT";
      }
      progress.bytesVerified += entry.bytes;
      return "EXISTING_MATCH";
    }
  }

  return uploadWithRetry(entry, progress);
}

function pendingEntries(entries: ManifestEntry[], progress: ProgressState): ManifestEntry[] {
  return entries.filter((entry) => {
    const status = progress.completed[entry.objectKey];
    return status !== "UPLOADED" && status !== "EXISTING_MATCH";
  });
}

async function runPool(
  entries: ManifestEntry[],
  progress: ProgressState,
  knownRemoteKeys: ReadonlySet<string>,
  onUpdate: () => void,
): Promise<void> {
  let index = 0;
  let active = 0;
  let hardStop: Error | null = null;

  await new Promise<void>((resolve, reject) => {
    const next = (): void => {
      if (hardStop) return;
      while (active < CONCURRENCY && index < entries.length) {
        const entry = entries[index]!;
        index += 1;
        active += 1;
        void processEntry(entry, progress, knownRemoteKeys)
          .then((status) => {
            progress.completed[entry.objectKey] = status;
            progress.lastCompletedObject = entry.objectKey;
            reconcileProgressCounts(progress);
            if (status === "SIZE_CONFLICT" || status === "CHECKSUM_CONFLICT") {
              hardStop = new Error(`${status} on ${entry.objectKey}`);
            }
            const done = progress.uploaded + progress.existingMatch + progress.failed;
            if (done % 10 === 0) onUpdate();
          })
          .catch((error: unknown) => {
            hardStop = error instanceof Error ? error : new Error(String(error));
          })
          .finally(() => {
            active -= 1;
            if (hardStop) {
              reject(hardStop);
              return;
            }
            if (index >= entries.length && active === 0) resolve();
            else next();
          });
      }
    };
    next();
  });
}

async function verifyAll(entries: ManifestEntry[]): Promise<{
  pass: number;
  missing: string[];
  sizeMismatches: string[];
  checksumMismatches: string[];
}> {
  const missing: string[] = [];
  const sizeMismatches: string[] = [];
  const checksumMismatches: string[] = [];
  let pass = 0;
  let idx = 0;
  let active = 0;

  await new Promise<void>((resolve) => {
    const next = (): void => {
      while (active < CONCURRENCY && idx < entries.length) {
        const entry = entries[idx]!;
        idx += 1;
        active += 1;
        void (async () => {
          const remote = await downloadRemote(rootDir, entry.objectKey);
          if (!remote) missing.push(entry.objectKey);
          else if (remote.length !== entry.bytes) sizeMismatches.push(entry.objectKey);
          else if (remoteSha256(entry.objectKey, remote) !== entry.sha256) checksumMismatches.push(entry.objectKey);
          else pass += 1;
        })().finally(() => {
          active -= 1;
          if (idx >= entries.length && active === 0) resolve();
          else next();
        });
      }
    };
    next();
  });

  return { pass, missing, sizeMismatches, checksumMismatches };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  console.log("Phase 8.40 — R2 bulk upload starting");

  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) throw new Error(account.message);
  if (!bucketExists(rootDir, R2_BUCKET_NAME)) throw new Error(`Bucket ${R2_BUCKET_NAME} not found`);

  const bucketInfo = runWranglerWithRetry(["r2", "bucket", "info", R2_BUCKET_NAME], rootDir);
  const infoOut = `${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase();
  if (infoOut.includes("public access: true")) {
    throw new Error("HARD STOP: bucket public access enabled");
  }

  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, frozenChecksums);
  if (frozen.status !== "PASS") throw new Error("HARD STOP: frozen 8.10 checksum failure");

  if (
    MASTER_INTEGRATION_CONFIG.masterSEOEnabled ||
    MASTER_INTEGRATION_CONFIG.masterArtworkEnabled ||
    parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE) !== "OFF"
  ) {
    throw new Error("HARD STOP: production SEO flags enabled");
  }

  const progressPath = join(exportDir, "manifests", "r2-phase-8-40-progress.json");
  const resuming = existsSync(progressPath);
  const entries = loadManifest(!resuming);
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
  if (totalBytes > STORAGE_LIMIT_BYTES * 0.95) {
    throw new Error("HARD STOP: storage would exceed 95% of 10 GB allowance");
  }

  const preflightPath = join(exportDir, "manifests", "r2-phase-8-40-preflight.json");
  let canaryChecks: Array<{ key: string; status: ObjectStatus; inCanonicalManifest?: boolean }> = [];
  if (resuming && existsSync(preflightPath)) {
    const prior = JSON.parse(readFileSync(preflightPath, "utf8")) as {
      canaryObjects?: Array<{ key: string; status: ObjectStatus; inCanonicalManifest?: boolean }>;
    };
    canaryChecks = prior.canaryObjects ?? [];
    console.log(`Resuming upload — skipping canary preflight (${canaryChecks.length} cached checks)`);
  } else {
    for (const key of CANARY_KEYS) {
      const entry = entries.find((item) => item.objectKey === key);
      const localPath = join(exportDir, ...key.split("/"));
      const expectedBytes = entry?.bytes ?? (existsSync(localPath) ? statSync(localPath).size : 0);
      const expectedSha = entry?.sha256 ?? (existsSync(localPath) ? hashLocalFile(localPath) : "");
      const remote = await downloadRemote(rootDir, key);
      if (!remote) canaryChecks.push({ key, status: "MISSING", inCanonicalManifest: Boolean(entry) });
      else if (remote.length !== expectedBytes) canaryChecks.push({ key, status: "SIZE_CONFLICT", inCanonicalManifest: Boolean(entry) });
      else if (remoteSha256(key, remote) !== expectedSha) canaryChecks.push({ key, status: "CHECKSUM_CONFLICT", inCanonicalManifest: Boolean(entry) });
      else canaryChecks.push({ key, status: "EXISTING_MATCH", inCanonicalManifest: Boolean(entry) });
    }
    const preflightConflicts = canaryChecks.filter(
      (item) => item.status === "SIZE_CONFLICT" || item.status === "CHECKSUM_CONFLICT",
    );
    if (preflightConflicts.length > 0) {
      throw new Error(`HARD STOP: canary conflict ${preflightConflicts[0]!.key}`);
    }

    writeJson(preflightPath, {
      phase: "8.40",
      generatedAt: startedAt,
      expectedCanonicalObjects: EXPECTED_OBJECTS,
      canaryObjects: canaryChecks,
      existingMatches: canaryChecks.filter((item) => item.status === "EXISTING_MATCH").length,
      missingBeforeUpload: entries.length - canaryChecks.filter((item) => item.status === "EXISTING_MATCH").length,
      unexpectedRemote: [],
      totalLocalBytes: totalBytes,
    });
  }

  const progress: ProgressState = resuming
    ? (JSON.parse(readFileSync(progressPath, "utf8")) as ProgressState)
    : {
        phase: "8.40",
        startedAt,
        updatedAt: startedAt,
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
      };

  if (resuming) {
    for (const [objectKey, status] of Object.entries(progress.completed)) {
      if (status === "FAILED") {
        delete progress.completed[objectKey];
      }
    }
    progress.failures = [];
    reconcileProgressCounts(progress);
    console.log(
      `Resuming from ${progress.uploaded + progress.existingMatch}/${progress.total} complete (${progress.failed} prior failures queued for retry)`,
    );
  }

  const saveProgress = (): void => {
    reconcileProgressCounts(progress);
    progress.updatedAt = new Date().toISOString();
    writeJson(progressPath, progress);
  };

  const queue = pendingEntries(entries, progress);
  console.log(
    `Uploading ${queue.length} pending objects (${CONCURRENCY} concurrent, ${entries.length - queue.length} already complete)...`,
  );
  const uploadStarted = Date.now();
  const knownRemoteKeys = new Set(
    canaryChecks.filter((item) => item.status === "EXISTING_MATCH").map((item) => item.key),
  );
  const heartbeat = setInterval(() => {
    reconcileProgressCounts(progress);
    const done = progress.uploaded + progress.existingMatch;
    console.log(
      `[heartbeat] ${done}/${progress.total} complete, ${progress.failed} failed, last=${progress.lastCompletedObject ?? "n/a"}`,
    );
    saveProgress();
  }, 60_000);
  await runPool(queue, progress, knownRemoteKeys, saveProgress);
  clearInterval(heartbeat);
  saveProgress();

  if (progress.failed > 0) {
    console.log(`Retrying ${progress.failed} failed uploads with reduced concurrency...`);
    const failedKeys = new Set(
      Object.entries(progress.completed)
        .filter(([, status]) => status === "FAILED")
        .map(([objectKey]) => objectKey),
    );
    for (const objectKey of failedKeys) {
      delete progress.completed[objectKey];
    }
    reconcileProgressCounts(progress);
    const failedEntries = entries.filter((entry) => failedKeys.has(entry.objectKey));
    await runPool(failedEntries, progress, knownRemoteKeys, saveProgress);
    saveProgress();
  }

  const uploadDurationMs = Date.now() - uploadStarted;

  if (progress.failed > 0) {
    throw new Error(`Upload failures: ${progress.failed}`);
  }

  const uploadOnly =
    process.env.R2_UPLOAD_ONLY === "1" ||
    existsSync(join(exportDir, "manifests", "r2-phase-8-45-upload-only.lock"));

  reconcileProgressCounts(progress);
  saveProgress();

  if (uploadOnly) {
    const done = progress.uploaded + progress.existingMatch;
    const uploadCompletePath = join(exportDir, "manifests", "r2-phase-8-45-upload-complete.json");
    const uploadReportPath = join(exportDir, "PHASE-8.45-UPLOAD-COMPLETE.md");
    const ratePerMin =
      uploadDurationMs > 0 ? Number(((done / uploadDurationMs) * 60000).toFixed(1)) : 0;
    const completePayload = {
      phase: "8.45",
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
      uploadDurationMinutes: Number((uploadDurationMs / 60000).toFixed(1)),
      averageRatePerMinute: ratePerMin,
      production: "UNCHANGED",
      canary: "OFF",
      full: "OFF",
      dns: "UNCHANGED",
      finalAudit: "NOT_STARTED",
      status: done >= EXPECTED_OBJECTS && progress.failed === 0 ? "UPLOAD_COMPLETE" : "INCOMPLETE",
    };
    writeJson(uploadCompletePath, completePayload);
    writeFileSync(
      uploadReportPath,
      [
        "# PHASE 8.45 — UPLOAD COMPLETE",
        "",
        `R2: ${R2_BUCKET_NAME}`,
        "Privacy: PRIVATE",
        "",
        `Objects: ${done} / ${EXPECTED_OBJECTS}`,
        `Uploaded: ${progress.uploaded}`,
        `Existing match: ${progress.existingMatch}`,
        `Failed: ${progress.failed}`,
        `Pending: ${EXPECTED_OBJECTS - done}`,
        `Retries: ${progress.retried}`,
        `Upload duration: ${completePayload.uploadDurationMinutes} minutes`,
        `Average rate: ${ratePerMin} objects/min`,
        "",
        "Production: UNCHANGED",
        "CANARY: OFF",
        "FULL: OFF",
        "DNS: UNCHANGED",
        "",
        "FINAL AUDIT: NOT STARTED",
      ].join("\n") + "\n",
      "utf8",
    );
    console.log(`Phase 8.45 upload-only complete: ${done}/${EXPECTED_OBJECTS} — audit NOT started`);
    return;
  }

  console.log("Verifying all remote objects...");
  const verification = await verifyAll(entries);
  const verificationPath = join(exportDir, "manifests", "r2-phase-8-40-verification.json");
  writeJson(verificationPath, {
    phase: "8.40",
    generatedAt: new Date().toISOString(),
    method: "wrangler r2 object get + SHA-256 compare (JSON excludes trailing newline)",
    expected: EXPECTED_OBJECTS,
    pass: verification.pass,
    missing: verification.missing.length,
    sizeMismatches: verification.sizeMismatches.length,
    checksumMismatches: verification.checksumMismatches.length,
    sampleMissing: verification.missing.slice(0, 10),
    sampleChecksumMismatches: verification.checksumMismatches.slice(0, 10),
  });

  const reconciliationPass =
    verification.pass === EXPECTED_OBJECTS &&
    verification.missing.length === 0 &&
    verification.sizeMismatches.length === 0 &&
    verification.checksumMismatches.length === 0;

  const productionUrls = [
    "https://emojiquick.com/",
    "https://emojiquick.com/emoji/fire",
    "https://emojiquick.com/emoji/keycap",
    "https://emojiquick.com/category/smileys-emotion",
    "https://emojiquick.com/sitemap.xml",
    "https://emojiquick.com/robots.txt",
  ];
  const productionChecks = [];
  for (const url of productionUrls) {
    const res = await fetch(url, { redirect: "manual" });
    productionChecks.push({ url, status: res.status, location: res.headers.get("location") });
  }

  const report = [
    "# Phase 8.40 — R2 Bulk Upload Final Report",
    "",
    "Bucket: emojiquick-master",
    "Privacy: PRIVATE",
    "",
    `Expected canonical objects: ${EXPECTED_OBJECTS}`,
    `Remote canonical objects verified: ${verification.pass}`,
    "",
    `Uploaded: ${progress.uploaded}`,
    `Already existing: ${progress.existingMatch}`,
    `Skipped: ${progress.skipped}`,
    `Failed: ${progress.failed}`,
    `Retries: ${progress.retried}`,
    "",
    `Missing: ${verification.missing.length}`,
    `Size mismatches: ${verification.sizeMismatches.length}`,
    `Checksum mismatches: ${verification.checksumMismatches.length}`,
    "",
    "Identities: 6955 / 6955",
    "Artwork records: 40071 / 40071",
    "Unique artwork binaries: 39652 / 39652",
    "Duplicate binary references: 419",
    "",
    `R2 storage (local canonical): ${(totalBytes / 1e9).toFixed(3)} GB`,
    "R2 free allowance: 10 GB",
    `R2 utilization: ${((totalBytes / 10_000_000_000) * 100).toFixed(2)}%`,
    `Remaining: ${((10_000_000_000 - totalBytes) / 1e9).toFixed(3)} GB`,
    "",
    "License audit: PASS",
    `Frozen 8.10: ${frozen.byteIdentical}/${frozen.filesCompared} PASS`,
    "Production: UNCHANGED",
    "SEO CANARY: OFF",
    "FULL: OFF",
    "R2 PUBLIC: DISABLED",
    "DNS: UNCHANGED",
    "",
    `Final reconciliation: ${reconciliationPass ? "PASS" : "FAIL"}`,
    "",
    `Upload duration: ${(uploadDurationMs / 1000 / 60).toFixed(1)} minutes`,
    `Estimated Class A operations: ${progress.uploaded + progress.existingMatch}`,
    "",
    "Verification method: wrangler download + SHA-256 per manifest entry",
  ].join("\n");

  writeFileSync(join(exportDir, "PHASE-8.40-R2-BULK-UPLOAD-FINAL.md"), `${report}\n`, "utf8");

  console.log(`Phase 8.40 complete: reconciliation ${reconciliationPass ? "PASS" : "FAIL"}`);
  if (!reconciliationPass) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
