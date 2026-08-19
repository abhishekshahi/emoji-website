import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ImportEntry } from "./types";
import { fetchPage } from "./fetch-utils";

const BASE = "https://www.fastemoji.com";
const CHECKPOINT_VERSION = "4.1.0";

export type FastEmojiUrlFamily =
  | "EMOJI"
  | "EMOJI_SEQUENCE"
  | "EMOJI_COMBINATION"
  | "CATEGORY"
  | "KEYWORD"
  | "COLLECTION"
  | "PLATFORM"
  | "OTHER";

export interface FastEmojiStats {
  readonly version: string;
  readonly sitemap_count: number;
  readonly total_urls: number;
  readonly emoji: number;
  readonly sequence: number;
  readonly combination: number;
  readonly category: number;
  readonly keyword: number;
  readonly other: number;
  readonly collected_urls: number;
}

export interface FastEmojiPhase4Result {
  readonly entries: ImportEntry[];
  readonly stats: FastEmojiStats;
  readonly pages_discovered: number;
  readonly pages_processed: number;
  readonly canonical_records: number;
  readonly collected: number;
  readonly remaining: number;
  readonly errors: string[];
}

function sitemapLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
}

export function classifyUrl(url: string): FastEmojiUrlFamily {
  const path = url.replace(BASE, "").replace(/^\//, "");
  if (path.startsWith("category/")) return "CATEGORY";
  if (path.startsWith("keyword/")) return "KEYWORD";
  if (path.startsWith("collection/")) return "COLLECTION";
  if (path.startsWith("platform/")) return "PLATFORM";
  if (path.includes("sequence") || path.includes("zwj")) return "EMOJI_SEQUENCE";
  if (path.includes("combination") || path.includes("combo") || path.includes("combos/")) return "EMOJI_COMBINATION";
  const decoded = decodeURIComponent(path);
  if (/[\u{1F300}-\u{1FAFF}]/u.test(decoded)) return "EMOJI";
  if (/emoji/i.test(path) && !path.includes("search")) return "EMOJI";
  return "OTHER";
}

function extractEmojiFromText(text: string): string | null {
  const chars = [...text].filter((c) => /\p{Extended_Pictographic}/u.test(c));
  return chars.length ? chars.join("") : null;
}

function extractEmojiFromUrl(url: string): string | null {
  try {
    return extractEmojiFromText(decodeURIComponent(url));
  } catch {
    return null;
  }
}

function extractEmojiFromPage(html: string, url: string): string | null {
  const og = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1];
  if (og) {
    const fromOg = extractEmojiFromText(og);
    if (fromOg) return fromOg;
  }
  const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1];
  if (h1) {
    const fromH1 = extractEmojiFromText(h1);
    if (fromH1) return fromH1;
  }
  return extractEmojiFromUrl(url);
}

function statsPath(checkpointDir: string): string {
  return join(checkpointDir, "fastemoji-stats.json");
}

function collectedPath(checkpointDir: string): string {
  return join(checkpointDir, "fastemoji-collected.json");
}

export function loadFastEmojiStats(checkpointDir: string): FastEmojiStats | null {
  const p = statsPath(checkpointDir);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as FastEmojiStats;
}

function saveFastEmojiStats(checkpointDir: string, stats: FastEmojiStats): void {
  mkdirSync(checkpointDir, { recursive: true });
  writeFileSync(statsPath(checkpointDir), `${JSON.stringify(stats, null, 2)}\n`, "utf8");
}

function loadCollectedSet(checkpointDir: string): Set<string> {
  const p = collectedPath(checkpointDir);
  if (!existsSync(p)) return new Set();
  return new Set(JSON.parse(readFileSync(p, "utf8")) as string[]);
}

function saveCollectedSet(checkpointDir: string, collected: Set<string>): void {
  mkdirSync(checkpointDir, { recursive: true });
  writeFileSync(collectedPath(checkpointDir), `${JSON.stringify([...collected].sort(), null, 2)}\n`, "utf8");
}

