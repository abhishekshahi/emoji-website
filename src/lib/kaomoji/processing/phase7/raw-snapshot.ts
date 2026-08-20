import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import type { RawKaomojiRecord } from "../../types";
import { getKaomojiRawRecordsPath } from "../../storage/paths";
import type { Phase7RawSnapshot } from "./types";

export function hashRawFile(path: string): { sha256: string; size: number } {
  const buf = readFileSync(path);
  return { sha256: createHash("sha256").update(buf).digest("hex"), size: buf.length };
}

export function createRawSnapshot(
  rootDir: string,
  records: readonly RawKaomojiRecord[],
  fastemoji?: { collected: number | null; remaining: number | null },
): Phase7RawSnapshot {
  const path = getKaomojiRawRecordsPath(rootDir);
  const { sha256, size } = hashRawFile(path);
  const sourceIds = [...new Set(records.map((r) => r.source_id))].sort();
  const withProvenance = records.filter((r) => r.provenance.length >= 2).length;
  return {
    snapshot_at: new Date().toISOString(),
    raw_count: records.length,
    source_count: sourceIds.length,
    file_sha256: sha256,
    file_size_bytes: size,
    provenance_coverage: records.length ? withProvenance / records.length : 1,
    source_ids: sourceIds,
    fastemoji_collected: fastemoji?.collected ?? null,
    fastemoji_remaining: fastemoji?.remaining ?? null,
  };
}

export function verifyRawUnchanged(
  rootDir: string,
  snapshot: Phase7RawSnapshot,
  records: readonly RawKaomojiRecord[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const path = getKaomojiRawRecordsPath(rootDir);
  if (!existsSync(path)) errors.push("raw records file missing");
  if (records.length !== snapshot.raw_count) {
    errors.push(`raw count changed: ${snapshot.raw_count} -> ${records.length}`);
  }
  const { sha256 } = hashRawFile(path);
  if (sha256 !== snapshot.file_sha256) errors.push("raw file sha256 mismatch");
  return { ok: errors.length === 0, errors };
}

export function loadFastEmojiCheckpointStats(rootDir: string): { collected: number | null; remaining: number | null } {
  try {
    const statsPath = `${rootDir}/data/kaomoji/collection/fastemoji/fastemoji-stats.json`;
    const collPath = `${rootDir}/data/kaomoji/collection/fastemoji/fastemoji-collected.json`;
    if (!existsSync(statsPath)) return { collected: null, remaining: null };
    const stats = JSON.parse(readFileSync(statsPath, "utf8")) as {
      emoji: number;
      sequence: number;
      combination: number;
    };
    const canonical = stats.emoji + stats.sequence + stats.combination;
    const collected = existsSync(collPath)
      ? (JSON.parse(readFileSync(collPath, "utf8")) as string[]).length
      : 0;
    return { collected, remaining: Math.max(0, canonical - collected) };
  } catch {
    return { collected: null, remaining: null };
  }
}
