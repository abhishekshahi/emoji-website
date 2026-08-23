import "server-only";
import type { SearchHitV2, SearchIndexV2Record } from "../processing/phase14/types";
import { expandQueryTokens } from "../processing/phase14/synonyms";
import { parseKaomojiCloudflareMode } from "./config";
import { D1_SEARCH_BY_CATEGORY_FAST, D1_SEARCH_BY_KEYWORD_FAST } from "./d1-queries";

interface D1Row {
  canonical_id: string;
  slug: string;
  content: string;
  normalized_content: string;
  editorial_name: string | null;
  accessible_name: string;
  quality_score: number;
  beauty_score: number;
  editorial_priority: string;
  meaning: string | null;
}

function toRecord(row: D1Row): SearchIndexV2Record {
  return {
    canonical_id: row.canonical_id,
    slug: row.slug,
    content: row.content,
    normalized_content: row.normalized_content,
    name: row.editorial_name,
    meaning: row.meaning,
    keywords: [],
    categories: [],
    emotions: [],
    styles: [],
    quality_score: row.quality_score,
    beauty_score: row.beauty_score,
    priority: row.editorial_priority,
  };
}

function normalizeTokens(query: string): string[] {
  const normalized = query.normalize("NFC").trim().toLowerCase();
  const tokens = normalized
    .replace(/[^\p{L}\p{N}\s+-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
  return expandQueryTokens(tokens.length > 0 ? tokens : [normalized]).slice(0, 3);
}

/** Runtime search: D1 on Cloudflare Worker; local index in dev only. */
export async function searchKaomojiRuntime(
  query: string,
  limit: number,
  offset: number,
): Promise<readonly SearchHitV2[]> {
  const mode = parseKaomojiCloudflareMode(process.env.KAOMOJI_CLOUDFLARE_MODE);
  if (mode !== "STAGING" && mode !== "PRODUCTION") {
    const { kaomojiDataExists, loadSearchIndexV2 } = await import("../product/loader");
    const { searchKaomojiV2 } = await import("../processing/phase14/search-index-v2");
    if (kaomojiDataExists()) {
      return searchKaomojiV2(loadSearchIndexV2(), query, limit, offset);
    }
    return [];
  }

  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext({ async: false });
    const db = (env as { KAOMOJI_D1?: { prepare(q: string): { bind(...v: unknown[]): { all<T>(): Promise<{ results?: T[] }> } } } }).KAOMOJI_D1;
    if (!db) return [];

    const scores = new Map<string, { row: D1Row; score: number; reason: string }>();
    for (const token of normalizeTokens(query)) {
      const keyword = await db.prepare(D1_SEARCH_BY_KEYWORD_FAST).bind(token, 32).all<D1Row>();
      for (const row of keyword.results ?? []) {
        const cur = scores.get(row.canonical_id);
        scores.set(row.canonical_id, {
          row,
          score: (cur?.score ?? 0) + 8,
          reason: cur ? `${cur.reason}+keyword:${token}` : `keyword:${token}`,
        });
      }
      if ((keyword.results ?? []).length > 0) continue;

      const category = await db.prepare(D1_SEARCH_BY_CATEGORY_FAST).bind(token, 32).all<D1Row>();
      for (const row of category.results ?? []) {
        const cur = scores.get(row.canonical_id);
        scores.set(row.canonical_id, {
          row,
          score: (cur?.score ?? 0) + 5,
          reason: cur ? `${cur.reason}+category:${token}` : `category:${token}`,
        });
      }
    }

    return [...scores.values()]
      .sort((a, b) => b.score - a.score || b.row.quality_score - a.row.quality_score)
      .slice(offset, offset + limit)
      .map(({ row, score, reason }) => ({ record: toRecord(row), score, match_reason: reason }));
  } catch {
    return [];
  }
}

export async function loadCloudflareSearchIndex(): Promise<null> {
  return null;
}
