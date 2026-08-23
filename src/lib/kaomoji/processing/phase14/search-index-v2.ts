import type { KaomojiEditorialRecord } from "../phase9/types";
import { tokenizeForSearch } from "../phase9/keywords";
import { DEFAULT_RANKING_WEIGHTS } from "./ranking";
import { normalizeKaomojiContent, normalizeSearchQuery } from "./query-normalizer";
import { expandQueryTokens, SEARCH_SYNONYMS } from "./synonyms";
import { fuzzyTokenMatch } from "./typo";
import type { SearchHitV2, SearchIndexV2, SearchIndexV2Record } from "./types";
import { PHASE14_SEARCH_VERSION } from "./types";

function addInverted(inverted: Record<string, string[]>, token: string, id: string): void {
  const t = token.toLowerCase().trim();
  if (t.length < 2) return;
  const list = inverted[t] ?? [];
  if (!list.includes(id)) list.push(id);
  inverted[t] = list;
}

function collectTerms(record: SearchIndexV2Record): string[] {
  const terms = new Set<string>();
  if (record.name) for (const t of tokenizeForSearch(record.name)) terms.add(t);
  for (const k of record.keywords) terms.add(k.toLowerCase());
  for (const c of record.categories) terms.add(c.toLowerCase());
  for (const e of record.emotions) terms.add(e.toLowerCase());
  for (const s of record.styles) terms.add(s.toLowerCase());
  if (record.meaning) for (const t of tokenizeForSearch(record.meaning)) terms.add(t);
  return [...terms];
}

export function toSearchIndexV2Record(r: KaomojiEditorialRecord): SearchIndexV2Record {
  const emotions = r.emojiquick_categories.filter((c) => c.group === "EMOTION").map((c) => c.slug);
  const styles = r.emojiquick_categories.filter((c) => c.group === "STYLE").map((c) => c.slug);
  return {
    canonical_id: r.canonical_id,
    slug: r.slug,
    content: r.canonical_content,
    normalized_content: normalizeKaomojiContent(r.normalized_content || r.canonical_content),
    name: r.editorial_name,
    meaning: r.meaning,
    keywords: r.emojiquick_keywords,
    categories: r.emojiquick_categories.map((c) => c.slug),
    emotions,
    styles,
    quality_score: r.quality_score,
    beauty_score: r.beauty_score,
    priority: r.editorial_priority,
  };
}

export function buildSearchIndexV2(records: readonly KaomojiEditorialRecord[]): SearchIndexV2 {
  const publicRecords = records.filter((r) => r.is_public).map(toSearchIndexV2Record);
  const by_id: Record<string, SearchIndexV2Record> = {};
  const inverted: Record<string, string[]> = {};

  for (const r of publicRecords) {
    by_id[r.canonical_id] = r;
    for (const term of collectTerms(r)) addInverted(inverted, term, r.canonical_id);
  }

  return { version: PHASE14_SEARCH_VERSION, records: publicRecords, by_id, inverted };
}

export function searchKaomojiV2(
  index: SearchIndexV2,
  query: string,
  limit = 24,
  offset = 0,
): SearchHitV2[] {
  const parsed = normalizeSearchQuery(query);
  if (!parsed.normalized && !parsed.original.trim()) return [];

  const scores = new Map<string, { score: number; reason: string; matched: number }>();
  const w = DEFAULT_RANKING_WEIGHTS;
  const queryTokens = parsed.tokens.length > 0 ? parsed.tokens : (parsed.normalized ? [parsed.normalized] : []);
  const expanded = expandQueryTokens(queryTokens);
  const expandedSet = new Set(expanded);
  const originalSynonyms = queryTokens.some((t) => t in SEARCH_SYNONYMS);

  function bump(id: string, score: number, reason: string, matched = 0): void {
    const cur = scores.get(id);
    if (!cur) scores.set(id, { score, reason, matched: matched || 0 });
    else scores.set(id, {
      score: cur.score + score,
      reason: cur.score >= score ? cur.reason : reason,
      matched: cur.matched + (matched || 0),
    });
  }

  if (parsed.is_kaomoji_like) {
    const nq = normalizeKaomojiContent(parsed.original);
    for (const r of index.records) {
      if (r.content === parsed.original || r.normalized_content === nq) {
        bump(r.canonical_id, w.exact_kaomoji, "exact_kaomoji");
      } else if (r.normalized_content.includes(nq) || r.content.includes(parsed.original)) {
        bump(r.canonical_id, w.exact_normalized, "partial_kaomoji");
      }
    }
  } else {
    const fullQuery = parsed.normalized;
    for (const r of index.records) {
      const name = r.name?.toLowerCase() ?? "";
      const meaning = r.meaning?.toLowerCase() ?? "";
      if (name === fullQuery) bump(r.canonical_id, w.exact_name, "exact_name");
      if (fullQuery.length >= 3 && meaning.includes(fullQuery)) bump(r.canonical_id, w.exact_meaning, "exact_meaning");
    }
  }

  for (const token of expanded) {
    const isSynonymOnly = originalSynonyms && !(queryTokens.includes(token));
    const weight = isSynonymOnly ? w.synonym : w.token;
    const reason = isSynonymOnly ? "synonym" : "token";
    const ids = index.inverted[token] ?? [];
    for (const id of ids) {
      const r = index.by_id[id];
      if (!r) continue;
      let score = weight;
      if (r.keywords.some((k) => k.toLowerCase() === token)) score = Math.max(score, w.exact_keyword);
      if (r.categories.includes(token) || r.emotions.includes(token) || r.styles.includes(token)) {
        score = Math.max(score, w.exact_category);
      }
      if (r.name?.toLowerCase() === token) score = Math.max(score, w.exact_name);
      if (r.name?.toLowerCase().startsWith(token)) score = Math.max(score, w.prefix);
      bump(id, score, reason, queryTokens.includes(token) || expandedSet.has(token) ? 1 : 0);
    }
  }

  if (!parsed.is_kaomoji_like) {
    for (const token of queryTokens) {
      if (token.length < 4) continue;
      for (const [invToken, ids] of Object.entries(index.inverted)) {
        if (expandedSet.has(invToken)) continue;
        if (fuzzyTokenMatch(token, invToken)) {
          for (const id of ids) bump(id, w.fuzzy, "fuzzy");
        }
      }
    }
  }

  const multiBonus = queryTokens.length > 1 ? 400 : 0;
  return [...scores.entries()]
    .map(([id, { score, reason, matched }]) => ({
      record: index.by_id[id]!,
      score: score + multiBonus * Math.min(matched, queryTokens.length),
      match_reason: reason,
    }))
    .filter((h) => h.record)
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.record.quality_score - a.record.quality_score ||
        b.record.beauty_score - a.record.beauty_score,
    )
    .slice(offset, offset + limit);
}
