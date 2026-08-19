import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { StorageAudit, StorageEntry } from "./types";

function fileSize(p: string): number {
  try { return statSync(p).size; } catch { return 0; }
}

function walkFiles(dir: string, prefix: string, out: StorageEntry[]): number {
  let total = 0;
  try {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) total += walkFiles(p, rel, out);
      else {
        const bytes = statSync(p).size;
        out.push({ path: rel.replace(/\\/g, "/"), bytes });
        total += bytes;
      }
    }
  } catch { /* missing */ }
  return total;
}

export function measureStorage(rootDir: string, rawRelPath: string): StorageAudit {
  const p12 = join(rootDir, "data/kaomoji/processed/phase-12/public-quality");
  const processed = join(rootDir, "data/kaomoji/processed");
  const rawPath = join(rootDir, rawRelPath);
  const files: StorageEntry[] = [];
  const tier = (n: string) => walkFiles(join(p12, n), `phase-12/public-quality/${n}`, files);
  const ex = tier("excellent");
  const hi = tier("high");
  const go = tier("good");
  const me = tier("medium");
  const qualityDataset = walkFiles(p12, "phase-12/public-quality", files);
  const pubFiles = [
    "canonical-records.json", "editorial.json", "scores.json", "search-index.json",
    "relationships.json", "provenance.json",
  ];
  let publicProduction = ex + hi + go + me;
  for (const f of pubFiles) publicProduction += fileSize(join(p12, f));
  return {
    tier_excellent_bytes: ex,
    tier_high_bytes: hi,
    tier_good_bytes: go,
    tier_medium_bytes: me,
    public_production_bytes: publicProduction,
    quality_dataset_bytes: qualityDataset,
    full_processing_bytes: walkFiles(processed, "processed", files),
    full_raw_bytes: fileSize(rawPath),
    files: files.sort((a, b) => b.bytes - a.bytes).slice(0, 80),
  };
}

export function formatBytes(n: number): string {
  if (n >= 1_073_741_824) return (n / 1_073_741_824).toFixed(3) + " GB";
  if (n >= 1_048_576) return (n / 1_048_576).toFixed(2) + " MB";
  if (n >= 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}
