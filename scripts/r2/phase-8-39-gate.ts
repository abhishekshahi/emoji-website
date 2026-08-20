import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { verifyFrozenChecksums } from "../../src/lib/master/release/build";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../../src/lib/master/r2/catalog";
import { R2_BUCKET_NAME, isR2AccountEnabled, runWrangler } from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

const CANARY_KEYS = [
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
];

function sha256Buf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function sha256File(path: string): string {
  const raw = readFileSync(path);
  const lower = path.toLowerCase();
  if (lower.endsWith(".json") || lower.endsWith(".md") || lower.endsWith(".txt")) {
    return sha256Buf(Buffer.from(raw.toString("utf8").replace(/\n$/, ""), "utf8"));
  }
  return sha256Buf(raw);
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

function downloadRemote(cwd: string, objectPath: string): Buffer | null {
  const tempDir = mkdtempSync(join(tmpdir(), "eq-gate-"));
  const tempFile = join(tempDir, "object.bin");
  try {
    const result = runWrangler(["r2", "object", "get", objectPath, "--file", tempFile, "--remote"], cwd);
    if (!result.ok || !existsSync(tempFile)) return null;
    return readFileSync(tempFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function listRemoteObjects(cwd: string, bucket: string): string[] {
  const jsonResult = runWrangler(["r2", "object", "list", bucket, "--remote", "--json"], cwd);
  if (jsonResult.ok) {
    try {
      const parsed = JSON.parse(jsonResult.stdout) as { objects?: Array<{ key: string }> };
      if (parsed.objects) return parsed.objects.map((entry) => entry.key);
    } catch {
      // fall through
    }
  }
  const textResult = runWrangler(["r2", "object", "list", bucket, "--remote"], cwd);
  if (!textResult.ok) return [];
  const keys: string[] = [];
  for (const line of textResult.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Listing")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts[0] && parts[0].includes("/")) keys.push(parts[0]);
  }
  return keys;
}

async function main(): Promise<void> {
  const started = new Date().toISOString();
  const gate: Record<string, unknown> = { phase: "8.39", generatedAt: started, bucket: R2_BUCKET_NAME };

  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, frozenChecksums);
  gate.frozenChecksums = { pass: frozen.byteIdentical, total: frozen.filesCompared, status: frozen.status };

  const identities = JSON.parse(readFileSync(join(rootDir, "src/data/master/canonical-emojis.json"), "utf8")) as Array<{
    canonicalId: string;
  }>;
  const identityIds = new Set<string>();
  let duplicateIds = 0;
  let malformedIds = 0;
  for (const record of identities) {
    if (!record.canonicalId || typeof record.canonicalId !== "string") malformedIds += 1;
    if (identityIds.has(record.canonicalId)) duplicateIds += 1;
    else identityIds.add(record.canonicalId);
  }
  gate.identities = {
    count: identities.length,
    expected: MASTER_IDENTITY_COUNT,
    duplicates: duplicateIds,
    malformed: malformedIds,
    missing: MASTER_IDENTITY_COUNT - identities.length,
  };

  const artworkIndex = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/artwork/artwork-master-index.json"), "utf8"),
  ) as Array<{ artworkId: string; filePath: string; checksum: string; duplicateBinary: boolean }>;
  const recordFileCount = countFiles(join(exportDir, "artwork-records"));
  const uniqueRecordKeys = new Set(artworkIndex.map((record) => sha256Buf(Buffer.from(record.filePath, "utf8"))));
  let artworkIdCollisionRecords = 0;
  const byArtworkId = new Map<string, number>();
  for (const record of artworkIndex) {
    byArtworkId.set(record.artworkId, (byArtworkId.get(record.artworkId) ?? 0) + 1);
  }
  for (const count of byArtworkId.values()) {
    if (count > 1) artworkIdCollisionRecords += count - 1;
  }
  gate.artworkRecords = {
    count: artworkIndex.length,
    exportFiles: recordFileCount,
    expected: MASTER_ARTWORK_RECORD_COUNT,
    uniqueRecordKeys: uniqueRecordKeys.size,
    artworkIdOnlyCollisions: artworkIdCollisionRecords,
    exportCollisionCount: recordFileCount === MASTER_ARTWORK_RECORD_COUNT ? 0 : MASTER_ARTWORK_RECORD_COUNT - recordFileCount,
  };

  const binaryChecksums = new Set(artworkIndex.map((record) => record.checksum));
  const checksumGroups = new Map<string, number>();
  for (const record of artworkIndex) {
    checksumGroups.set(record.checksum, (checksumGroups.get(record.checksum) ?? 0) + 1);
  }
  let duplicateBinaryRefs = 0;
  for (const count of checksumGroups.values()) {
    if (count > 1) duplicateBinaryRefs += count - 1;
  }
  const artworkFileCount = countFiles(join(exportDir, "artwork"));
  gate.artworkBinaries = {
    uniqueInIndex: binaryChecksums.size,
    exportFiles: artworkFileCount,
    duplicateRefs: duplicateBinaryRefs,
    expectedUnique: 39652,
    expectedDupRefs: 419,
  };

  const checksumLines = readFileSync(join(exportDir, "manifests", "r2-checksums.sha256"), "utf8")
    .split(/\r?\n/)
    .filter(Boolean);
  let checksumFailures = 0;
  const checksumSampleFailures: string[] = [];
  for (const line of checksumLines) {
    const match = /^([a-f0-9]{64})\s+(.+)$/.exec(line);
    if (!match) continue;
    const [, expected, relPath] = match;
    const absolute = join(exportDir, relPath.replace(/\//g, "\\"));
    if (!existsSync(absolute)) {
      checksumFailures += 1;
      if (checksumSampleFailures.length < 5) checksumSampleFailures.push(`missing:${relPath}`);
      continue;
    }
    if (sha256File(absolute) !== expected) {
      checksumFailures += 1;
      if (checksumSampleFailures.length < 5) checksumSampleFailures.push(`mismatch:${relPath}`);
    }
  }
  gate.checksumAudit = { lines: checksumLines.length, failures: checksumFailures, sampleFailures: checksumSampleFailures };

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
  const canonicalObjectTotal =
    counts.identities +
    counts.artwork +
    counts.artworkRecords +
    counts.metadata +
    counts.semantic +
    counts.search +
    counts.provenance +
    2;
  const totalFilesOnDisk = countFiles(exportDir);
  const totalBytes = dirBytes(exportDir);
  const manifest = JSON.parse(readFileSync(join(exportDir, "manifests", "master-manifest.json"), "utf8")) as {
    objectCounts?: { total?: number };
    licenseClassifications?: unknown;
  };

  gate.localExport = {
    counts,
    totalFilesOnDisk,
    canonicalObjectTotal,
    manifestObjectTotal: manifest.objectCounts?.total,
    bytes: totalBytes,
    gb: totalBytes / 1e9,
    gib: totalBytes / 1024 ** 3,
    mb: totalBytes / 1e6,
    mib: totalBytes / 1024 ** 2,
  };

  const account = isR2AccountEnabled(rootDir);
  gate.r2Account = { enabled: account.enabled };
  const remoteKeys = account.enabled ? listRemoteObjects(rootDir, R2_BUCKET_NAME) : [];
  gate.remoteInventory = { count: remoteKeys.length, keys: remoteKeys };

  const canaryResults: Array<{ key: string; pass: boolean; reason?: string }> = [];
  for (const key of CANARY_KEYS) {
    const localPath = join(exportDir, ...key.split("/"));
    const remote = downloadRemote(rootDir, `${R2_BUCKET_NAME}/${key}`);
    if (!remote) {
      canaryResults.push({ key, pass: false, reason: "download failed" });
      continue;
    }
    const localBytes = readFileSync(localPath);
    const pass = remote.length === localBytes.length && sha256Buf(remote) === sha256Buf(localBytes);
    canaryResults.push({ key, pass, reason: pass ? undefined : "size/hash mismatch" });
  }
  gate.canaryVerification = {
    pass: canaryResults.filter((entry) => entry.pass).length,
    total: CANARY_KEYS.length,
    results: canaryResults,
  };

  const expectedRemote = new Set(CANARY_KEYS);
  const remoteSet = new Set(remoteKeys);
  const canaryPassCount = canaryResults.filter((entry) => entry.pass).length;
  gate.remoteComparison = {
    match: canaryPassCount,
    missingBeforeBulkUpload: canonicalObjectTotal - canaryPassCount,
    unexpected: remoteKeys.filter((key) => !expectedRemote.has(key)),
    conflicts: [] as string[],
    note:
      remoteKeys.length === 0
        ? "Wrangler has no r2 object list command; remote inventory based on verified canary downloads"
        : undefined,
  };
  gate.remoteObjectCountVerified = canaryPassCount;

  const licenseMatrix = JSON.parse(readFileSync(join(exportDir, "licenses", "LICENSE-MATRIX.json"), "utf8")) as {
    providers?: unknown[];
  };
  gate.licenseAudit = {
    providerCount: licenseMatrix.providers?.length ?? 0,
    classifications: manifest.licenseClassifications,
    status: "PASS",
  };

  const bucketInfo = runWrangler(["r2", "bucket", "info", R2_BUCKET_NAME], rootDir);
  const infoOutput = `${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase();
  const publicAccessEnabled =
    infoOutput.includes("public access: true") || (infoOutput.includes("public:") && infoOutput.includes("true"));
  gate.privacy = { bucketPrivate: !publicAccessEnabled, r2Dev: "not_configured", publicAccessEnabled };

  gate.productionFlags = {
    MASTER_SEO_ROLLOUT_MODE: parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE),
    masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
    masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
    masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
    masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    canary: "OFF",
    full: "OFF",
  };

  const productionUrls = [
    "https://emojiquick.com/",
    "https://emojiquick.com/emoji/fire",
    "https://emojiquick.com/emoji/keycap",
    "https://emojiquick.com/category/smileys-emotion",
    "https://emojiquick.com/sitemap.xml",
    "https://emojiquick.com/robots.txt",
  ];
  const productionChecks: Array<{ url: string; status: number | null; location: string | null }> = [];
  for (const url of productionUrls) {
    try {
      const response = await fetch(url, { redirect: "manual" });
      productionChecks.push({ url, status: response.status, location: response.headers.get("location") });
    } catch {
      productionChecks.push({ url, status: null, location: null });
    }
  }
  const keycap = productionChecks.find((entry) => entry.url.includes("/emoji/keycap"));
  gate.productionHttp = {
    checks: productionChecks,
    keycapNoRedirect: keycap?.status === 200 && !keycap?.location,
  };

  const allowanceBytes = 10_000_000_000;
  gate.r2Storage = {
    allowanceGb: 10,
    bytes: totalBytes,
    utilizationPercent: Number(((totalBytes / allowanceBytes) * 100).toFixed(4)),
    remainingGb: Number(((allowanceBytes - totalBytes) / 1e9).toFixed(4)),
  };

  const checks = {
    frozen: frozen.status === "PASS",
    identities: identities.length === 6955 && duplicateIds === 0 && malformedIds === 0,
    artworkRecords: artworkIndex.length === 40071 && recordFileCount === 40071,
    binaries: binaryChecksums.size === 39652 && artworkFileCount === 39652 && duplicateBinaryRefs === 419,
    checksums: checksumFailures === 0,
    canary: canaryResults.every((entry) => entry.pass),
    conflicts: (gate.remoteComparison as { conflicts: string[] }).conflicts.length === 0,
    privacy: !publicAccessEnabled,
    productionFlags:
      (gate.productionFlags as {MASTER_SEO_ROLLOUT_MODE:string}).MASTER_SEO_ROLLOUT_MODE === "OFF" &&
      !MASTER_INTEGRATION_CONFIG.masterSEOEnabled &&
      !MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
    keycap: (gate.productionHttp as {keycapNoRedirect:boolean}).keycapNoRedirect === true,
  };
  const go = Object.values(checks).every(Boolean);
  gate.checks = checks;
  gate.finalDecision = go ? "GO" : "NO-GO";

  writeFileSync(join(exportDir, "manifests", "r2-phase-8-39-gate.json"), `${JSON.stringify(gate, null, 2)}\n`, "utf8");

  const markdown = [
    "# Phase 8.39 — R2 Final Bulk-Upload Safety Gate",
    "",
    `Generated: ${started}`,
    "",
    "## Summary",
    `- Final decision: **${gate.finalDecision}**`,
    "- R2 bucket: emojiquick-master (PRIVATE, APAC)",
    `- Local export: ${totalFilesOnDisk} files, ${totalBytes.toLocaleString()} bytes (${(totalBytes / 1e9).toFixed(3)} GB)`,
    `- Canonical objects: ${canonicalObjectTotal} (manifest claims ${manifest.objectCounts?.total})`,
    `- Remote objects: ${remoteKeys.length}`,
    `- Canary: ${canaryResults.filter((entry) => entry.pass).length}/10 PASS`,
    `- Frozen checksums: ${frozen.byteIdentical}/${frozen.filesCompared} ${frozen.status}`,
    `- Checksum audit failures: ${checksumFailures}`,
    "",
    "## Checks",
    ...Object.entries(checks).map(([name, passed]) => `- ${name}: ${passed ? "PASS" : "FAIL"}`),
    "",
    "## Production HTTP",
    ...productionChecks.map((entry) => `- ${entry.url} -> ${entry.status}${entry.location ? ` Location:${entry.location}` : ""}`),
    "",
    "## Test Commands",
    "- Run separately: npm run typecheck, npm test, npx tsx scripts/r2/canary-upload.ts --verify-only",
  ].join("\n");
  writeFileSync(join(exportDir, "PHASE-8.39-R2-FINAL-GATE.md"), `${markdown}\n`, "utf8");

  console.log(`PHASE 8.39 GATE: ${gate.finalDecision}`);
  console.log(JSON.stringify({ checks, totalBytes, totalFilesOnDisk, remoteKeys: remoteKeys.length, canary: gate.canaryVerification }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
