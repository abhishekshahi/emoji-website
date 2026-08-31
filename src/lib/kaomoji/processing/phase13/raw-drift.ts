import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RawKaomojiRecord } from "../../types";
import { getKaomojiRawRecordsPath, getPhase8ProposedLibraryDir } from "../../storage/paths";
import { hashRawFile } from "../phase7/raw-snapshot";
import {
  PHASE8_HISTORICAL_RAW_BASELINE,
  PHASE8_HISTORICAL_RAW_SHA256,
} from "../phase7/pipeline";
import type { RawDriftAudit } from "./types";

/**
 * Compare authoritative RAW against the historical Phase 7/8 freeze (232683)
 * and against the current Phase 8 raw→canonical map.
 *
 * Live Phase 7 snapshot is intentionally NOT used as the historical baseline:
 * after regenerating Phase 7 against authoritative RAW, snapshot delta is 0.
 */
export function auditRawDrift(rootDir: string): RawDriftAudit {
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
    phase8_baseline_count: PHASE8_HISTORICAL_RAW_BASELINE,
    current_count: raw.length,
    drift: raw.length - PHASE8_HISTORICAL_RAW_BASELINE,
    phase8_baseline_sha256: PHASE8_HISTORICAL_RAW_SHA256,
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
