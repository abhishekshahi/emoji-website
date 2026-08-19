import type { ImportEntry } from "./types";
import { fetchPage } from "./fetch-utils";

const BASE = "https://www.messletters.com";

export function parseMesslettersHtml(html: string, pageUrl: string, category: string): ImportEntry[] {
  const entries: ImportEntry[] = [];

  for (const match of html.matchAll(/<li id="(\d+)" title="([^"]*)"><pre>([^<]+)<\/pre>/g)) {
    const id = match[1]!;
    const title = match[2]!.trim();
    const text = match[3]!.trim();
    if (!text || text.length < 1 || text.length > 200) continue;
    entries.push({
      original_kaomoji: text,
      source_record_id: id,
      source_page: pageUrl,
      source_category: category,
      source_title: title || null,
      license_status: "REVIEW_REQUIRED",
    });
  }

  return entries;
}

export function discoverMesslettersPages(html: string): string[] {
  const links = [
    ...html.matchAll(/href="(\/en\/emoticons\/[^"#?]+)"/g),
  ].map((m) => m[1]!);
  return [...new Set(links)].sort();
}

/** Fetch all Messletters /en/emoticons/* category pages. */
export async function fetchMesslettersEntries(
  fetchFn: typeof fetch = fetch,
): Promise<{
  entries: ImportEntry[];
  pages_discovered: number;
  pages_processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  const indexPage = await fetchPage(`${BASE}/en/emoticons/`, fetchFn);
  if (indexPage.error || indexPage.status !== 200) {
    errors.push(indexPage.error ?? `messletters index failed: ${indexPage.status}`);
    return { entries: [], pages_discovered: 0, pages_processed: 0, errors };
  }

  const pagePaths = discoverMesslettersPages(indexPage.html);
  const allEntries: ImportEntry[] = [];
  let processed = 0;

  for (const path of pagePaths) {
    const page = await fetchPage(`${BASE}${path}`, fetchFn, { delayMs: 250 });
    processed += 1;
    if (page.error || page.status !== 200) {
      errors.push(`${path}: ${page.error ?? page.status}`);
      continue;
    }
    const category = path.replace("/en/emoticons/", "").replace(/\/$/, "") || "index";
    allEntries.push(...parseMesslettersHtml(page.html, page.url, category));
  }

  return {
    entries: allEntries,
    pages_discovered: pagePaths.length,
    pages_processed: processed,
    errors,
  };
}
