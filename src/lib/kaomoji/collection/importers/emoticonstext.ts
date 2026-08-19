import type { ImportEntry } from "./types";
import { fetchPage, isLikelyEmoticon } from "./fetch-utils";

const BASE_URL = "https://www.emoticonstext.com/";

export function parseEmoticonsTextHtml(html: string, pageUrl: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  const seen = new Set<string>();
  let index = 0;

  for (const match of html.matchAll(/<span class="emoticon"[^>]*>([^<]+)<\/span>/g)) {
    const text = match[1]?.trim();
    if (!text || !isLikelyEmoticon(text) || seen.has(text)) continue;
    seen.add(text);
    entries.push({
      original_kaomoji: text,
      source_record_id: `et-${index++}`,
      source_page: pageUrl,
      source_category: "japanese-emoticons",
      license_status: "REVIEW_REQUIRED",
    });
  }

  return entries;
}

/** Fetch EmoticonsText homepage (single-page collection). */
export async function fetchEmoticonsTextEntries(
  fetchFn: typeof fetch = fetch,
): Promise<{ entries: ImportEntry[]; pages_processed: number; errors: string[] }> {
  const errors: string[] = [];
  const page = await fetchPage(BASE_URL, fetchFn);
  if (page.error || page.status !== 200) {
    errors.push(page.error ?? `emoticonstext fetch failed: ${page.status}`);
    return { entries: [], pages_processed: 0, errors };
  }
  return {
    entries: parseEmoticonsTextHtml(page.html, page.url),
    pages_processed: 1,
    errors,
  };
}