/** Stream-enumerate sitemaps; persist only stats + collected set (not full URL inventory). */
export async function enumerateFastEmojiSitemapsStreaming(
  fetchFn: typeof fetch,
  checkpointDir: string,
): Promise<FastEmojiStats> {
  const existing = loadFastEmojiStats(checkpointDir);
  if (existing && existing.total_urls > 0) return existing;

  const index = await fetchPage(`${BASE}/sitemap.xml`, fetchFn);
  const sitemapUrls = index.status === 200 ? sitemapLocs(index.html) : [];
  const counts = { emoji: 0, sequence: 0, combination: 0, category: 0, keyword: 0, other: 0, total: 0 };

  for (const smUrl of sitemapUrls) {
    const sm = await fetchPage(smUrl, fetchFn, { delayMs: 80 });
    if (sm.status !== 200) continue;
    for (const loc of sitemapLocs(sm.html)) {
      counts.total += 1;
      const family = classifyUrl(loc);
      switch (family) {
        case "EMOJI": counts.emoji++; break;
        case "EMOJI_SEQUENCE": counts.sequence++; break;
        case "EMOJI_COMBINATION": counts.combination++; break;
        case "CATEGORY": counts.category++; break;
        case "KEYWORD": counts.keyword++; break;
        default: counts.other++; break;
      }
    }
  }

  const stats: FastEmojiStats = {
    version: CHECKPOINT_VERSION,
    sitemap_count: sitemapUrls.length,
    total_urls: counts.total,
    emoji: counts.emoji,
    sequence: counts.sequence,
    combination: counts.combination,
    category: counts.category,
    keyword: counts.keyword,
    other: counts.other,
    collected_urls: 0,
  };
  saveFastEmojiStats(checkpointDir, stats);
  return stats;
}

async function* streamCanonicalUrls(fetchFn: typeof fetch): AsyncGenerator<{ url: string; family: FastEmojiUrlFamily; slug: string }> {
  const index = await fetchPage(`${BASE}/sitemap.xml`, fetchFn);
  const sitemapUrls = (index.status === 200 ? sitemapLocs(index.html) : []).filter(
    (u) => u.includes("/sitemaps/main/") || u.includes("/sitemaps/combos/") || u.includes("/sitemaps/meanings/"),
  );
  for (const smUrl of sitemapUrls) {
    const sm = await fetchPage(smUrl, fetchFn, { delayMs: 40 });
    if (sm.status !== 200) continue;
    for (const loc of sitemapLocs(sm.html)) {
      const family = classifyUrl(loc);
      if (family === "EMOJI" || family === "EMOJI_SEQUENCE" || family === "EMOJI_COMBINATION") {
        yield { url: loc, family, slug: loc.replace(BASE, "").replace(/^\//, "") };
      }
    }
  }
}

/** Collect FastEmoji records via streaming sitemap pass + slug/page extraction. */
export async function fetchFastEmojiPhase4Entries(
  fetchFn: typeof fetch,
  checkpointDir: string,
  options: { maxFetch?: number; maxCollect?: number } = {},
): Promise<FastEmojiPhase4Result> {
  const errors: string[] = [];
  const maxFetch = options.maxFetch ?? 1500;
  const maxCollect = options.maxCollect ?? 8000;
  const stats = await enumerateFastEmojiSitemapsStreaming(fetchFn, checkpointDir);
  const collectedSet = loadCollectedSet(checkpointDir);
  const entries: ImportEntry[] = [];
  let processed = 0;
  let fetched = 0;

  for await (const record of streamCanonicalUrls(fetchFn)) {
    if (entries.length >= maxCollect) break;
    if (collectedSet.has(record.url)) continue;

    let emoji = extractEmojiFromUrl(record.url);
    if (!emoji && fetched < maxFetch) {
      const page = await fetchPage(record.url, fetchFn, { delayMs: 30 });
      fetched += 1;
      processed += 1;
      if (page.status === 200) emoji = extractEmojiFromPage(page.html, record.url);
    } else {
      processed += 1;
    }

    if (!emoji) continue;

    entries.push({
      original_kaomoji: emoji,
      source_record_id: record.slug.slice(0, 120),
      source_page: record.url,
      source_category: record.family,
      license_status: "REVIEW_REQUIRED",
    });
    collectedSet.add(record.url);

    if (entries.length % 500 === 0) {
      saveCollectedSet(checkpointDir, collectedSet);
      saveFastEmojiStats(checkpointDir, { ...stats, collected_urls: collectedSet.size });
    }
  }

  saveCollectedSet(checkpointDir, collectedSet);
  const finalStats = { ...stats, collected_urls: collectedSet.size };
  saveFastEmojiStats(checkpointDir, finalStats);

  const canonical = stats.emoji + stats.sequence + stats.combination;
  return {
    entries,
    stats: finalStats,
    pages_discovered: stats.total_urls,
    pages_processed: processed,
    canonical_records: canonical,
    collected: collectedSet.size,
    remaining: Math.max(0, canonical - collectedSet.size),
    errors,
  };
}

export { sitemapLocs };
