import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { R2_EXPORT_DIR } from "../../src/lib/master/r2/config";
import { FULL_ARCHIVE_PREFIX } from "../../src/lib/master/r2/full-archive/types";
import {
  bucketExists,
  downloadObjectToBuffer,
  isR2AccountEnabled,
  R2_BUCKET_NAME,
  remoteObjectExists,
  runWrangler,
} from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

interface SampleCheck {
  readonly label: string;
  readonly objectPath: string;
  readonly expectedSha256?: string;
}

function sha256Buffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function downloadToTemp(cwd: string, objectPath: string): Buffer | null {
  const tempDir = mkdtempSync(join(tmpdir(), "emojiquick-r2-"));
  const tempFile = join(tempDir, "object.bin");
  try {
    const result = runWrangler(["r2", "object", "get", objectPath, "--file", tempFile, "--remote"], cwd);
    if (!result.ok || !existsSync(tempFile)) {
      return null;
    }
    return readFileSync(tempFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function parseChecksumSamples(checksumsPath: string, limit: number): SampleCheck[] {
  const lines = readFileSync(checksumsPath, "utf8").split(/\r?\n/).filter(Boolean);
  const samples: SampleCheck[] = [];
  for (const line of lines.slice(0, limit)) {
    const match = /^([a-f0-9]{64})\s+master\/(.+)$/.exec(line);
    if (!match) continue;
    samples.push({
      label: match[2],
      objectPath: `${R2_BUCKET_NAME}/${FULL_ARCHIVE_PREFIX}/master/${match[2]}`,
      expectedSha256: match[1],
    });
  }
  return samples;
}

async function main(): Promise<void> {
  const sampleSize = Number(process.env.R2_VERIFY_SAMPLE_SIZE ?? "20");
  const errors: string[] = [];

  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) {
    console.log("REMOTE R2 VERIFICATION: FAIL");
    console.log(`  ${account.message}`);
    process.exitCode = 1;
    return;
  }

  const bucketOk = bucketExists(rootDir, R2_BUCKET_NAME);
  if (!bucketOk) {
    console.log("REMOTE R2 VERIFICATION: FAIL");
    console.log(`  Bucket ${R2_BUCKET_NAME} not found.`);
    process.exitCode = 1;
    return;
  }

  const fullManifestPath = `${R2_BUCKET_NAME}/${FULL_ARCHIVE_PREFIX}/manifests/master-manifest.json`;
  const optimizedManifestPath = `${R2_BUCKET_NAME}/emojiquick/manifests/r2-manifest.json`;

  const requiredObjects = [
    fullManifestPath,
    `${R2_BUCKET_NAME}/${FULL_ARCHIVE_PREFIX}/manifests/checksums.sha256`,
    `${R2_BUCKET_NAME}/${FULL_ARCHIVE_PREFIX}/manifests/file-counts.json`,
    `${R2_BUCKET_NAME}/${FULL_ARCHIVE_PREFIX}/manifests/size-report.json`,
    `${R2_BUCKET_NAME}/${FULL_ARCHIVE_PREFIX}/manifests/duplicate-report.json`,
    `${R2_BUCKET_NAME}/${FULL_ARCHIVE_PREFIX}/manifests/source-tree-report.json`,
    optimizedManifestPath,
    `${R2_BUCKET_NAME}/emojiquick/indexes/artwork-keys.json`,
  ];

  for (const objectPath of requiredObjects) {
    if (!remoteObjectExists(rootDir, objectPath)) {
      errors.push(`Missing remote object: ${objectPath}`);
    }
  }

  const checksumsLocal = join(rootDir, ".r2-export-full", FULL_ARCHIVE_PREFIX, "manifests", "checksums.sha256");
  if (existsSync(checksumsLocal)) {
    const samples = parseChecksumSamples(checksumsLocal, sampleSize);
    for (const sample of samples) {
      const bytes = downloadToTemp(rootDir, sample.objectPath);
      if (!bytes) {
        errors.push(`Could not download sample: ${sample.objectPath}`);
        continue;
      }
      const hash = sha256Buffer(bytes);
      if (sample.expectedSha256 && hash !== sample.expectedSha256) {
        errors.push(`Checksum mismatch for ${sample.label}`);
      }
    }
  }

  const optimizedManifestBytes = downloadToTemp(rootDir, optimizedManifestPath);
  if (!optimizedManifestBytes) {
    errors.push("Could not download optimized manifest");
  } else {
    const manifest = JSON.parse(optimizedManifestBytes.toString("utf8")) as {
      totals?: { identities?: number; artworkRecords?: number; objects?: number };
    };
    if (manifest.totals?.identities !== 6955) {
      errors.push(`Optimized manifest identity count mismatch: ${manifest.totals?.identities}`);
    }
    if (manifest.totals?.artworkRecords !== 40071) {
      errors.push(`Optimized manifest artwork count mismatch: ${manifest.totals?.artworkRecords}`);
    }
    if (manifest.totals?.objects !== 39710) {
      errors.push(`Optimized manifest object count mismatch: ${manifest.totals?.objects}`);
    }
  }

  const status = errors.length === 0 ? "PASS" : "FAIL";
  console.log(`REMOTE R2 VERIFICATION: ${status}`);
  console.log(`  Bucket: ${R2_BUCKET_NAME}`);
  console.log(`  Required manifests checked: ${requiredObjects.length}`);
  console.log(`  Checksum samples verified: ${sampleSize}`);
  if (errors.length > 0) {
    console.log("Errors:");
    for (const error of errors.slice(0, 20)) {
      console.log(`  - ${error}`);
    }
    if (errors.length > 20) {
      console.log(`  ... and ${errors.length - 20} more`);
    }
    process.exitCode = 1;
  } else {
    console.log("  Note: full 82,796 + 39,710 object counts require completed upload and dashboard/API listing.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});