import type { ImportEntry } from "./types";

const WIKIMEDIA_API =
  "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_emoticons&prop=wikitext&format=json&origin=*";

/** Regex for emoticon-like patterns in Wikipedia wikitext. */
const EMOTICON_LINE_PATTERN =
  /^\*?\s*['"]?([^\s'"]*(?:\([^)]*\)|\[[^\]]*\]|[^\s'"]*)*[^\s'"]*)['"]?\s*(?:[-–—]|—|\|\|)/;

const EMOTICON_INLINE_PATTERN =
  /['"]([^'"]*(?:\([^\)]*\)|\[[^\]]*\])[^'"]*)['"]\s*(?:[-–—]|—)/g;

function extractFromWikitext(wikitext: string): ImportEntry[] {
  const entries: ImportEntry[] = [];
  const seen = new Set<string>();
  let index = 0;

  for (const line of wikitext.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("|")) continue;

    let match = trimmed.match(EMOTICON_LINE_PATTERN);
    if (match?.[1]) {
      const text = match[1].trim();
      if (text.length >= 2 && text.length <= 80 && !seen.has(text)) {
        seen.add(text);
        entries.push({
          original_kaomoji: text,
          source_record_id: `wiki-line-${index++}`,
          source_page: "https://en.wikipedia.org/wiki/List_of_emoticons",
          license_status: "ATTRIBUTION_REQUIRED",
        });
      }
      continue;
    }

    for (const inline of trimmed.matchAll(EMOTICON_INLINE_PATTERN)) {
      const text = inline[1]?.trim();
      if (!text || text.length < 2 || text.length > 80 || seen.has(text)) continue;
      seen.add(text);
      entries.push({
        original_kaomoji: text,
        source_record_id: `wiki-inline-${index++}`,
        source_page: "https://en.wikipedia.org/wiki/List_of_emoticons",
        license_status: "ATTRIBUTION_REQUIRED",
      });
    }
  }

  return entries;
}

interface WikimediaParseResponse {
  parse?: {
    wikitext?: { "*": string };
  };
  error?: { code?: string; info?: string };
}

/** Fetch Wikipedia List of emoticons via Wikimedia API. Handles fetch failure gracefully. */
export async function fetchWikipediaEntries(
  fetchFn: typeof fetch = fetch,
): Promise<{ entries: ImportEntry[]; errors: string[] }> {
  const errors: string[] = [];
  try {
    const response = await fetchFn(WIKIMEDIA_API);
    if (!response.ok) {
      errors.push(`wikipedia fetch failed: ${response.status} ${response.statusText}`);
      return { entries: [], errors };
    }
    const payload = (await response.json()) as WikimediaParseResponse;
    if (payload.error) {
      errors.push(`wikipedia api error: ${payload.error.code ?? "unknown"} ${payload.error.info ?? ""}`);
      return { entries: [], errors };
    }
    const wikitext = payload.parse?.wikitext?.["*"];
    if (!wikitext) {
      errors.push("wikipedia response missing wikitext");
      return { entries: [], errors };
    }
    return { entries: extractFromWikitext(wikitext), errors };
  } catch (err) {
    errors.push(`wikipedia fetch exception: ${err instanceof Error ? err.message : String(err)}`);
    return { entries: [], errors };
  }
}

/** Parse wikitext directly (for tests). */
export function parseWikipediaWikitext(wikitext: string): ImportEntry[] {
  return extractFromWikitext(wikitext);
}
