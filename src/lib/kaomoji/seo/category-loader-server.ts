import "server-only";
import { D1_LIST_BY_CATEGORY_RANKED } from "../cloudflare/d1-queries";
import { resolveKaomojiD1Binding } from "../cloudflare/d1-binding";
import type { CategoryPageData } from "./category-loader";
import { getCategoryPageDataLocal } from "./category-loader";

export async function getCategoryPageData(categorySlug: string, limit = 48): Promise<CategoryPageData | null> {
  const db = await resolveKaomojiD1Binding();
  if (db) {
    const rows =
      (
        await db.prepare(D1_LIST_BY_CATEGORY_RANKED).bind(categorySlug, limit).all<{
          canonical_id: string;
          slug: string;
          content: string;
          editorial_name: string | null;
          accessible_name: string;
        }>()
      ).results ?? [];
    if (rows.length === 0) return null;
    const countRow = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM kaomoji_category kc INNER JOIN kaomoji k ON k.canonical_id = kc.canonical_id WHERE kc.category_slug = ?1 AND k.is_public = 1`,
      )
      .bind(categorySlug)
      .all<{ cnt: number }>();
    const itemCount = Number(countRow.results?.[0]?.cnt ?? rows.length);
    const local = getCategoryPageDataLocal(categorySlug, 1);
    return {
      categorySlug,
      label: local?.label ?? categorySlug,
      group: local?.group ?? "EMOTION",
      itemCount,
      items: rows.map((r) => ({
        canonical_id: r.canonical_id,
        slug: r.slug,
        content: r.content,
        name: r.editorial_name,
        accessible_name: r.accessible_name,
      })),
    };
  }
  return getCategoryPageDataLocal(categorySlug, limit);
}

export async function countCategoryRecords(categorySlug: string): Promise<number> {
  const data = await getCategoryPageData(categorySlug, 1);
  return data?.itemCount ?? 0;
}
