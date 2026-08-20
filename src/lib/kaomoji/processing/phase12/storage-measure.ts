import { statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { StorageReport } from "./types";

function fileSize(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function dirSize(dir: string): number {
  let total = 0;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      total += entry.isDirectory() ? dirSize(p) : fileSize(p);
    }
  } catch {
    return 0;
  }
  return total;
}

export function measurePublicLibraryStorage(libDir: string): StorageReport {
  const breakdown: Record<string, number> = {};
  const files = [
    "canonical-records.json",
    "editorial.json",
    "scores.json",
    "categories.json",
    "keywords.json",
    "names.json",
    "meanings.json",
    "relationships.json",
    "collections.json",
    "provenance.json",
    "publication-gate.json",
    "search-index.json",
    "rankings.json",
    "excluded-records.json",
  ];
  for (const f of files) breakdown[f] = fileSize(join(libDir, f));
  const tierBytes =
    dirSize(join(libDir, "excellent")) +
    dirSize(join(libDir, "high")) +
    dirSize(join(libDir, "good")) +
    dirSize(join(libDir, "medium"));
  const fileBytes = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return {
    excellent_bytes: dirSize(join(libDir, "excellent")),
    high_bytes: dirSize(join(libDir, "high")),
    good_bytes: dirSize(join(libDir, "good")),
    medium_bytes: dirSize(join(libDir, "medium")),
    total_public_bytes: fileBytes + tierBytes,
    breakdown,
  };
}

export function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(3) + " GB";
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}
