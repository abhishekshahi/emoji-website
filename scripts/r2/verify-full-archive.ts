import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "../../src/lib/master/artwork/types";
import { R2_FULL_EXPORT_DIR } from "../../src/lib/master/r2/config";
import { verifyFullArchive } from "../../src/lib/master/r2/full-archive/verify";
import { FULL_ARCHIVE_PREFIX } from "../../src/lib/master/r2/full-archive/types";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportRootDir = join(rootDir, R2_FULL_EXPORT_DIR, FULL_ARCHIVE_PREFIX);
const sourceRoot = join(rootDir, "src/data/master");

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(rootDir, relativePath), "utf8")) as T;
}

async function main(): Promise<void> {
  const canonicalRecords = readJson<CanonicalEmojiRecord[]>("src/data/master/canonical-emojis.json");
  const artworkRecords = readJson<ArtworkMasterRecord[]>("src/data/master/artwork/artwork-master-index.json");

  const result = await verifyFullArchive({
    projectRoot: rootDir,
    sourceRoot,
    exportRootDir,
    canonicalRecords,
    artworkRecords,
    deep: true,
  });

  console.log(`FULL R2 ARCHIVE VERIFICATION: ${result.status}`);
  console.log(`  Source files: ${result.measured.sourceFiles}`);
  console.log(`  Export files: ${result.measured.exportFiles}`);
  console.log(`  Source bytes: ${result.measured.sourceBytes.toLocaleString()}`);
  console.log(`  Export bytes: ${result.measured.exportBytes.toLocaleString()}`);
  console.log(
    `  R2 utilization: ${((result.manifest.totals.bytes / 10_000_000_000) * 100).toFixed(2)}% of 10 GB`,
  );
  console.log(`  Identities: ${result.manifest.totals.canonicalIdentities}`);
  console.log(`  Artwork records: ${result.manifest.totals.artworkRecords}`);
  console.log(`  R2 objects: ${result.manifest.totals.r2Objects}`);

  if (result.errors.length > 0) {
    console.error("Errors:");
    for (const error of result.errors.slice(0, 20)) {
      console.error(`  - ${error}`);
    }
    if (result.errors.length > 20) {
      console.error(`  ... and ${result.errors.length - 20} more`);
    }
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
