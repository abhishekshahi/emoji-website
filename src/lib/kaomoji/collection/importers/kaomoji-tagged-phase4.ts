import type { ImportEntry } from "./types";
import { fetchKaomojiTaggedEntries, parseKaomojiTaggedJson } from "./kaomoji-tagged";

const REPO_API = "https://api.github.com/repos/kaomojikan/kaomoji-data/contents";
const BY_CATEGORY_BASE =
  "https://raw.githubusercontent.com/kaomojikan/kaomoji-data/main/by-category";

interface GitHubContentEntry {
  name?: string;
  path?: string;
  type?: string;
}

/** Phase 4: fetch main kaomoji.json + all by-category JSON files. */
export async function fetchKaomojiTaggedPhase4Entries(
  fetchFn: typeof fetch = fetch,
): Promise<{ entries: ImportEntry[]; files_processed: number; errors: string[] }> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const allEntries: ImportEntry[] = [];
  let filesProcessed = 0;

  const main = await fetchKaomojiTaggedEntries(fetchFn);
  filesProcessed += 1;
  for (const entry of main) {
    const key = entry.original_kaomoji;
    if (seen.has(key)) continue;
    seen.add(key);
    allEntries.push(entry);
  }

  try {
    const apiRes = await fetchFn(`${REPO_API}/by-category`, {
      headers: { "User-Agent": "EmojiQuick-Phase4/1.0" },
    });
    if (apiRes.ok) {
      const files = (await apiRes.json()) as GitHubContentEntry[];
      for (const file of files) {
        if (file.type !== "file" || !file.name?.endsWith(".json")) continue;
        const category = file.name.replace(/\.json$/, "");
        const url = `${BY_CATEGORY_BASE}/${file.name}`;
        const res = await fetchFn(url);
        if (!res.ok) {
          errors.push(`${file.name}: ${res.status}`);
          continue;
        }
        const payload = (await res.json()) as unknown;
        const parsed = parseKaomojiTaggedJson(payload);
        filesProcessed += 1;
        for (const entry of parsed) {
          allEntries.push({
            ...entry,
            source_record_id: entry.source_record_id ? `${category}:${entry.source_record_id}` : `${category}:${entry.original_kaomoji}`,
            source_category: category,
          });
        }
      }
    }
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  return { entries: allEntries, files_processed: filesProcessed, errors };
}

export function parseKaomojiTaggedPhase4Json(payload: unknown, category: string): ImportEntry[] {
  return parseKaomojiTaggedJson(payload).map((entry) => ({
    ...entry,
    source_record_id: entry.source_record_id ? `${category}:${entry.source_record_id}` : `${category}:${entry.original_kaomoji}`,
    source_category: category,
  }));
}
