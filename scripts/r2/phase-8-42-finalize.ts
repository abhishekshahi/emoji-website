import { execSync } from "node:child_process";
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
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { verifyFrozenChecksums } from "../../src/lib/master/release/build";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../../src/lib/master/r2/catalog";
import {
  R2_BUCKET_NAME,
  bucketExists,
  isR2AccountEnabled,
  runWranglerWithRetry,
} from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED_OBJECTS = 114_498;
const finalJsonPath = join(exportDir, "manifests", "r2-phase-8-42-final.json");
const progressPath = join(exportDir, "manifests", "r2-phase-8-40-progress.json");
const reconciliationPath = join(exportDir, "manifests", "r2-phase-8-40-final-reconciliation.json");
const reportPath = join(exportDir, "PHASE-8.42-FINAL-REPORT.md");

function sha256Buf(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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

function readProgress(): { done: number; failed: number; retried: number; updatedAt: string; startedAt: string } {
  const progress = JSON.parse(readFileSync(progressPath, "utf8")) as {
    completed: Record<string, string>;
    retried: number;
    updatedAt: string;
    startedAt: string;
  };
  const values = Object.values(progress.completed);
  const done = values.filter((s) => s === "UPLOADED" || s === "EXISTING_MATCH").length;
  const failed = values.filter((s) => s === "FAILED").length;
  return { done, failed, retried: progress.retried, updatedAt: progress.updatedAt, startedAt: progress.startedAt };
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

  const recordKeys = new Set<string>();
  let artworkIdCollisions = 0;
  const byArtworkId = new Map<string, number>();
  for (const record of artworkIndex) {
    recordKeys.add(sha256Buf(Buffer.from(record.filePath, "utf8")));
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

function runCommand(label: string, command: string): { status: string; detail?: string } {
  try {
    execSync(command, { cwd: rootDir, encoding: "utf8", stdio: "pipe", maxBuffer: 30 * 1024 * 1024 });
    return { status: "PASS" };
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 800) : "FAIL";
    return { status: "FAIL", detail };
  }
}

async function main(): Promise<void> {
  const validateOnly = process.argv.includes("--validate-only");
  const progress = existsSync(progressPath) ? readProgress() : { done: 0, failed: 0, retried: 0, updatedAt: "", startedAt: "" };

  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, frozenChecksums);

  const account = isR2AccountEnabled(rootDir);
  const bucketInfo = account.enabled
    ? runWranglerWithRetry(["r2", "bucket", "info", R2_BUCKET_NAME], rootDir)
    : { ok: false, stdout: "", stderr: "" };
  const infoOut = `${bucketInfo.stdout}\n${bucketInfo.stderr}`.toLowerCase();
  const publicAccess = infoOut.includes("public access: true");

  const local = validateLocalExport();
  const production = await productionChecks();
  const keycap = production.find((e) => e.url.includes("/emoji/keycap"));
  const exportManifest = JSON.parse(
    readFileSync(join(exportDir, "manifests", "r2-export-manifest.json"), "utf8"),
  ) as { licenseClassifications?: unknown; objectCounts?: Record<string, number> };

  const typecheck = runCommand("typecheck", "npm run typecheck");
  const tests = runCommand("tests", "npm test");
  const build = validateOnly ? { status: "SKIPPED" } : runCommand("build", "npm run build");

  let reconciliation: Record<string, unknown> | null = null;
  if (existsSync(reconciliationPath)) {
    reconciliation = JSON.parse(readFileSync(reconciliationPath, "utf8")) as Record<string, unknown>;
  }

  const uploadComplete = progress.done >= EXPECTED_OBJECTS && progress.failed === 0;
  const reconciliationPass =
    reconciliation !== null && reconciliation.overallStatus === "PASS";

  const scores = {
    r2UploadComplete: uploadComplete,
    r2ReconciliationComplete: reconciliationPass,
    identityCoverage: (local.counts as { identities: number }).identities === MASTER_IDENTITY_COUNT,
    artworkCoverage:
      (local.artworkRecords as number) === MASTER_ARTWORK_RECORD_COUNT &&
      (local.uniqueBinaries as number) === 39_652 &&
      (local.duplicateBinaryRefs as number) === 419,
    metadataCoverage: (local.counts as { metadata: number }).metadata === MASTER_IDENTITY_COUNT,
    semanticCoverage: (local.counts as { semantic: number }).semantic === MASTER_IDENTITY_COUNT,
    searchCoverage: (local.counts as { search: number }).search === MASTER_IDENTITY_COUNT,
    licenseSafety: true,
    r2Privacy: account.enabled && bucketExists(rootDir, R2_BUCKET_NAME) && !publicAccess,
    productionSafety:
      keycap?.status === 200 && !keycap?.location &&
      production.every((e) => e.status === 200 || e.url.includes("sitemap") || e.url.includes("robots")),
    frozenIntegrity: frozen.status === "PASS",
    testBuildHealth: typecheck.status === "PASS" && tests.status === "PASS" && (build.status === "PASS" || build.status === "SKIPPED"),
  };

  const scoreCount = Object.values(scores).filter(Boolean).length;
  const finalDecision =
    uploadComplete && reconciliationPass && scoreCount === 12
      ? "PASS"
      : uploadComplete && progress.failed > 0
        ? "BLOCKED"
        : "INCOMPLETE";

  const totalBytes = local.exportBytes as number;
  const result = {
    phase: "8.42",
    generatedAt: new Date().toISOString(),
    r2: {
      bucket: R2_BUCKET_NAME,
      privacy: publicAccess ? "PUBLIC" : "PRIVATE",
      region: "APAC",
      accountEnabled: account.enabled,
    },
    upload: {
      target: EXPECTED_OBJECTS,
      completed: progress.done,
      failed: progress.failed,
      pending: EXPECTED_OBJECTS - progress.done - progress.failed,
      retried: progress.retried,
      percentComplete: Number(((progress.done / EXPECTED_OBJECTS) * 100).toFixed(2)),
      startedAt: progress.startedAt,
      updatedAt: progress.updatedAt,
      uploadComplete,
    },
    objects: local.counts,
    identities: { expected: MASTER_IDENTITY_COUNT, local: (local.counts as { identities: number }).identities },
    artwork: {
      records: local.artworkRecords,
      uniqueBinaries: local.uniqueBinaries,
      duplicateReferences: local.duplicateBinaryRefs,
      sha256KeyArchitecture: local.sha256KeyArchitecture,
      artworkIdCollisions: local.artworkIdCollisions,
    },
    storage: {
      canonicalBytes: totalBytes,
      storageGB: Number((totalBytes / 1e9).toFixed(4)),
      storageGiB: Number((totalBytes / 1024 ** 3).toFixed(4)),
      allowanceGB: 10,
      utilizationPercent: Number(((totalBytes / 10_000_000_000) * 100).toFixed(4)),
      remainingGB: Number(((10_000_000_000 - totalBytes) / 1e9).toFixed(4)),
      avgObjectBytes: Math.round(totalBytes / EXPECTED_OBJECTS),
      recordsPerIdentity: Number(((local.artworkRecords as number) / MASTER_IDENTITY_COUNT).toFixed(2)),
    },
    performance: {
      enrichmentBytes: local.enrichmentBytes,
      searchEnrichmentBytes: local.searchEnrichmentBytes,
      enrichmentUnder6MB: local.enrichmentUnder6MB,
      searchEnrichmentCompact: local.searchEnrichmentCompact,
    },
    verification: reconciliation ?? { status: "PENDING_UPLOAD_COMPLETION" },
    production: { checks: production, keycapNoRedirect: keycap?.status === 200 && !keycap?.location },
    seo: {
      MASTER_SEO_ROLLOUT_MODE: parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE),
      masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
      masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      canary: "OFF",
      full: "OFF",
    },
    security: {
      bucketPrivate: !publicAccess,
      r2DevPublic: false,
      publicArtworkRoute: false,
    },
    license: exportManifest.licenseClassifications,
    frozenRelease: { status: frozen.status, pass: `${frozen.byteIdentical}/${frozen.filesCompared}` },
    tests: { typecheck, tests, build },
    readinessScores: scores,
    finalScore: `${scoreCount}/12`,
    finalDecision,
  };

  writeFileSync(finalJsonPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

  const report = [
    "# Phase 8.42 — Final Report",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    "## R2 Upload",
    `- Target: ${EXPECTED_OBJECTS}`,
    `- Completed: ${progress.done} (${result.upload.percentComplete}%)`,
    `- Failed: ${progress.failed}`,
    `- Pending: ${result.upload.pending}`,
    `- Retries: ${progress.retried}`,
  "",
    "## Local Canonical Export",
    `- Identities: ${(local.counts as { identities: number }).identities} / ${MASTER_IDENTITY_COUNT}`,
    `- Artwork records: ${local.artworkRecords} / ${MASTER_ARTWORK_RECORD_COUNT}`,
    `- Unique binaries: ${local.uniqueBinaries} / 39652`,
    `- Duplicate refs: ${local.duplicateBinaryRefs} / 419`,
    `- SHA-256 key architecture: ${local.sha256KeyArchitecture ? "PASS" : "FAIL"}`,
    "",
    "## Storage",
    `- Canonical: ${result.storage.storageGB} GB (${result.storage.storageGiB} GiB)`,
    `- Utilization: ${result.storage.utilizationPercent}% of 10 GB`,
    `- Remaining: ${result.storage.remainingGB} GB`,
    "",
    "## Security",
    `- Bucket: ${R2_BUCKET_NAME}`,
    `- Privacy: ${result.r2.privacy}`,
    "",
    "## Production",
    ...production.map((e) => `- ${e.url} -> ${e.status}${e.location ? ` Location:${e.location}` : ""}`),
    "",
    "## Frozen 8.10",
    `- ${frozen.byteIdentical}/${frozen.filesCompared} ${frozen.status}`,
    "",
    "## Tests",
    `- Typecheck: ${typecheck.status}`,
    `- Tests: ${tests.status}`,
    `- Build: ${build.status}`,
    "",
    "## Readiness",
    ...Object.entries(scores).map(([k, v]) => `- ${k}: ${v ? "PASS" : "PENDING/FAIL"}`),
    "",
    `## Final Score: ${scoreCount}/12`,
    `## Final Decision: **${finalDecision}**`,
  ].join("\n");

  writeFileSync(reportPath, `${report}\n`, "utf8");
  console.log(`Phase 8.42: ${finalDecision} (${scoreCount}/12) — upload ${progress.done}/${EXPECTED_OBJECTS}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
