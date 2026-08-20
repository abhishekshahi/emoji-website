import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256File, verifyChecksum } from "@/lib/kaomoji/cloudflare/checksum";
import { buildKaomojiChecksumsKey, buildKaomojiLocaleRegistryKey, buildKaomojiManifestKey, buildKaomojiSearchIndexKey } from "@/lib/kaomoji/cloudflare/r2-keys";
import { R2_BUCKET_NAME, uploadObjectWithRetryAsync, remoteObjectExists } from "../r2/wrangler-r2";
import { getPhase19ExportDir, getPhase19ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

interface UploadItem {
  readonly local: string;
  readonly key: string;
  readonly contentType: string;
}

async function main(): Promise<void> {
  const remote = !process.argv.includes("--dry-run");
  const exportDir = getPhase19ExportDir(rootDir);
  const publicDir = join(exportDir, "r2", "public");
  const rebuildableDir = join(exportDir, "r2", "rebuildable");
  const backupDir = join(exportDir, "r2", "backup");

  const items: UploadItem[] = [
    { local: join(publicDir, "search-index-v2.json"), key: buildKaomojiSearchIndexKey(), contentType: "application/json" },
    { local: join(publicDir, "locale-registry.json"), key: buildKaomojiLocaleRegistryKey(), contentType: "application/json" },
    { local: join(rebuildableDir, "manifest.json"), key: buildKaomojiManifestKey(), contentType: "application/json" },
    { local: join(rebuildableDir, "checksums.json"), key: buildKaomojiChecksumsKey(), contentType: "application/json" },
    { local: join(backupDir, "rollback-manifest.json"), key: buildKaomojiChecksumsKey().replace("checksums.json", "rollback-manifest.json"), contentType: "application/json" },
  ];

  let uploaded = 0;
  let verified = 0;
  const checksums: Record<string, string> = {};

  for (const item of items) {
    if (!existsSync(item.local)) {
      console.warn("Missing:", item.local);
      continue;
    }
    const sha = sha256File(item.local).sha256;
    checksums[item.key] = sha;
    console.log(`${remote ? "Upload" : "Plan"}: ${item.key} (${sha.slice(0, 12)}…)`);
    if (!remote) continue;

    const objectPath = `${R2_BUCKET_NAME}/${item.key}`;
    const result = await uploadObjectWithRetryAsync(rootDir, objectPath, item.local, item.contentType);
    if (!result.ok) {
      console.error("Upload failed:", item.key, result.stderr);
      process.exit(1);
    }
    uploaded++;
    if (remoteObjectExists(rootDir, objectPath)) verified++;
  }

  const checksumsPath = join(rebuildableDir, "checksums.json");
  if (existsSync(checksumsPath)) {
    const expected = JSON.parse(readFileSync(checksumsPath, "utf8")) as { objects?: Record<string, string> };
    for (const [key, hash] of Object.entries(expected.objects ?? {})) {
      if (checksums[key] && checksums[key] !== hash) {
        console.error("Checksum mismatch local vs export manifest:", key);
        process.exit(1);
      }
    }
  }

  console.log("Uploaded:", uploaded, "Verified remote:", verified);

  const manifestPath = getPhase19ManifestPath(rootDir);
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as Record<string, unknown>;
    manifest.r2_uploaded = uploaded;
    manifest.r2_verified = verified;
    manifest.r2_upload_remote = remote;
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  }
}

void main();
