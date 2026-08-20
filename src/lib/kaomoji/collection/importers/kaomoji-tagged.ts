import type { ImportEntry } from "./types";

const KAOMOJI_TAGGED_URL =
  "https://raw.githubusercontent.com/kaomojikan/kaomoji-data/main/kaomoji.json";

interface KaomojiTaggedEntry {
  text?: string;
  slug?: string;
  categories?: string[];
  tags?: string[];
}

/** Parse kaomoji-data JSON array { text, slug, categories, tags }. */
export function parseKaomojiTaggedJson(payload: unknown): ImportEntry[] {
  if (!Array.isArray(payload)) {
    throw new Error("Invalid kaomoji-tagged format: expected JSON array");
  }

  const entries: ImportEntry[] = [];
  for (const item of payload as KaomojiTaggedEntry[]) {
    const text = item.text?.trim();
    if (!text) continue;
    const categories = item.categories ?? [];
    entries.push({
      original_kaomoji: text,
      source_record_id: item.slug ?? null,
      source_category: categories.length ? categories.join(", ") : null,
      source_title: item.slug ?? categories[0] ?? null,
    });
  }
  return entries;
}

/** Fetch and parse kaomoji-tagged dataset from GitHub. */
export async function fetchKaomojiTaggedEntries(
  fetchFn: typeof fetch = fetch,
): Promise<ImportEntry[]> {
  const response = await fetchFn(KAOMOJI_TAGGED_URL);
  if (!response.ok) {
    throw new Error(`kaomoji-tagged fetch failed: ${response.status} ${response.statusText}`);
  }
  const payload = (await response.json()) as unknown;
  return parseKaomojiTaggedJson(payload);
}
