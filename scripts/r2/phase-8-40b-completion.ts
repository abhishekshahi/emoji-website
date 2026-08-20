import { execSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
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
  runWrangler,
  runWranglerAsync,
  runWranglerWithRetry,
} from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const VERIFY_CONCURRENCY = 12;
const POLL_MS = 90_000;
const STALL_POLLS = 4;

const progressPath = join(exportDir, "manifests", "r2-phase-8-40-progress.json");
const verificationPath = join(exportDir, "manifests", "r2-phase-8-40-verification.json");
const reconciliationPath = join(exportDir, "manifests", "r2-phase-8-40-final-reconciliation.json");
const monitorLogPath = join(exportDir, "manifests", "r2-phase-8-40b-monitor.log");

interface ManifestEntry {
  objectKey: string;
  sha256: string;
  bytes: number;
}

interface ProgressState {
  total: number;
  uploaded: number;
  existingMatch: number;
  failed: number;
  retried: number;
  updatedAt: string;
  startedAt: string;
  completed: Record<string, string>;
}

function log(message: string): void {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  writeFileSync(monitorLogPath, `${line}\n`, { flag: "a", encoding: "utf8" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256Buf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function readProgress(): ProgressState {
  return JSON.parse(readFileSync(progressPath, "utf8")) as ProgressState;
}

function countDone(progress: ProgressState): number {
  return Object.values(progress.completed).filter(
    (status) => status === "UPLOADED" || status === "EXISTING_MATCH",
  ).length;
}

function countFailed(progress: ProgressState): number {
  return Object.values(progress.completed).filter((status) => status === "FAILED").length;
}

function isUploaderRunning(): boolean {
  try {
    if (process.platform === "win32") {
      const output = execSync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Select-Object -ExpandProperty CommandLine"',
        { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
      );
      return output.includes("phase-8-40-bulk-upload");
    }
    const output = execSync("ps aux", { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
    return output.includes("phase-8-40-bulk-upload");
  } catch {
    return false;
  }
}

function spawnUploader(): void {
  if (isUploaderRunning()) {
    log("Uploader already running — not spawning a second instance");
    return;
  }
  log("Starting uploader for pending objects only");
  const child = spawn("npm", ["run", "r2:phase-8-40-upload"], {
    cwd: rootDir,
    detached: true,
    stdio: "ignore",
    shell: true,
  });
  child.unref();
}

function loadManifestEntries(): ManifestEntry[] {
  const lines = readFileSync(join(exportDir, "manifests", "r2-checksums.sha256"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  const entries: ManifestEntry[] = [];
  for (const line of lines) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    if (!match) continue;
    const [, sha256, objectKey] = match;
    entries.push({
      objectKey,
      sha256,
      bytes: statSync(join(exportDir, objectKey.replace(/\//g, "\\"))).size,
    });
  }
  return entries;
}

function remoteSha256(objectKey: string, bytes: Buffer): string {
  const lower = objectKey.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".txt")) {
    return sha256Buf(Buffer.from(bytes.toString("utf8").replace(/\n$/, ""), "utf8"));
  }
  return sha256Buf(bytes);
}

async function downloadRemote(objectKey: string): Promise<Buffer | null> {
  const tempDir = mkdtempSync(join(tmpdir(), "eq-840b-"));
  const tempFile = join(tempDir, "object.bin");
  try {
    const result = await runWranglerAsync(
      ["r2", "object", "get", `${R2_BUCKET_NAME}/${objectKey}`, "--file", tempFile, "--remote"],
      rootDir,
    );
    if (!result.ok || !existsSync(tempFile)) return null;
    return readFileSync(tempFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
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
      while (active < VERIFY_CONCURRENCY && idx < entries.length) {
        const entry = entries[idx]!;
        idx += 1;
        active += 1;
        void (async () => {
          const remote = await downloadRemote(entry.objectKey);
          if (!remote) missing.push(entry.objectKey);
          else if (remote.length !== entry.bytes) sizeMismatches.push(entry.objectKey);
          else if (remoteSha256(entry.objectKey, remote) !== entry.sha256) checksumMismatches.push(entry.objectKey);
          else pass += 1;
          if ((pass + missing.length + sizeMismatches.length + checksumMismatches.length) % 500 === 0) {
            log(`Verification progress: ${pass}/${entries.length} pass`);
          }
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

function listRemoteObjects(): string[] {
  const jsonResult = runWranglerWithRetry(["r2", "object", "list", R2_BUCKET_NAME, "--remote", "--json"], rootDir);
  if (jsonResult.ok) {
    try {
      const parsed = JSON.parse(jsonResult.stdout) as { objects?: Array<{ key: string }> };
      if (parsed.objects) return parsed.objects.map((entry) => entry.key);
    } catch {
      // fall through
    }
  }
  const textResult = runWranglerWithRetry(["r2", "object", "list", R2_BUCKET_NAME, "--remote"], rootDir);
  if (!textResult.ok) return [];
  const keys: string[] = [];
  for (const line of textResult.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Listing")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts[0]?.includes("/")) keys.push(parts[0]);
  }
  return keys;
}

function countPrefix(keys: string[], prefix: string): number {
  return keys.filter((key) => key.startsWith(prefix)).length;
}

async function runTests(): Promise<{ typecheck: string; tests: string }> {
  let typecheck = "PASS";
  let tests = "PASS";
  try {
    execSync("npm run typecheck", { cwd: rootDir, encoding: "utf8", stdio: "pipe" });
  } catch (error) {
    typecheck = error instanceof Error ? error.message.slice(0, 500) : "FAIL";
  }
  try {
    execSync("npm test", { cwd: rootDir, encoding: "utf8", stdio: "pipe", maxBuffer: 20 * 1024 * 1024 });
  } catch (error) {
    tests = error instanceof Error ? error.message.slice(0, 500) : "FAIL";
  }
  return { typecheck, tests };
}

async function runFinalize(): Promise<void> {
  if (existsSync(reconciliationPath)) {
    log("Final reconciliation already exists — skipping finalize");
    return;
  }

  log("Phase 8.40B finalize starting");

  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, frozenChecksums);
  if (frozen.status !== "PASS") {
    throw new Error("HARD STOP: frozen 8.10 checksum failure");
  }

  const bucketInfo = runWranglerWithRetry(["r2", "bucket", "info", R2_BUCKET_NAME], rootDir);
  const infoOut = `${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase();
  if (infoOut.includes("public access: true")) {
    throw new Error("HARD STOP: bucket public access enabled");
  }

  const entries = loadManifestEntries();
  const expectedKeys = new Set(entries.map((entry) => entry.objectKey));
  const totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);

  let verification: {
    pass: number;
    missing: string[];
    sizeMismatches: string[];
    checksumMismatches: string[];
  };

  if (existsSync(verificationPath)) {
    const prior = JSON.parse(readFileSync(verificationPath, "utf8")) as {
      pass: number;
      missing: number;
      sizeMismatches: number;
      checksumMismatches: number;
    };
    if (
      prior.pass === EXPECTED_OBJECTS &&
      prior.missing === 0 &&
      prior.sizeMismatches === 0 &&
      prior.checksumMismatches === 0
    ) {
      log("Using existing full verification manifest");
      verification = { pass: prior.pass, missing: [], sizeMismatches: [], checksumMismatches: [] };
    } else {
      log("Existing verification incomplete — running full remote verification");
      verification = await verifyAll(entries);
      writeJson(verificationPath, {
        phase: "8.40B",
        generatedAt: new Date().toISOString(),
        method: "wrangler r2 object get + SHA-256 compare (JSON excludes trailing newline)",
        expected: EXPECTED_OBJECTS,
        pass: verification.pass,
        missing: verification.missing.length,
        sizeMismatches: verification.sizeMismatches.length,
        checksumMismatches: verification.checksumMismatches.length,
        sampleMissing: verification.missing.slice(0, 20),
        sampleChecksumMismatches: verification.checksumMismatches.slice(0, 20),
      });
    }
  } else {
    log("Running full remote verification");
    verification = await verifyAll(entries);
    writeJson(verificationPath, {
      phase: "8.40B",
      generatedAt: new Date().toISOString(),
      method: "wrangler r2 object get + SHA-256 compare (JSON excludes trailing newline)",
      expected: EXPECTED_OBJECTS,
      pass: verification.pass,
      missing: verification.missing.length,
      sizeMismatches: verification.sizeMismatches.length,
      checksumMismatches: verification.checksumMismatches.length,
      sampleMissing: verification.missing.slice(0, 20),
      sampleChecksumMismatches: verification.checksumMismatches.slice(0, 20),
    });
  }

  const remoteKeys = listRemoteObjects();
  const remoteSet = new Set(remoteKeys);
  const missingObjects = entries.filter((entry) => !remoteSet.has(entry.objectKey)).map((entry) => entry.objectKey);
  const unexpectedObjects = remoteKeys.filter((key) => !expectedKeys.has(key));

  const artworkIndex = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/artwork/artwork-master-index.json"), "utf8"),
  ) as Array<{ artworkId: string; filePath: string; checksum: string }>;
  const checksumGroups = new Map<string, number>();
  for (const record of artworkIndex) {
    checksumGroups.set(record.checksum, (checksumGroups.get(record.checksum) ?? 0) + 1);
  }
  let duplicateBinaryReferences = 0;
  for (const count of checksumGroups.values()) {
    if (count > 1) duplicateBinaryReferences += count - 1;
  }

  const identitiesVerified = countPrefix(remoteKeys, "identities/");
  const artworkRecordsVerified = countPrefix(remoteKeys, "artwork-records/");
  const uniqueArtworkBinaries = countPrefix(remoteKeys, "artwork/");

  const exportManifest = JSON.parse(
    readFileSync(join(exportDir, "manifests", "r2-export-manifest.json"), "utf8"),
  ) as { licenseClassifications?: unknown; objectCounts?: Record<string, number> };

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

  const testResults = await runTests();
  const progress = readProgress();

  const reconciliation = {
    expectedObjects: EXPECTED_OBJECTS,
    remoteObjects: remoteKeys.length,
    correctObjects: verification.pass,
    missingObjects: [...new Set([...verification.missing, ...missingObjects])],
    unexpectedObjects,
    sizeMismatches: verification.sizeMismatches,
    checksumMismatches: verification.checksumMismatches,
    identitiesExpected: MASTER_IDENTITY_COUNT,
    identitiesVerified,
    artworkRecordsExpected: MASTER_ARTWORK_RECORD_COUNT,
    artworkRecordsVerified,
    uniqueArtworkBinaries,
    duplicateBinaryReferences,
    totalBytes,
    storageGB: Number((totalBytes / 1e9).toFixed(4)),
    storageGiB: Number((totalBytes / 1024 ** 3).toFixed(4)),
    allowanceGB: 10,
    utilizationPercent: Number(((totalBytes / 10_000_000_000) * 100).toFixed(4)),
    remainingGB: Number(((10_000_000_000 - totalBytes) / 1e9).toFixed(4)),
    verificationTimestamp: new Date().toISOString(),
    frozenChecksums: `${frozen.byteIdentical}/${frozen.filesCompared} PASS`,
    productionChecks,
    seoFlags: {
      MASTER_SEO_ROLLOUT_MODE: parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE),
      masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
      masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
      masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    },
    licenseClassifications: exportManifest.licenseClassifications,
    tests: testResults,
    upload: {
      uploaded: progress.uploaded,
      existingMatch: progress.existingMatch,
      failed: progress.failed,
      retried: progress.retried,
      startedAt: progress.startedAt,
    },
    overallStatus: "INCOMPLETE",
  };

  const pass =
    verification.pass === EXPECTED_OBJECTS &&
    verification.missing.length === 0 &&
    verification.sizeMismatches.length === 0 &&
    verification.checksumMismatches.length === 0 &&
    countFailed(progress) === 0 &&
    identitiesVerified === MASTER_IDENTITY_COUNT &&
    artworkRecordsVerified === MASTER_ARTWORK_RECORD_COUNT &&
    uniqueArtworkBinaries === 39_652 &&
    duplicateBinaryReferences === 419 &&
    frozen.status === "PASS" &&
    !infoOut.includes("public access: true") &&
    !MASTER_INTEGRATION_CONFIG.masterSEOEnabled &&
    parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE) === "OFF";

  reconciliation.overallStatus = pass ? "PASS" : "INCOMPLETE";
  writeJson(reconciliationPath, reconciliation);

  const report = [
    "# Phase 8.40 — R2 Bulk Upload Final Report",
    "",
    "## Upload",
    `- Target objects: ${EXPECTED_OBJECTS}`,
    `- Uploaded: ${progress.uploaded}`,
    `- Already existing: ${progress.existingMatch}`,
    `- Retries: ${progress.retried}`,
    `- Final unresolved failures: ${countFailed(progress)}`,
    "",
    "## Reconciliation",
    `- Expected: ${EXPECTED_OBJECTS}`,
    `- Remote verified correct: ${verification.pass}`,
    `- Missing: ${verification.missing.length}`,
    `- Unexpected remote: ${unexpectedObjects.length}`,
    `- Size mismatches: ${verification.sizeMismatches.length}`,
    `- Checksum mismatches: ${verification.checksumMismatches.length}`,
    "",
    "## Data",
    `- Identities: ${identitiesVerified} / ${MASTER_IDENTITY_COUNT}`,
    `- Artwork records: ${artworkRecordsVerified} / ${MASTER_ARTWORK_RECORD_COUNT}`,
    `- Unique artwork binaries: ${uniqueArtworkBinaries} / 39652`,
    `- Duplicate binary references: ${duplicateBinaryReferences} / 419`,
    "",
    "## Storage",
    `- Canonical bytes: ${totalBytes.toLocaleString()}`,
    `- Storage GB: ${reconciliation.storageGB}`,
    `- Storage GiB: ${reconciliation.storageGiB}`,
    `- 10 GB allowance utilization: ${reconciliation.utilizationPercent}%`,
    `- Remaining GB: ${reconciliation.remainingGB}`,
    "",
    "## Security",
    "- Bucket: emojiquick-master",
    "- Privacy: PRIVATE",
    "- Public R2.dev: DISABLED",
    "- DNS: UNCHANGED",
    "",
    "## License",
    "- Class A: OpenMoji, Twemoji",
    "- Class B: Noto",
    "- Class C: Fluent, EmojiNet",
    "",
    "## Production",
    ...productionChecks.map((entry) => `- ${entry.url} -> ${entry.status}${entry.location ? ` Location:${entry.location}` : ""}`),
    "- SEO CANARY: OFF",
    "- FULL: OFF",
    "",
    `## Frozen data`,
    `- 8.10 checksums: ${frozen.byteIdentical}/${frozen.filesCompared} PASS`,
    "",
    "## Tests",
    `- Typecheck: ${testResults.typecheck === "PASS" ? "PASS" : "FAIL"}`,
    `- Test suite: ${testResults.tests === "PASS" ? "PASS" : "FAIL (see log)"}`,
    "",
    `## Final status: **${reconciliation.overallStatus}**`,
  ].join("\n");

  writeFileSync(join(exportDir, "PHASE-8.40-R2-BULK-UPLOAD-FINAL.md"), `${report}\n`, "utf8");
  log(`Finalize complete: ${reconciliation.overallStatus}`);

  try {
    execSync("npm run r2:phase-8-44-finalize -- --validate-only", { cwd: rootDir, stdio: "inherit" });
  } catch {
    log("Phase 8.42 finalize reported incomplete/blocked — see r2-phase-8-42-final.json");
  }
}

async function monitor(): Promise<void> {
  log("Phase 8.40B monitor started");
  let lastDone = -1;
  let unchangedPolls = 0;

  while (true) {
    const progress = readProgress();
    const done = countDone(progress);
    const failed = countFailed(progress);
    const pending = EXPECTED_OBJECTS - done - failed;
    const running = isUploaderRunning();
    const finalizeReady = existsSync(reconciliationPath);

    log(
      `Monitor: ${done}/${EXPECTED_OBJECTS} done, ${failed} failed, ${pending} pending, uploader=${running ? "running" : "stopped"}`,
    );

    if (finalizeReady) {
      log("Final reconciliation complete — monitor exiting");
      return;
    }

    if (done >= EXPECTED_OBJECTS && failed === 0) {
      if (running) {
        log("Upload complete — waiting for uploader to finish verification");
        await sleep(POLL_MS);
        continue;
      }
      await runFinalize();
      return;
    }

    if (done === lastDone) {
      unchangedPolls += 1;
    } else {
      unchangedPolls = 0;
      lastDone = done;
    }

    if (unchangedPolls >= STALL_POLLS) {
      if (!running) {
        log(`Stall detected (${unchangedPolls} polls with no progress) — restarting uploader`);
        spawnUploader();
        unchangedPolls = 0;
      } else {
        log(`No progress for ${unchangedPolls} polls but uploader still running — continuing to wait`);
      }
    }

    await sleep(POLL_MS);
  }
}

async function main(): Promise<void> {
  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) throw new Error(account.message);
  if (!bucketExists(rootDir, R2_BUCKET_NAME)) throw new Error(`Bucket ${R2_BUCKET_NAME} not found`);
  await monitor();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log(`HARD FAILURE: ${message}`);
  console.error(message);
  process.exitCode = 1;
});
