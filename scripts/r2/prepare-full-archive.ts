import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "../../src/lib/master/artwork/types";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../../src/lib/master/r2/catalog";
import { prepareFullArchive } from "../../src/lib/master/r2/full-archive/prepare";
import { FULL_ARCHIVE_BUCKET_NAME } from "../../src/lib/master/r2/full-archive/types";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(rootDir, relativePath), "utf8")) as T;
}

function main(): void {
  console.log("R2 prepare-full: scanning complete master tree...");

  const canonicalRecords = readJson<CanonicalEmojiRecord[]>("src/data/master/canonical-emojis.json");
  const artworkRecords = readJson<ArtworkMasterRecord[]>("src/data/master/artwork/artwork-master-index.json");

  const result = prepareFullArchive({
    projectRoot: rootDir,
    canonicalRecords,
    artworkRecords,
  });

  const { manifest } = result;
  const utilization = (manifest.totals.bytes / 10_000_000_000) * 100;

  console.log("R2 prepare-full complete:");
  console.log(`  Archive type: ${manifest.archiveType}`);
  console.log(`  Export dir: ${result.exportRootDir}`);
  console.log(`  Bucket: ${FULL_ARCHIVE_BUCKET_NAME}`);
  console.log(`  Identities: ${manifest.totals.canonicalIdentities} (expected ${MASTER_IDENTITY_COUNT})`);
  console.log(`  Artwork records: ${manifest.totals.artworkRecords} (expected ${MASTER_ARTWORK_RECORD_COUNT})`);
  console.log(`  Artwork files: ${manifest.totals.artworkFiles}`);
  console.log(`  Source files: ${manifest.totals.files}`);
  console.log(`  R2 objects (files + manifests): ${manifest.totals.r2Objects}`);
  console.log(`  Total bytes: ${manifest.totals.bytes.toLocaleString()} (${(manifest.totals.bytes / 1e9).toFixed(3)} GB)`);
  console.log(`  Artwork bytes: ${manifest.totals.artworkBytes.toLocaleString()}`);
  console.log(`  Metadata bytes: ${manifest.totals.metadataBytes.toLocaleString()}`);
  console.log(`  Semantic bytes: ${manifest.totals.semanticBytes.toLocaleString()}`);
  console.log(`  Vendor bytes: ${manifest.totals.vendorBytes.toLocaleString()}`);
  console.log(`  R2 utilization: ${utilization.toFixed(2)}% of 10 GB`);
  console.log(`  Deduplication policy: ${manifest.deduplicationPolicy}`);
  console.log(`  Frozen release verified: ${manifest.frozenReleaseVerified}`);
  console.log(`  Duration: ${(result.durationMs / 1000).toFixed(1)}s`);

  if (manifest.totals.canonicalIdentities !== MASTER_IDENTITY_COUNT) {
    throw new Error("Full archive validation failed: identity count");
  }
  if (manifest.totals.artworkRecords !== MASTER_ARTWORK_RECORD_COUNT) {
    throw new Error("Full archive validation failed: artwork record count");
  }
}

main();
