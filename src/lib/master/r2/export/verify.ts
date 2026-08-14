import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { R2ArtworkKeyEntry, R2Manifest } from "../types";
import { MASTER_ARTWORK_RECORD_COUNT, MASTER_IDENTITY_COUNT } from "../catalog";
import { sha256Hex } from "../sharding";

function existsWithRetry(path: string, attempts = 3): boolean {
  for (let i = 0; i < attempts; i++) {
    if (existsSync(path)) return true;
  }
  return false;
}

export interface R2VerifyResult {
  readonly status: "PASS" | "FAIL";
  readonly errors: string[];
  readonly manifest: R2Manifest;
  readonly measured: {
    readonly objectCount: number;
    readonly totalBytes: number;
  };
}

export function verifyR2Export(exportRootDir: string): R2VerifyResult {
  const errors: string[] = [];
  const manifestPath = join(exportRootDir, "manifests", "r2-manifest.json");

  if (!existsSync(manifestPath)) {
    return {
      status: "FAIL",
      errors: [`Missing manifest: ${manifestPath}`],
      manifest: null as unknown as R2Manifest,
      measured: { objectCount: 0, totalBytes: 0 },
    };
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as R2Manifest;

  if (manifest.totals.identities !== MASTER_IDENTITY_COUNT) {
    errors.push(`Identity count mismatch: ${manifest.totals.identities}`);
  }
  if (manifest.totals.artworkRecords !== MASTER_ARTWORK_RECORD_COUNT) {
    errors.push(`Artwork record mismatch: ${manifest.totals.artworkRecords}`);
  }

  const artworkIndexPath = join(
    exportRootDir,
    manifest.artworkIndexKey.replace(/^emojiquick\//, ""),
  );
  if (!existsSync(artworkIndexPath)) {
    errors.push(`Missing artwork index: ${artworkIndexPath}`);
  } else {
    const artworkKeys = JSON.parse(readFileSync(artworkIndexPath, "utf8")) as R2ArtworkKeyEntry[];
    if (artworkKeys.length !== MASTER_ARTWORK_RECORD_COUNT) {
      errors.push(`Artwork key count mismatch: ${artworkKeys.length}`);
    }
    const keySet = new Set<string>();
    for (const entry of artworkKeys) {
      if (keySet.has(entry.recordKey)) {
        errors.push(`Duplicate artwork record key: ${entry.recordKey}`);
      }
      keySet.add(entry.recordKey);
      const storagePath = join(exportRootDir, entry.storageKey.replace(/^emojiquick\//, ""));
      if (!existsWithRetry(storagePath)) {
        errors.push(`Missing artwork object: ${entry.storageKey}`);
      }
    }
  }

  for (const shardGroup of [
    manifest.identityShards,
    manifest.metadataShards,
    manifest.semanticShards,
    manifest.searchShards,
  ]) {
    for (const shard of shardGroup) {
      const shardPath = join(exportRootDir, shard.objectKey.replace(/^emojiquick\//, ""));
      if (!existsSync(shardPath)) {
        errors.push(`Missing shard: ${shard.objectKey}`);
        continue;
      }
      const payload = readFileSync(shardPath, "utf8");
      const hash = sha256Hex(payload);
      if (hash !== shard.sha256) {
        errors.push(`Shard checksum mismatch: ${shard.objectKey}`);
      }
    }
  }

  let objectCount = 0;
  let totalBytes = 0;
  const countObject = (relative: string) => {
    const absolute = join(exportRootDir, relative);
    if (existsSync(absolute)) {
      objectCount += 1;
      totalBytes += readFileSync(absolute).length;
    }
  };

  countObject("manifests/r2-manifest.json");
  countObject(manifest.artworkIndexKey.replace(/^emojiquick\//, ""));
  for (const shard of [
    ...manifest.identityShards,
    ...manifest.metadataShards,
    ...manifest.semanticShards,
    ...manifest.searchShards,
  ]) {
    countObject(shard.objectKey.replace(/^emojiquick\//, ""));
  }

  return {
    status: errors.length === 0 ? "PASS" : "FAIL",
    errors,
    manifest,
    measured: { objectCount, totalBytes },
  };
}
