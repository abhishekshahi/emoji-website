import type { ImportEntry } from "./types";
import { fetchPage } from "./fetch-utils";
import { discoverMesslettersPages, parseMesslettersHtml } from "./messletters";

const BASE = "https://www.messletters.com";

export interface MesslettersPhase4Result {
  readonly entries: ImportEntry[];
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly html_entries: number;
  readonly unique_source_ids: number;
  readonly category_appearances: number;
  readonly errors: string[];
}

/** Phase 4: full Messletters enumeration with category-preserving source_record_id. */
export async function fetchMesslettersPhase4Entries(
  fetchFn: typeof fetch = fetch,
): Promise<MesslettersPhase4Result> {
  const errors: string[] = [];
  const indexPage = await fetchPage(`${BASE}/en/emoticons/`, fetchFn);
  if (indexPage.error || indexPage.status !== 200) {
    errors.push(indexPage.error ?? `messletters index failed: ${indexPage.status}`);
    return {
      entries: [],
      pages_discovered: 0,
      pages_processed: 0,
      html_entries: 0,
      unique_source_ids: 0,
      category_appearances: 0,
      errors,
    };
  }

  const pagePaths = discoverMesslettersPages(indexPage.html);
  const allEntries: ImportEntry[] = [];
  const uniqueIds = new Set<string>();
  const bareIds = new Set<string>();
  let htmlEntries = 0;
  let processed = 0;

  for (const path of pagePaths) {
    const page = await fetchPage(`${BASE}${path}`, fetchFn, { delayMs: 150 });
    processed += 1;
    if (page.error || page.status !== 200) {
      errors.push(`${path}: ${page.error ?? page.status}`);
      continue;
    }
    const category = path.replace("/en/emoticons/", "").replace(/\/$/, "") || "index";
    const parsed = parseMesslettersHtml(page.html, page.url, category);
    htmlEntries += parsed.length;

    for (const entry of parsed) {
      const baseId = entry.source_record_id ?? "unknown";
      uniqueIds.add(baseId);
      allEntries.push({
        ...entry,
        source_record_id: `${category}:${baseId}`,
      });
      if (!bareIds.has(baseId)) {
        bareIds.add(baseId);
        allEntries.push({ ...entry, source_record_id: baseId });
      }
    }
  }

  return {
    entries: allEntries,
    pages_discovered: pagePaths.length,
    pages_processed: processed,
    html_entries: htmlEntries,
    unique_source_ids: uniqueIds.size,
    category_appearances: allEntries.length,
    errors,
  };
}
