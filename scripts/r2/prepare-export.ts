import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "../../src/lib/master/artwork/types";
import type { CanonicalMetadataIndexEntry } from "../../src/lib/master/metadata/types";
import type { CanonicalSemanticIndexEntry } from "../../src/lib/master/semantic/types";
import type { CanonicalSearchIndexEntry } from "../../src/lib/master/reconciliation/types";
import type { BrowsableEmoji } from "../../src/lib/emoji/types";
import { R2_EXPORT_DIR } from "../../src/lib/master/r2/config";
import {
  buildProductionSlugMapFromEntries,
  prepareR2Export,
} from "../../src/lib/master/r2/export/prepare";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../../src/lib/master/r2/catalog";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportRootDir = join(rootDir, R2_EXPORT_DIR, "emojiquick");

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(rootDir, relativePath), "utf8")) as T;
}

function main(): void {
  const started = Date.now();
  console.log("R2 prepare: reading master data...");

  const canonicalRecords = readJson<CanonicalEmojiRecord[]>("src/data/master/canonical-emojis.json");
  const artworkRecords = readJson<ArtworkMasterRecord[]>("src/data/master/artwork/artwork-master-index.json");
  const metadataRecords = readJson<CanonicalMetadataIndexEntry[]>(
    "src/data/master/metadata/canonical-metadata-index.json",
  );
  const semanticRecords = readJson<CanonicalSemanticIndexEntry[]>(
    "src/data/master/semantic/canonical-semantic-index.json",
  );
  const searchRecords = readJson<CanonicalSearchIndexEntry[]>(
    "src/data/master/metadata/canonical-search-index.json",
  );

  const productionMap = readJson<{
    standardRecords: { entries: Array<{ canonicalId: string; productionId: string; productionType: "standard" }> };
    extrasRecords: { entries: Array<{ canonicalId: string; productionId: string; productionType: "extra" }> };
  }>("src/data/master/integration/production-to-master-map.json");

  const standard = readJson<BrowsableEmoji[]>("src/data/emojis.json");
  const extras = readJson<BrowsableEmoji[]>("src/data/openmoji-extras.json");
  const slugByProductionId = new Map<string, string>();
  for (const emoji of [...standard, ...extras]) {
    const productionType = "isOpenMojiExtra" in emoji && emoji.isOpenMojiExtra ? "extra" : "standard";
    slugByProductionId.set(`${productionType}:${emoji.id}`, emoji.slug);
  }

  const productionSlugByCanonicalId = buildProductionSlugMapFromEntries(
    [...productionMap.standardRecords.entries, ...productionMap.extrasRecords.entries],
    slugByProductionId,
  );

  console.log(
    `R2 prepare: ${canonicalRecords.length} identities, ${artworkRecords.length} artwork records`,
  );

  const { manifest, objects } = prepareR2Export({
    canonicalRecords,
    artworkRecords,
    metadataRecords,
    semanticRecords,
    searchRecords,
    productionSlugByCanonicalId,
    artworkRootDir: join(rootDir, "src/data/master/raw/artwork"),
    readFile: (path) => readFileSync(path),
    fileExists: (path) => existsSync(path),
    copyFile: (source, destination) => copyFileSync(source, destination),
    writeJson: (path, value) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    },
    writeText: (path, content) => {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, content, "utf8");
    },
    mkdir: (path) => mkdirSync(path, { recursive: true }),
    exportRootDir,
  });

  const totalBytes = objects.reduce((sum, object) => sum + object.bytes, 0);
  const durationMs = Date.now() - started;

  console.log("R2 prepare complete:");
  console.log(`  Export dir: ${exportRootDir}`);
  console.log(`  Identities: ${manifest.totals.identities} (expected ${MASTER_IDENTITY_COUNT})`);
  console.log(`  Artwork records: ${manifest.totals.artworkRecords} (expected ${MASTER_ARTWORK_RECORD_COUNT})`);
  console.log(`  Unique artwork files: ${manifest.totals.artworkFiles}`);
  console.log(`  Objects: ${manifest.totals.objects}`);
  console.log(`  Total bytes: ${totalBytes.toLocaleString()} (${(totalBytes / 1e9).toFixed(3)} GB)`);
  console.log(`  R2 utilization: ${((totalBytes / 1e10) * 100).toFixed(2)}% of 10 GB`);
  console.log(`  Dedup savings: ${manifest.deduplication.bytesSaved.toLocaleString()} bytes`);
  console.log(`  Duration: ${(durationMs / 1000).toFixed(1)}s`);

  if (manifest.totals.identities !== MASTER_IDENTITY_COUNT) {
    throw new Error("R2 prepare validation failed: identity count");
  }
  if (manifest.totals.artworkRecords !== MASTER_ARTWORK_RECORD_COUNT) {
    throw new Error("R2 prepare validation failed: artwork count");
  }
}

main();
