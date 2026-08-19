import type { ImportEntry } from "./types";
import { fetchPage } from "./fetch-utils";
import { parseWikipediaExtendedWikitext } from "./wikipedia-extended";

const SEED_PAGES = [
  "List_of_emoticons",
  "Kaomoji",
  "Emoticon",
  "Western_style_emoticons",
  "ASCII_art",
  "Shift_JIS_art",
  "Emoticons_(Unicode_block)",
] as const;

const RETRY_PAGES = [
  "List_of_Unicode_characters",
  "Emoji",
  "List_of_emoji",
] as const;

interface WikimediaParseResponse {
  parse?: { wikitext?: { "*": string } };
  error?: { code?: string; info?: string };
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchWikipediaPageWithRetry(
  pageTitle: string,
  fetchFn: typeof fetch,
  maxAttempts = 5,
): Promise<{ wikitext: string | null; error: string | null; rateLimited: boolean }> {
  let delay = 2000;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const apiUrl = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json&origin=*`;
    const result = await fetchPage(apiUrl, fetchFn, { delayMs: 300 });
    if (result.status === 429 || result.status === 503) {
      if (attempt < maxAttempts) {
        await sleep(delay);
        delay *= 2;
        continue;
      }
      return { wikitext: null, error: `rate_limited:${result.status}`, rateLimited: true };
    }
    if (result.error || result.status !== 200) {
      return { wikitext: null, error: result.error ?? String(result.status), rateLimited: false };
    }
    try {
      const payload = JSON.parse(result.html) as WikimediaParseResponse;
      if (payload.error?.code === "maxlag" || payload.error?.info?.includes("429")) {
        if (attempt < maxAttempts) {
          await sleep(delay);
          delay *= 2;
          continue;
        }
        return { wikitext: null, error: payload.error.code ?? "rate_limited", rateLimited: true };
      }
      if (payload.error) return { wikitext: null, error: payload.error.code ?? "api_error", rateLimited: false };
      const wikitext = payload.parse?.wikitext?.["*"] ?? null;
      return { wikitext, error: wikitext ? null : "missing wikitext", rateLimited: false };
    } catch (err) {
      return { wikitext: null, error: err instanceof Error ? err.message : String(err), rateLimited: false };
    }
  }
  return { wikitext: null, error: "max retries", rateLimited: true };
}

export interface WikipediaPhase6Result {
  readonly entries: ImportEntry[];
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly rate_limited_remaining: readonly string[];
  readonly errors: string[];
}

/** Phase 6: retry previously rate-limited Wikipedia pages with exponential backoff. */
export async function fetchWikipediaPhase6Retry(fetchFn: typeof fetch = fetch): Promise<WikipediaPhase6Result> {
  const errors: string[] = [];
  const rateLimited: string[] = [];
  const entries: ImportEntry[] = [];
  const pages = [...new Set([...SEED_PAGES, ...RETRY_PAGES])];
  let processed = 0;

  for (const pageTitle of pages) {
    const { wikitext, error, rateLimited: limited } = await fetchWikipediaPageWithRetry(pageTitle, fetchFn);
    if (limited) {
      rateLimited.push(pageTitle);
      errors.push(`${pageTitle}: rate limited`);
      continue;
    }
    if (error || !wikitext) {
      errors.push(`${pageTitle}: ${error ?? "missing"}`);
      continue;
    }
    for (const entry of parseWikipediaExtendedWikitext(wikitext, pageTitle)) {
      entries.push(entry);
    }
    processed += 1;
    await sleep(500);
  }

  return {
    entries,
    pages_discovered: pages.length,
    pages_processed: processed,
    rate_limited_remaining: rateLimited,
    errors,
  };
}
