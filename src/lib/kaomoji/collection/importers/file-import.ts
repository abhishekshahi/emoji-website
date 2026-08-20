import { readFileSync } from "node:fs";
import type { ImportEntry, ParsedImportFile } from "./types";

interface FileImportPayload {
  entries?: Array<{
    original_kaomoji?: string;
    source_record_id?: string | null;
    source_category?: string | null;
    source_title?: string | null;
    source_page?: string | null;
  }>;
}

/** Parse manual import file at data/kaomoji/imports/{source_id}.json. */
export function parseFileImportJson(sourceId: string, payload: unknown): ParsedImportFile {
  const data = payload as FileImportPayload;
  if (!data?.entries || !Array.isArray(data.entries)) {
    throw new Error(`Invalid import file for ${sourceId}: expected { entries: [...] }`);
  }

  const entries: ImportEntry[] = [];
  for (const item of data.entries) {
    const text = item.original_kaomoji?.trim();
    if (!text) continue;
    entries.push({
      original_kaomoji: text,
      source_record_id: item.source_record_id ?? null,
      source_category: item.source_category ?? null,
      source_title: item.source_title ?? null,
      source_page: item.source_page ?? null,
    });
  }

  return { source_id: sourceId, entries };
}

/** Read and parse a manual import file from disk. */
export function readFileImport(sourceId: string, filePath: string): ParsedImportFile {
  const raw = readFileSync(filePath, "utf8");
  const payload = JSON.parse(raw) as unknown;
  return parseFileImportJson(sourceId, payload);
}
