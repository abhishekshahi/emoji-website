const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
const dir = path.join(root, "src/lib/kaomoji/processing/phase9");
function w(name, content) { fs.writeFileSync(path.join(dir, name), content, "utf8"); console.log("wrote", name); }

w("search-index.ts", `import type { KaomojiEditorialRecord, SearchIndexRecord } from "./types";
import { tokenizeForSearch } from "./keywords";

export interface SearchIndex {
  readonly records: readonly SearchIndexRecord[];
  readonly by_id: Record<string, SearchIndexRecord>;
  readonly tokens: Record<string, string[]>;
}

export function toSearchIndexRecord(r: KaomojiEditorialRecord): SearchIndexRecord {
  return {
    canonical_id: r.canonical_id,
    slug: r.slug,
    content: r.canonical_content,
    name: r.editorial_name,
    keywords: r.emojiquick_keywords,
    categories: r.emojiquick_categories.map((c) => c.slug),
    quality_score: r.quality_score,
    beauty_score: r.beauty_score,
    priority: r.editorial_priority,
    is_public: r.is_public,
  };
}

export function buildSearchIndex(records: readonly KaomojiEditorialRecord[]): SearchIndex {
  const publicRecords = records.filter((r) => r.is_public).map(toSearchIndexRecord);
  const by_id: Record<string, SearchIndexRecord> = {};
  const tokens: Record<string, string[]> = {};

  function addToken(token: string, id: string) {
    const t = token.toLowerCase().trim();
    if (t.length < 2) return;
    const list = tokens[t] ?? [];
    if (!list.includes(id)) list.push(id);
    tokens[t] = list;
  }

  for (const r of publicRecords) {
    by_id[r.canonical_id] = r;
    addToken(r.content, r.canonical_id);
    if (r.name) for (const t of tokenizeForSearch(r.name)) addToken(t, r.canonical_id);
    for (const k of r.keywords) addToken(k, r.canonical_id);
    for (const c of r.categories) addToken(c, r.canonical_id);
  }

  return { records: publicRecords, by_id, tokens };
}

export interface SearchHit {
  readonly record: SearchIndexRecord;
  readonly score: number;
  readonly match_reason: string;
}

export function searchKaomoji(index: SearchIndex, query: string, limit = 24): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scores = new Map<string, { score: number; reason: string }>();

  function bump(id: string, score: number, reason: string) {
    const cur = scores.get(id);
    if (!cur || score > cur.score) scores.set(id, { score: (cur?.score ?? 0) + score, reason });
    else scores.set(id, { score: cur.score + score, reason: cur.reason });
  }

  for (const r of index.records) {
    if (r.content.toLowerCase() === q) bump(r.canonical_id, 1000, "exact_kaomoji");
    else if (r.content.toLowerCase().includes(q)) bump(r.canonical_id, 800, "partial_kaomoji");
    if (r.name?.toLowerCase() === q) bump(r.canonical_id, 900, "exact_name");
    else if (r.name?.toLowerCase().includes(q)) bump(r.canonical_id, 600, "partial_name");
  }

  const terms = tokenizeForSearch(q);
  for (const term of terms) {
    const ids = index.tokens[term] ?? [];
    for (const id of ids) {
      bump(id, term === q ? 500 : 300, "keyword");
    }
    for (const [token, ids2] of Object.entries(index.tokens)) {
      if (token.includes(term) || term.includes(token)) {
        for (const id of ids2) bump(id, 150, "related_term");
      }
    }
  }

  return [...scores.entries()]
    .map(([id, { score, reason }]) => ({ record: index.by_id[id]!, score, match_reason: reason }))
    .filter((h) => h.record)
    .sort((a, b) => b.score - a.score || b.record.quality_score - a.record.quality_score)
    .slice(0, limit);
}
`);

console.log("batch3 search-index done");
