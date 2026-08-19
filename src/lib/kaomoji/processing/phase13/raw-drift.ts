import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RawKaomojiRecord } from "../../types";
import { getKaomojiRawRecordsPath, getPhase7RawSnapshotPath, getPhase8ProposedLibraryDir } from "../../storage/paths";
import { hashRawFile } from "../phase7/raw-snapshot";
import type { RawDriftAudit } from "./types";

export function auditRawDrift(rootDir: string): RawDriftAudit {
  const p7 = JSON.parse(readFileSync(getPhase7RawSnapshotPath(rootDir), "utf8")) as {
    raw_count: number; file_sha256: string;
  };
  const rawPath = getKaomojiRawRecordsPath(rootDir);
  const raw = JSON.parse(readFileSync(rawPath, "utf8")) as RawKaomojiRecord[];
  const p8Map = JSON.parse(
    readFileSync(join(getPhase8ProposedLibraryDir(rootDir), "raw-to-canonical-map.json"), "utf8"),
  ) as Record<string, string>;
  const p8Ids = new Set(Object.keys(p8Map));
  const added = raw.filter((r) => !p8Ids.has(r.raw_id));
  const bySource: Record<string, number> = {};
  for (const r of added) bySource[r.source_id] = (bySource[r.source_id] ?? 0) + 1;
  return {
    phase8_baseline_count: p7.raw_count,
    current_count: raw.length,
    drift: raw.length - p7.raw_count,
    phase8_baseline_sha256: p7.file_sha256,
    current_sha256: hashRawFile(rawPath).sha256,
    added_by_source: bySource,
    added_records_sample: added.slice(0, 200).map((r) => ({
      raw_id: r.raw_id,
      source_id: r.source_id,
      source_url: r.source_url,
      collection_timestamp: r.collection_timestamp,
      in_phase8_canonical: false,
    })),
    outside_canonical_layer: added.length,
  };
}
