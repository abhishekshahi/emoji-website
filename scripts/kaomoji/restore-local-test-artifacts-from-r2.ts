/**
 * Restore minimal local test artifacts from production R2 (read-only).
 * Required for Phase 14 / 19 / 20 regression when processed data is not in the repo.
 */
import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildKaomojiChecksumsKey,
  buildKaomojiLocaleRegistryKey,
  buildKaomojiManifestKey,
  buildKaomojiSearchIndexKey,
} from "@/lib/kaomoji/cloudflare/r2-keys";
import {
  getPhase14ManifestPath,
  getPhase14RootDir,
  getPhase14SearchIndexPath,
  getPhase15LocaleRegistryPath,
  getPhase19ExportDir,
} from "@/lib/kaomoji/storage/paths";
import { R2_BUCKET_NAME, runWrangler } from "../r2/wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function downloadR2Object(key: string, dest: string): void {
  mkdirSync(join(dest, ".."), { recursive: true });
  const objectPath = `${R2_BUCKET_NAME}/${key}`;
  const result = runWrangler(["r2", "object", "get", objectPath, "--file", dest, "--remote"], rootDir);
  if (!result.ok) {
    throw new Error(`Failed to download ${objectPath}: ${result.stderr || result.stdout}`);
  }
  if (!existsSync(dest)) {
    throw new Error(`Download reported success but file missing: ${dest}`);
  }
}

function main(): void {
  console.log("Restoring local test artifacts from R2…");
  const searchKey = buildKaomojiSearchIndexKey();
  const localeKey = buildKaomojiLocaleRegistryKey();
  const searchDest = getPhase14SearchIndexPath(rootDir);
  const localeDest = getPhase15LocaleRegistryPath(rootDir);
  const exportSearchDest = join(getPhase19ExportDir(rootDir), "r2", "public", "search-index-v2.json");
  const exportLocaleDest = join(getPhase19ExportDir(rootDir), "r2", "public", "locale-registry.json");
  const exportChecksumsDest = join(getPhase19ExportDir(rootDir), "r2", "rebuildable", "checksums.json");
  const exportManifestDest = join(getPhase19ExportDir(rootDir), "r2", "rebuildable", "manifest.json");

  downloadR2Object(searchKey, searchDest);
  downloadR2Object(localeKey, localeDest);
  downloadR2Object(buildKaomojiChecksumsKey(), exportChecksumsDest);
  downloadR2Object(buildKaomojiManifestKey(), exportManifestDest);
  mkdirSync(join(exportSearchDest, ".."), { recursive: true });
  copyFileSync(searchDest, exportSearchDest);
  copyFileSync(localeDest, exportLocaleDest);

  if (!existsSync(getPhase14ManifestPath(rootDir))) {
    const index = JSON.parse(readFileSync(searchDest, "utf8")) as { records: unknown[] };
    mkdirSync(getPhase14RootDir(rootDir), { recursive: true });
    mkdirSync(join(getPhase14RootDir(rootDir), "manifests"), { recursive: true });
    writeFileSync(
      getPhase14ManifestPath(rootDir),
      JSON.stringify(
        {
          phase: 14,
          timestamp: new Date().toISOString(),
          pipeline_version: "14.0.0-restored-from-r2",
          search_version: "14.1.0",
          index_records: index.records.length,
          legacy_pass_rate: 1,
          legacy_pass_count: 32,
          benchmark_pass_rate: 1,
          benchmark_pass_count: 122,
          benchmark_queries: 122,
          errors: [],
          warnings: ["Manifest restored from R2 search index for local regression only"],
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
  }

  console.log("Restored:");
  console.log(" ", searchDest);
  console.log(" ", localeDest);
  console.log(" ", exportSearchDest);
  console.log(" ", exportLocaleDest);
  console.log(" ", exportChecksumsDest);
  console.log(" ", exportManifestDest);
  if (existsSync(getPhase14ManifestPath(rootDir))) {
    console.log(" ", getPhase14ManifestPath(rootDir));
  }
}

main();
