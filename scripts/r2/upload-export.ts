import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { R2_EXPORT_DIR } from "../../src/lib/master/r2/config";
import { verifyR2Export } from "../../src/lib/master/r2/export/verify";
import type { R2Manifest } from "../../src/lib/master/r2/types";
import { R2_BUCKET_PREFIX } from "../../src/lib/master/r2/types";
import {
  assertUploadPreconditions,
  collectUploadFiles,
  requireUploadConfirmation,
  uploadDirectory,
} from "./upload-engine";
import { isR2AccountEnabled } from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportRootDir = join(rootDir, R2_EXPORT_DIR, R2_BUCKET_PREFIX);

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");
  const maxFilesArg = process.argv.find((arg) => arg.startsWith("--max="));
  const maxFiles = maxFilesArg ? Number(maxFilesArg.split("=")[1]) : undefined;
  const skipExisting = process.argv.includes("--skip-existing");

  const verify = verifyR2Export(exportRootDir);
  if (verify.status !== "PASS") {
    throw new Error(`Export verification FAILED: ${verify.errors.slice(0, 5).join("; ")}`);
  }

  const manifest = JSON.parse(
    readFileSync(join(exportRootDir, "manifests", "r2-manifest.json"), "utf8"),
  ) as R2Manifest;
  const files = collectUploadFiles(exportRootDir);

  console.log("WARNING: This will upload the OPTIMIZED EmojiQuick runtime export to Cloudflare R2.");
  console.log(`Expected objects: ${manifest.totals.objects}`);
  console.log(`Expected bytes: ${manifest.totals.bytes.toLocaleString()}`);
  console.log(`Local files found: ${files.length}`);
  console.log(`Export dir: ${exportRootDir}`);
  console.log(`Prefix: ${R2_BUCKET_PREFIX}/`);
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
    r2KeyPrefix: R2_BUCKET_PREFIX,
    skipExisting,
    maxFiles,
  });

  console.log("");
  console.log("OPTIMIZED EXPORT UPLOAD COMPLETE");
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