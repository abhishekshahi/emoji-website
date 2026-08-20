import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Phase19StorageBreakdown } from "./types";
import {
  getPhase19ExportDir,
  getPhase19RootDir,
} from "../storage/paths";

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function dirSize(dir: string): number {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(p) : fileSize(p);
  }
  return total;
}

function measureDirFiles(dir: string): Record<string, number> {
  const files: Record<string, number> = {};
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = measureDirFiles(p);
      for (const [k, v] of Object.entries(nested)) files[entry.name + "/" + k] = v;
    } else {
      files[entry.name] = fileSize(p);
    }
  }
  return files;
}

export function measurePhase19Storage(rootDir: string): Phase19StorageBreakdown {
  const phaseRoot = getPhase19RootDir(rootDir);
  const exportDir = getPhase19ExportDir(rootDir);
  const publicDir = join(exportDir, "r2", "public");
  const rebuildableDir = join(exportDir, "r2", "rebuildable");
  const backupDir = join(exportDir, "r2", "backup");
  const d1Dir = join(exportDir, "d1");
  const publicBytes = dirSize(publicDir);
  const rebuildableBytes = dirSize(rebuildableDir) + dirSize(d1Dir);
  const backupBytes = dirSize(backupDir);
  const files = {
    ...measureDirFiles(publicDir),
    ...measureDirFiles(rebuildableDir),
    ...measureDirFiles(backupDir),
    ...measureDirFiles(d1Dir),
    ...measureDirFiles(phaseRoot),
  };
  return {
    public_bytes: publicBytes,
    rebuildable_bytes: rebuildableBytes,
    backup_bytes: backupBytes,
    total_bytes: publicBytes + rebuildableBytes + backupBytes,
    files,
  };
}
