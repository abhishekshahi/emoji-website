import "server-only";
import { searchKaomojiRuntime } from "../cloudflare/search-loader";
import type { SearchHit } from "../processing/phase9/search-index";
import type { EditorialPriority } from "../processing/phase9/types";

/** Worker-safe search: D1 on Cloudflare; local index in dev only. */
export async function searchKaomojiPublic(query: string, limit = 24): Promise<SearchHit[]> {
  const hits = await searchKaomojiRuntime(query, limit, 0);
  return hits.map((h) => ({
    record: {
      canonical_id: h.record.canonical_id,
      slug: h.record.slug,
      content: h.record.content,
      name: h.record.name,
      keywords: h.record.keywords,
      categories: h.record.categories,
      quality_score: h.record.quality_score,
      beauty_score: h.record.beauty_score,
      priority: h.record.priority as EditorialPriority,
      is_public: true,
    },
    score: h.score,
    match_reason: h.match_reason,
  }));
}
