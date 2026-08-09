import type { CanonicalSeoRecord } from "@/lib/master/reconciliation/types";
import { getMasterReader } from "./master-reader";

export function getMasterSEO(canonicalId: string, rootDir?: string): Readonly<CanonicalSeoRecord> | null {
  const reader = getMasterReader(rootDir);
  const seoRecord = reader.seoRecords.get(canonicalId);
  if (!seoRecord) {
    return null;
  }

  return seoRecord;
}
