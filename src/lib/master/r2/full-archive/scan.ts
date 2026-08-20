import { readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import type { FullArchiveDirectoryReport, FullArchiveFileEntry } from "./types";
import { buildFullArchiveMasterKey } from "./keys";
import { sha256Hex } from "../sharding";

export interface ScanMasterTreeOptions {
  readonly sourceRoot: string;
  readonly readFile: (path: string) => Buffer;
}

function walkFiles(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, files);
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
}

export function scanMasterTree(options: ScanMasterTreeOptions): FullArchiveFileEntry[] {
  const absolutePaths: string[] = [];
  walkFiles(options.sourceRoot, absolutePaths);
  absolutePaths.sort((left, right) => left.localeCompare(right));

  return absolutePaths.map((absolutePath) => {
    const relativePath = relative(options.sourceRoot, absolutePath).replace(/\\/g, "/");
    const data = options.readFile(absolutePath);
    const extension = extname(relativePath).toLowerCase() || "(none)";

    return {
      relativePath,
      r2Key: buildFullArchiveMasterKey(relativePath),
      bytes: data.length,
      sha256: sha256Hex(data),
      extension,
    };
  });
}

export function buildDirectoryReports(
  files: readonly FullArchiveFileEntry[],
): FullArchiveDirectoryReport[] {
  const byDir = new Map<string, { fileCount: number; bytes: number }>();

  for (const file of files) {
    const parts = file.relativePath.split("/");
    const dirPath = parts.length > 1 ? parts.slice(0, -1).join("/") : ".";
    const topLevel = parts[0] ?? ".";
    const targets = [dirPath, topLevel];

    for (const path of new Set(targets)) {
      const current = byDir.get(path) ?? { fileCount: 0, bytes: 0 };
      byDir.set(path, {
        fileCount: current.fileCount + 1,
        bytes: current.bytes + file.bytes,
      });
    }
  }

  return [...byDir.entries()]
    .map(([path, stats]) => ({ path, ...stats }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export function sumBytesUnderPrefix(
  files: readonly FullArchiveFileEntry[],
  prefix: string,
): number {
  const normalized = prefix.replace(/\\/g, "/").replace(/\/$/, "");
  return files
    .filter((file) => file.relativePath === normalized || file.relativePath.startsWith(`${normalized}/`))
    .reduce((sum, file) => sum + file.bytes, 0);
}

export function countFilesUnderPrefix(
  files: readonly FullArchiveFileEntry[],
  prefix: string,
): number {
  const normalized = prefix.replace(/\\/g, "/").replace(/\/$/, "");
  return files.filter(
    (file) => file.relativePath === normalized || file.relativePath.startsWith(`${normalized}/`),
  ).length;
}

export function countDirectories(sourceRoot: string): number {
  let count = 0;
  function walk(dir: string): void {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        count += 1;
        walk(join(dir, entry.name));
      }
    }
  }
  walk(sourceRoot);
  return count;
}

export function extensionCounts(
  files: readonly FullArchiveFileEntry[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const file of files) {
    counts[file.extension] = (counts[file.extension] ?? 0) + 1;
  }
  return counts;
}

export function providerArtworkCounts(
  files: readonly FullArchiveFileEntry[],
): Record<string, number> {
  const providers = ["openmoji", "noto", "twemoji", "fluent"] as const;
  const counts: Record<string, number> = {};
  for (const provider of providers) {
    counts[provider] = files.filter((file) =>
      file.relativePath.startsWith(`raw/artwork/${provider}/`),
    ).length;
  }
  return counts;
}

export function fileExistsAt(sourceRoot: string, relativePath: string): boolean {
  try {
    return statSync(join(sourceRoot, relativePath)).isFile();
  } catch {
    return false;
  }
}
