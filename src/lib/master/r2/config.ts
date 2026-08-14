import type { MasterR2Mode } from "./types";

export function parseMasterR2Mode(value: string | undefined): MasterR2Mode {
  if (value === "ENABLED" || value === "DATA_READY") {
    return value;
  }
  return "OFF";
}

export function getMasterR2Mode(): MasterR2Mode {
  return parseMasterR2Mode(process.env.MASTER_R2_MODE);
}

export function isMasterR2ApiEnabled(): boolean {
  const mode = getMasterR2Mode();
  return mode === "DATA_READY" || mode === "ENABLED";
}

export function shouldReadFromR2Binding(): boolean {
  return getMasterR2Mode() === "ENABLED";
}

/** Optimized application runtime export (deduplicated, sharded). */
export const R2_EXPORT_DIR = ".r2-export" as const;

/** Complete master archive export (byte-for-byte preservation, no deduplication). */
export const R2_FULL_EXPORT_DIR = ".r2-export-full" as const;

export const R2_SHARD_SIZE = 500 as const;
export const R2_MAX_ARTWORK_KEY_LENGTH = 512 as const;
