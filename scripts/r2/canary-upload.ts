import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { verifyFrozenChecksums } from "../../src/lib/master/release/build";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";
import {
  assertUploadPreconditions,
  requireUploadConfirmation,
} from "./upload-engine";
import {
  bucketExists,
  isR2AccountEnabled,
  R2_BUCKET_NAME,
  remoteObjectExists,
  runWrangler,
  uploadObject,
} from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const CANARY_COUNT = 10;

interface CanaryObject {
  readonly label: string;
  readonly localPath: string;
  readonly objectKey: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly contentType: string;
}

interface CanaryManifest {
  readonly phase: "8.38";
  readonly bucket: typeof R2_BUCKET_NAME;
  readonly generatedAt: string;
  readonly objects: readonly CanaryObject[];
}

interface VerificationEntry extends CanaryObject {
  readonly exists: boolean;
  readonly actualBytes: number | null;
  readonly actualSha256: string | null;
  readonly actualContentType: string | null;
  readonly status: "PASS" | "FAIL";
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function contentTypeFor(path: string): string {
  switch (extname(path).toLowerCase()) {
    case ".json":
      return "application/json";
    case ".svg":
      return "image/svg+xml";
    case ".md":
      return "text/markdown";
    default:
      return "application/octet-stream";
  }
}

function buildCanarySelection(): CanaryObject[] {
  const canonicalSlug = "unicode_1F600";
  const openmojiSvg1 = "f3d5483791b88975bb0f4db7dc7b81439dfe18b02123bf81ad8bc984169651c6.svg";
  const openmojiSvg2 = "cce976a0def9c94f5a81db3fdcfb46a2438b3d6852987c6b1f2d70631bed93dc.svg";
  const artworkRecord = "1cd742197b9c891cea1430930e1aa4c095128e46f0b7fe94842355bc3651b811.json";

  const relativePaths = [
    { label: "identity", path: `identities/${canonicalSlug}.json` },
    { label: "metadata", path: `metadata/${canonicalSlug}.json` },
    { label: "semantic", path: `semantic/${canonicalSlug}.json` },
    { label: "search", path: `search/${canonicalSlug}.json` },
    { label: "provenance", path: `provenance/${canonicalSlug}.json` },
    { label: "artwork-record-openmoji", path: `artwork-records/${artworkRecord}` },
    { label: "artwork-openmoji-svg-1", path: `artwork/${openmojiSvg1}` },
    { label: "artwork-openmoji-svg-2", path: `artwork/${openmojiSvg2}` },
    { label: "manifest", path: "manifests/master-manifest.json" },
    { label: "license-matrix", path: "licenses/LICENSE-MATRIX.json" },
  ];

  return relativePaths.map(({ label, path }) => {
    const localPath = join(exportDir, path);
    if (!existsSync(localPath)) {
      throw new Error(`Canary file missing: ${localPath}`);
    }
    return {
      label,
      localPath,
      objectKey: path.replace(/\\/g, "/"),
      bytes: statSync(localPath).size,
      sha256: sha256File(localPath),
      contentType: contentTypeFor(localPath),
    };
  });
}

function objectPath(objectKey: string): string {
  return `${R2_BUCKET_NAME}/${objectKey}`;
}

function downloadObjectToBuffer(cwd: string, objectPathValue: string): Buffer | null {
  const tempDir = mkdtempSync(join(tmpdir(), "emojiquick-r2-canary-"));
  const tempFile = join(tempDir, "object.bin");
  try {
    const result = runWrangler(["r2", "object", "get", objectPathValue, "--file", tempFile, "--remote"], cwd);
    if (!result.ok || !existsSync(tempFile)) {
      return null;
    }
    return readFileSync(tempFile);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const execute = process.argv.includes("--execute");
  const verifyOnly = process.argv.includes("--verify-only");

  console.log("Phase 8.38 — R2 10-object canary upload");
  console.log("");

  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) {
    console.error("R2 NOT AVAILABLE:", account.message);
    process.exitCode = 2;
    return;
  }
  console.log("R2 account: authentication successful");

  const objects = buildCanarySelection();
  if (objects.length !== CANARY_COUNT) {
    throw new Error(`Expected ${CANARY_COUNT} canary objects, got ${objects.length}`);
  }

  const manifest: CanaryManifest = {
    phase: "8.38",
    bucket: R2_BUCKET_NAME,
    generatedAt: new Date().toISOString(),
    objects,
  };
  const manifestPath = join(exportDir, "manifests", "r2-canary-manifest.json");
  writeJson(manifestPath, manifest);
  console.log(`Canary manifest: ${relative(rootDir, manifestPath)}`);
  console.log("");
  console.log("DRY-RUN — exactly 10 object keys:");
  for (const [index, object] of objects.entries()) {
    console.log(`  ${index + 1}. ${object.objectKey}`);
  }
  console.log("");
  console.log(`Object count: ${objects.length}`);

  if (dryRun && !execute && !verifyOnly) {
    console.log("Dry run complete. No upload performed.");
    return;
  }

  if (verifyOnly) {
    await verifyUploaded(objects);
    return;
  }

  if (!execute) {
    console.log("Pass --execute to upload after reviewing the dry-run list.");
    return;
  }

  const bucketPresent = bucketExists(rootDir, R2_BUCKET_NAME);
  if (!bucketPresent) {
    console.error(`Bucket ${R2_BUCKET_NAME} not found. Create it first.`);
    process.exitCode = 2;
    return;
  }
  console.log(`Bucket ${R2_BUCKET_NAME}: found (private)`);

  assertUploadPreconditions(rootDir);
  const confirmed = await requireUploadConfirmation(
    `Upload exactly ${CANARY_COUNT} canary objects to ${R2_BUCKET_NAME}? YES/NO `,
  );
  if (!confirmed) {
    console.log("Upload cancelled.");
    return;
  }

  let uploaded = 0;
  for (const object of objects) {
    const result = uploadObject(rootDir, objectPath(object.objectKey), object.localPath, object.contentType);
    if (!result.ok) {
      throw new Error(`Upload failed for ${object.objectKey}: ${result.stderr.trim() || result.stdout.trim()}`);
    }
    uploaded += 1;
    console.log(`Uploaded ${uploaded}/${CANARY_COUNT}: ${object.objectKey}`);
  }

  await verifyUploaded(objects, uploaded);
}

async function verifyUploaded(objects: CanaryObject[], uploaded = objects.length): Promise<void> {
  const verifications: VerificationEntry[] = [];
  for (const object of objects) {
    const path = objectPath(object.objectKey);
    const exists = remoteObjectExists(rootDir, path);
    const bytes = downloadObjectToBuffer(rootDir, path);
    const actualSha256 = bytes ? createHash("sha256").update(bytes).digest("hex") : null;
    const actualBytes = bytes?.length ?? null;
    const pass =
      exists &&
      actualBytes === object.bytes &&
      actualSha256 === object.sha256;

    verifications.push({
      ...object,
      exists,
      actualBytes,
      actualSha256,
      actualContentType: object.contentType,
      status: pass ? "PASS" : "FAIL",
    });

    if (!pass) {
      console.error(`VERIFICATION FAIL: ${object.objectKey}`);
      const verificationPath = join(exportDir, "manifests", "r2-canary-verification.json");
      writeJson(verificationPath, {
        phase: "8.38",
        generatedAt: new Date().toISOString(),
        uploaded,
        passCount: verifications.filter((entry) => entry.status === "PASS").length,
        objects: verifications,
      });
      process.exitCode = 1;
      return;
    }
  }

  const verificationPath = join(exportDir, "manifests", "r2-canary-verification.json");
  writeJson(verificationPath, {
    phase: "8.38",
    generatedAt: new Date().toISOString(),
    uploaded,
    passCount: verifications.length,
    objects: verifications,
    publicAccessTest: "pending",
  });

  console.log("");
  console.log(`Verification: ${verifications.length}/${CANARY_COUNT} PASS`);

  const frozenChecksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, frozenChecksums);
  console.log(`Frozen 8.10 checksums: ${frozen.byteIdentical}/${frozen.filesCompared} ${frozen.status}`);

  console.log("Production flags:");
  console.log(`  MASTER_SEO_ROLLOUT_MODE=${parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE)}`);
  console.log(`  masterSEOEnabled=${MASTER_INTEGRATION_CONFIG.masterSEOEnabled}`);
  console.log(`  masterArtworkEnabled=${MASTER_INTEGRATION_CONFIG.masterArtworkEnabled}`);
  console.log(`  masterMetadataEnabled=${MASTER_INTEGRATION_CONFIG.masterMetadataEnabled}`);
  console.log(`  masterSearchEnabled=${MASTER_INTEGRATION_CONFIG.masterSearchEnabled}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
