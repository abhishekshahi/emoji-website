import type { ImportEntry } from "./types";
import { fetchPage, uniqueStrings } from "./fetch-utils";
import { parseEmoticonsTextHtml } from "./emoticonstext";

const BASE = "https://www.emoticonstext.com";

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

export interface EmoticonsTextPhase4Result {
  readonly entries: ImportEntry[];
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly pages_with_data: number;
  readonly errors: string[];
}

/** Phase 4: crawl sitemap + homepage for all emoticon spans. */
export async function fetchEmoticonsTextPhase4Entries(
  fetchFn: typeof fetch = fetch,
): Promise<EmoticonsTextPhase4Result> {
  const errors: string[] = [];
  const seen = new Set<string>();
  const allEntries: ImportEntry[] = [];
  const urls = new Set<string>([`${BASE}/`]);

  const sitemapCandidates = [`${BASE}/sitemap.xml`, `${BASE}/sitemap_index.xml`];
  for (const smUrl of sitemapCandidates) {
    const sm = await fetchPage(smUrl, fetchFn, { delayMs: 100 });
    if (sm.status === 200 && sm.html.includes("<loc>")) {
      for (const loc of sitemapLocs(sm.html)) urls.add(loc);
    }
  }

  let processed = 0;
  let withData = 0;

  for (const url of [...urls].sort()) {
    const page = await fetchPage(url, fetchFn, { delayMs: 100 });
    processed += 1;
    if (page.error || page.status !== 200) {
      if (url === `${BASE}/`) errors.push(page.error ?? `homepage ${page.status}`);
      continue;
    }
    const parsed = parseEmoticonsTextHtml(page.html, page.url);
    if (parsed.length > 0) withData += 1;
    for (const entry of parsed) {
      const key = `${entry.source_page}:${entry.original_kaomoji}`;
      if (seen.has(key)) continue;
      seen.add(key);
      allEntries.push({
        ...entry,
        source_record_id: `et4-${allEntries.length}`,
        source_page: page.url,
      });
    }
  }

  return {
    entries: allEntries,
    pages_discovered: urls.size,
    pages_processed: processed,
    pages_with_data: withData,
    errors,
  };
}

export function discoverEmoticonsTextUrls(sitemapXml: string, seed: string[] = []): string[] {
  return uniqueStrings([...seed, ...sitemapLocs(sitemapXml)]);
}
