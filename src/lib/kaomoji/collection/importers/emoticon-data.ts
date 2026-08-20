import type { ImportEntry } from "./types";

const EMOTICON_DATA_URL =
  "https://raw.githubusercontent.com/w33ble/emoticon-data/master/emoticons.json";

interface EmoticonDataEntry {
  id?: string | number;
  string?: string;
  tags?: string[];
}

interface EmoticonDataPayload {
  emoticons?: EmoticonDataEntry[];
}

/** Parse GitHub emoticon-data JSON { emoticons: [{ id, string, tags }] }. */
export function parseEmoticonDataJson(payload: unknown): ImportEntry[] {
  const data = payload as EmoticonDataPayload;
  if (!data?.emoticons || !Array.isArray(data.emoticons)) {
    throw new Error("Invalid emoticon-data format: expected { emoticons: [...] }");
  }

  const entries: ImportEntry[] = [];
  for (const item of data.emoticons) {
    const text = item.string?.trim();
    if (!text) continue;
    entries.push({
      original_kaomoji: text,
      source_record_id: item.id != null ? String(item.id) : null,
      source_category: item.tags?.length ? item.tags.join(", ") : null,
      source_title: item.tags?.[0] ?? null,
    });
  }
  return entries;
}

/** Fetch and parse emoticon-data from GitHub. */
export async function fetchEmoticonDataEntries(
  fetchFn: typeof fetch = fetch,
): Promise<ImportEntry[]> {
  const response = await fetchFn(EMOTICON_DATA_URL);
  if (!response.ok) {
    throw new Error(`emoticon-data fetch failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as unknown;
  return parseEmoticonDataJson(payload);
}
