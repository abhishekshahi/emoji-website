import "server-only";
import { normalizeSearchQuery } from "../processing/phase14/query-normalizer";
import { expandQueryTokens } from "../processing/phase14/synonyms";
import type { SearchHitV2, SearchIndexV2Record } from "../processing/phase14/types";
import type { KaomojiD1Database } from "./d1-binding";
import { D1_SEARCH_BY_CATEGORY_FAST, D1_SEARCH_BY_CONTENT, D1_SEARCH_BY_KEYWORD_FAST } from "./d1-queries";

const MAX_D1_SEARCH_TOKENS = 3;
const D1_FETCH_PER_TOKEN = 32;

interface D1KaomojiRow {
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

function toSearchRecord(row: D1KaomojiRow): SearchIndexV2Record {
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

async function fetchTokenRows(db: KaomojiD1Database, token: string): Promise<D1KaomojiRow[]> {
  const keyword = await db.prepare(D1_SEARCH_BY_KEYWORD_FAST).bind(token, D1_FETCH_PER_TOKEN).all<D1KaomojiRow>();
  const rows = [...(keyword.results ?? [])];
  if (rows.length >= D1_FETCH_PER_TOKEN) return rows;

  const category = await db.prepare(D1_SEARCH_BY_CATEGORY_FAST).bind(token, D1_FETCH_PER_TOKEN).all<D1KaomojiRow>();
  const seen = new Set(rows.map((r) => r.canonical_id));
  for (const row of category.results ?? []) {
    if (!seen.has(row.canonical_id)) rows.push(row);
  }
  return rows;
}

export async function searchKaomojiD1(
  db: KaomojiD1Database,
  query: string,
  limit: number,
  offset: number,
): Promise<readonly SearchHitV2[]> {
  const parsed = normalizeSearchQuery(query);
  if (!parsed.normalized && !parsed.original.trim()) return [];

  const scores = new Map<string, { row: D1KaomojiRow; score: number; reason: string }>();

  function absorb(rows: D1KaomojiRow[], token: string, weight: number, reason: string): void {
    for (const row of rows) {
      const cur = scores.get(row.canonical_id);
      const nextScore = (cur?.score ?? 0) + weight;
      scores.set(row.canonical_id, {
        row,
        score: nextScore,
        reason: cur ? `${cur.reason}+${reason}` : `${reason}:${token}`,
      });
    }
  }

  try {
    if (parsed.is_kaomoji_like) {
      const pattern = `%${parsed.original.slice(0, 80)}%`;
      const result = await db
        .prepare(D1_SEARCH_BY_CONTENT)
        .bind(pattern, limit + offset)
        .all<D1KaomojiRow>();
      for (const row of result.results ?? []) {
        absorb([row], "content", 10, "content");
      }
    } else {
      const tokens = expandQueryTokens(parsed.tokens.length > 0 ? parsed.tokens : [parsed.normalized]).slice(
        0,
        MAX_D1_SEARCH_TOKENS,
      );

      for (const token of tokens) {
        const rows = await fetchTokenRows(db, token);
        absorb(rows, token, token === parsed.normalized ? 8 : 5, "keyword");
      }
    }
  } catch {
    return [];
  }

  const ranked = [...scores.values()]
    .sort((a, b) => b.score - a.score || b.row.quality_score - a.row.quality_score)
    .slice(offset, offset + limit);

  return ranked.map(({ row, score, reason }) => ({
    record: toSearchRecord(row),
    score,
    match_reason: reason,
  }));
}
