import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, existsSync } from "node:fs";
import { R2_FULL_EXPORT_DIR } from "../../src/lib/master/r2/config";
import { FULL_ARCHIVE_PREFIX } from "../../src/lib/master/r2/full-archive/types";
import type { FullArchiveManifest } from "../../src/lib/master/r2/full-archive/types";
import { verifyFullArchive } from "../../src/lib/master/r2/full-archive/verify";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "../../src/lib/master/artwork/types";
import {
  assertUploadPreconditions,
  collectUploadFiles,
  requireUploadConfirmation,
  uploadDirectory,
} from "./upload-engine";
import { isR2AccountEnabled } from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportRootDir = join(rootDir, R2_FULL_EXPORT_DIR, FULL_ARCHIVE_PREFIX);

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const maxFilesArg = process.argv.find((arg) => arg.startsWith("--max="));
  const maxFiles = maxFilesArg ? Number(maxFilesArg.split("=")[1]) : undefined;
  const skipExisting = process.argv.includes("--skip-existing");

  const manifestPath = join(exportRootDir, "manifests", "master-manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error("Full archive manifest not found. Run npm run r2:prepare-full first.");
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FullArchiveManifest;

  const canonicalRecords = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/canonical-emojis.json"), "utf8"),
  ) as CanonicalEmojiRecord[];
  const artworkRecords = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/artwork/artwork-master-index.json"), "utf8"),
  ) as ArtworkMasterRecord[];

  const localVerify = await verifyFullArchive({
    projectRoot: rootDir,
    sourceRoot: join(rootDir, "src/data/master"),
    exportRootDir,
    canonicalRecords,
    artworkRecords,
    deep: false,
  });
  if (localVerify.status !== "PASS") {
    throw new Error(`Local full archive verification failed: ${localVerify.errors.slice(0, 3).join("; ")}`);
  }

  const files = collectUploadFiles(exportRootDir);
  console.log("WARNING: This will upload the COMPLETE EmojiQuick master archive to Cloudflare R2.");
  console.log(`Expected objects: ${manifest.totals.r2Objects}`);
  console.log(`Expected bytes: ${manifest.totals.bytes.toLocaleString()}`);
  console.log(`Local files found: ${files.length}`);
  console.log(`Export dir: ${exportRootDir}`);
  console.log(`Prefix: ${FULL_ARCHIVE_PREFIX}/`);
  console.log("");

  if (dryRun) {
    console.log("Dry run only. No upload performed.");
    return;
  }

  const account = isR2AccountEnabled(rootDir);
  if (!account.enabled) {
    console.error(account.message);
    console.error("Enable R2 in Cloudflare Dashboard, then rerun this command.");
    process.exitCode = 2;
    return;
  }

  const confirmed = await requireUploadConfirmation("Continue? YES/NO ");
  if (!confirmed) {
    console.log("Upload cancelled.");
    return;
  }

  assertUploadPreconditions(rootDir);
  const result = await uploadDirectory({
    projectRoot: rootDir,
    exportRootDir,
    r2KeyPrefix: FULL_ARCHIVE_PREFIX,
    skipExisting,
    maxFiles,
  });

  console.log("");
  console.log("FULL ARCHIVE UPLOAD COMPLETE");
  console.log(`  Uploaded: ${result.uploaded}`);
  console.log(`  Skipped: ${result.skipped}`);
  console.log(`  Failed: ${result.failed}`);
  console.log(`  Total processed: ${result.total}`);
  console.log("Next: npm run r2:verify-remote");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});