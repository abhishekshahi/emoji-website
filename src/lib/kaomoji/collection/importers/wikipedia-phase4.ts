import type { ImportEntry } from "./types";
import { fetchPage, uniqueStrings } from "./fetch-utils";
import { parseWikipediaExtendedWikitext } from "./wikipedia-extended";

const SEED_PAGES = [
  "List_of_emoticons",
  "Kaomoji",
  "Emoticon",
  "Emoji",
  "List_of_Unicode_characters",
  "ASCII_art",
  "Shift_JIS_art",
  "Emoticons_(Unicode_block)",
  "Western_style_emoticons",
] as const;

interface WikimediaParseResponse {
  parse?: { wikitext?: { "*": string } };
  error?: { code?: string; info?: string };
}

interface WikimediaSearchResponse {
  query?: { search?: Array<{ title: string }> };
}

function isRelevantTitle(title: string): boolean {
  const t = title.toLowerCase();
  return (
    t.includes("emoticon") ||
    t.includes("kaomoji") ||
    t.includes("text face") ||
    t.includes("ascii art") ||
    t.includes("shift_jis") ||
    (t.includes("emoji") && (t.includes("list") || t.includes("combination")))
  );
}

async function searchWikipediaPages(fetchFn: typeof fetch): Promise<string[]> {
  const queries = ["emoticon", "kaomoji", "text face emoticon", "ascii emoticon", "japanese emoticon"];
  const titles = new Set<string>(SEED_PAGES);

  for (const q of queries) {
    const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=20&format=json&origin=*`;
    const result = await fetchPage(url, fetchFn, { delayMs: 150 });
    if (result.status !== 200) continue;
    try {
      const payload = JSON.parse(result.html) as WikimediaSearchResponse;
      for (const hit of payload.query?.search ?? []) {
        if (isRelevantTitle(hit.title)) titles.add(hit.title.replace(/ /g, "_"));
      }
    } catch {
      /* skip */
    }
  }

  return uniqueStrings([...titles]);
}

export interface WikipediaPhase4Result {
  readonly entries: ImportEntry[];
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly page_titles: readonly string[];
  readonly errors: string[];
}

/** Phase 4: discover + collect from all relevant Wikipedia pages. */
export async function fetchWikipediaPhase4Entries(
  fetchFn: typeof fetch = fetch,
): Promise<WikipediaPhase4Result> {
  const errors: string[] = [];
  const pageTitles = await searchWikipediaPages(fetchFn);
  const allEntries: ImportEntry[] = [];
  const seen = new Set<string>();
  let processed = 0;

  for (const pageTitle of pageTitles) {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&origin=*`;
    const result = await fetchPage(apiUrl, fetchFn, { delayMs: 150 });
    if (result.error || result.status !== 200) {
      errors.push(`${pageTitle}: ${result.error ?? result.status}`);
      continue;
    }
    try {
      const payload = JSON.parse(result.html) as WikimediaParseResponse;
      if (payload.error) {
        errors.push(`${pageTitle}: ${payload.error.code ?? "api_error"}`);
        continue;
      }
      const wikitext = payload.parse?.wikitext?.["*"];
      if (!wikitext) {
        errors.push(`${pageTitle}: missing wikitext`);
        continue;
      }
      for (const entry of parseWikipediaExtendedWikitext(wikitext, pageTitle)) {
        const key = entry.original_kaomoji;
        if (seen.has(key)) continue;
        seen.add(key);
        allEntries.push(entry);
      }
      processed += 1;
    } catch (err) {
      errors.push(`${pageTitle}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    entries: allEntries,
    pages_discovered: pageTitles.length,
    pages_processed: processed,
    page_titles: pageTitles,
    errors,
  };
}
