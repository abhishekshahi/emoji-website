import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, mkdtempSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { sha256File } from "@/lib/kaomoji/cloudflare/checksum";
import {
  buildKaomojiChecksumsKey,
  buildKaomojiLocaleRegistryKey,
  buildKaomojiManifestKey,
  buildKaomojiSearchIndexKey,
} from "@/lib/kaomoji/cloudflare/r2-keys";
import { R2_BUCKET_NAME, runWrangler } from "../r2/wrangler-r2";
import { getPhase19ExportDir } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function remoteObjectExistsViaFile(cwd: string, objectPath: string): boolean {
  const dir = mkdtempSync(join(tmpdir(), "r2-verify-"));
  const dest = join(dir, "obj.bin");
  try {
    const result = runWrangler(
      ["r2", "object", "get", objectPath, "--file", dest, "--remote"],
      cwd,
    );
    return result.ok && existsSync(dest);
  } finally {
    try {
      unlinkSync(dest);
    } catch {
      /* ignore */
    }
  }
}

function main(): void {
  const remote = process.argv.includes("--remote");
  const exportDir = getPhase19ExportDir(rootDir);
  const items = [
    {
      local: join(exportDir, "r2", "public", "search-index-v2.json"),
      key: buildKaomojiSearchIndexKey(),
    },
    {
      local: join(exportDir, "r2", "public", "locale-registry.json"),
      key: buildKaomojiLocaleRegistryKey(),
    },
    {
      local: join(exportDir, "r2", "rebuildable", "manifest.json"),
      key: buildKaomojiManifestKey(),
    },
    {
      local: join(exportDir, "r2", "rebuildable", "checksums.json"),
      key: buildKaomojiChecksumsKey(),
    },
  ];

  const results: Record<string, unknown>[] = [];
  let pass = 0;
  for (const item of items) {
    const localExists = existsSync(item.local);
    const localSha = localExists ? sha256File(item.local).sha256 : null;
    const remoteExists = remote
      ? remoteObjectExistsViaFile(rootDir, `${R2_BUCKET_NAME}/${item.key}`)
      : null;
    const ok = localExists && (remote ? remoteExists === true : true);
    if (ok) pass++;
    results.push({ key: item.key, local_exists: localExists, local_sha256: localSha, remote_exists: remoteExists, ok });
  }

  const report = {
    timestamp: new Date().toISOString(),
    remote_checked: remote,
    objects: results,
    pass,
    total: items.length,
    valid: pass === items.length,
  };

  const out = join(rootDir, "r2-export", "phase19-r2-verification.json");
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.valid ? 0 : 1);
}

main();
