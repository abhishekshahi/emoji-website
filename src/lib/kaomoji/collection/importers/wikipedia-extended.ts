import type { ImportEntry } from "./types";
import { fetchPage, isLikelyEmoticon, stripHtmlTags } from "./fetch-utils";

const WIKI_PAGES = ["List_of_emoticons", "Kaomoji", "Emoticon"] as const;

const EMOTICON_INLINE = /['"]([^'"]{2,80})['"]/g;
const TABLE_CELL = /\|\s*([^\n|]{2,80})\s*\|\s*([^\n|]{2,120})/g;
const BULLET_TEXT = /^\*+\s*['"]?([^\n'"]{2,80})['"]?/;

function extractFromWikitext(wikitext: string, pageTitle: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  const seen = new Set<string>();
  let index = 0;
  const pageUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replace(/ /g, "_"))}`;

  function push(text: string, category: string | null) {
    const cleaned = stripHtmlTags(text).trim();
    if (!isLikelyEmoticon(cleaned) || seen.has(cleaned)) return;
    seen.add(cleaned);
    entries.push({
      original_kaomoji: cleaned,
      source_record_id: `${pageTitle}-${index++}`,
      source_page: pageUrl,
      source_category: category,
      license_status: "ATTRIBUTION_REQUIRED",
    });
  }

  for (const line of wikitext.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("|")) continue;

    const bullet = trimmed.match(BULLET_TEXT);
    if (bullet?.[1]) push(bullet[1], pageTitle);

    for (const inline of trimmed.matchAll(EMOTICON_INLINE)) {
      push(inline[1]!, pageTitle);
    }

    const table = trimmed.match(TABLE_CELL);
    if (table?.[1]) push(table[1], table[2] ?? pageTitle);
  }

  return entries;
}

interface WikimediaParseResponse {
  parse?: { wikitext?: { "*": string } };
  error?: { code?: string; info?: string };
}

/** Fetch multiple Wikipedia pages via Wikimedia API. */
export async function fetchWikipediaExtendedEntries(
  fetchFn: typeof fetch = fetch,
): Promise<{ entries: ImportEntry[]; pages_processed: number; errors: string[] }> {
  const errors: string[] = [];
  const allEntries: ImportEntry[] = [];
  let processed = 0;

  for (const page of WIKI_PAGES) {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&origin=*`;
    const result = await fetchPage(apiUrl, fetchFn, { delayMs: 200 });
    if (result.error || result.status !== 200) {
      errors.push(`${page}: ${result.error ?? result.status}`);
      continue;
    }
    try {
      const payload = JSON.parse(result.html) as WikimediaParseResponse;
      if (payload.error) {
        errors.push(`${page}: ${payload.error.code ?? "api_error"}`);
        continue;
      }
      const wikitext = payload.parse?.wikitext?.["*"];
      if (!wikitext) {
        errors.push(`${page}: missing wikitext`);
        continue;
      }
      allEntries.push(...extractFromWikitext(wikitext, page));
      processed += 1;
    } catch (err) {
      errors.push(`${page}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { entries: allEntries, pages_processed: processed, errors };
}

export function parseWikipediaExtendedWikitext(wikitext: string, pageTitle: string): ImportEntry[] {
  return extractFromWikitext(wikitext, pageTitle);
}
