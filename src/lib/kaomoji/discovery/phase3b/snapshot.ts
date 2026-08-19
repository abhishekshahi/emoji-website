import { existsSync, readFileSync } from "node:fs";
import { getKaomojiRawRecordsPath } from "../../storage/paths";
import type { RawKaomojiRecord } from "../../types";

export interface CollectedSnapshot {
  readonly total_raw: number;
  readonly total_unique: number;
  readonly by_source: Readonly<Record<string, { raw: number; unique: number; duplicates: number }>>;
}

export function loadCollectedSnapshot(rootDir: string): CollectedSnapshot {
  const recordsPath = getKaomojiRawRecordsPath(rootDir);
  if (!existsSync(recordsPath)) {
    return { total_raw: 0, total_unique: 0, by_source: {} };
  }
  const records = JSON.parse(readFileSync(recordsPath, "utf8")) as RawKaomojiRecord[];
  const bySource: Record<string, { raw: number; unique: Set<string> }> = {};
  for (const r of records) {
    if (!bySource[r.source_id]) bySource[r.source_id] = { raw: 0, unique: new Set() };
    bySource[r.source_id]!.raw += 1;
    bySource[r.source_id]!.unique.add(r.original_kaomoji);
  }
  const mapped: Record<string, { raw: number; unique: number; duplicates: number }> = {};
  for (const [id, v] of Object.entries(bySource)) {
    mapped[id] = { raw: v.raw, unique: v.unique.size, duplicates: v.raw - v.unique.size };
  }
  return {
    total_raw: records.length,
    total_unique: new Set(records.map((r) => r.original_kaomoji)).size,
    by_source: mapped,
  };
}

export function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

export function discoverMesslettersPaths(html: string): string[] {
  return [...new Set([...html.matchAll(/href="(\/en\/emoticons\/[^"#?]+)"/g)].map((m) => m[1]!))].sort();
}

export function parseEmoticonsTextSpans(html: string): string[] {
  return [...html.matchAll(/<span class="emoticon"[^>]*>([^<]+)<\/span>/g)].map((m) => m[1]!.trim());
}

export function parseMesslettersEntries(html: string): Array<{ id: string; title: string; text: string }> {
  return [...html.matchAll(/<li id="(\d+)" title="([^"]*)"><pre>([^<]+)<\/pre>/g)].map((m) => ({
    id: m[1]!,
    title: m[2]!,
    text: m[3]!,
  }));
}
