import "server-only";
import { searchKaomojiRuntime } from "../cloudflare/search-loader";
import { getCategoryPageData } from "../seo/category-loader-server";
import type { CategoryPageItem } from "../seo/category-loader";
import type { EventGuide } from "./types";
import { MIN_EVENT_PAGE_ITEMS } from "./registry";

function dedupeItems(items: readonly CategoryPageItem[]): CategoryPageItem[] {
  const seen = new Set<string>();
  const out: CategoryPageItem[] = [];
  for (const item of items) {
    if (seen.has(item.canonical_id)) continue;
    seen.add(item.canonical_id);
    out.push(item);
  }
  return out;
}

export async function loadEventKaomoji(
  guide: EventGuide,
  limit = 48,
): Promise<{ items: readonly CategoryPageItem[]; total: number } | null> {
  const hits = await searchKaomojiRuntime(guide.searchQuery, limit, 0);
  const fromSearch: CategoryPageItem[] = hits.map((h) => ({
    canonical_id: h.record.canonical_id,
    slug: h.record.slug,
    content: h.record.content,
    name: h.record.name,
    accessible_name: h.record.name ?? h.record.content.slice(0, 48),
  }));

  const merged = dedupeItems(fromSearch);
  if (merged.length < MIN_EVENT_PAGE_ITEMS) {
    for (const slug of guide.categorySlugs) {
      const cat = await getCategoryPageData(slug, 24);
      if (cat) merged.push(...cat.items);
      if (dedupeItems(merged).length >= MIN_EVENT_PAGE_ITEMS) break;
    }
  }

  const items = dedupeItems(merged).slice(0, limit);
  if (items.length < MIN_EVENT_PAGE_ITEMS) return null;
  return { items, total: items.length };
}
