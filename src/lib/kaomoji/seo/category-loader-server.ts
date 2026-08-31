import "server-only";
import {
  D1_COUNT_BY_CATEGORY_PUBLIC,
  D1_LIST_BY_CATEGORY_RANKED,
  D1_LIST_BY_CATEGORY_RANKED_PAGE,
} from "../cloudflare/d1-queries";
import { resolveKaomojiD1Binding } from "../cloudflare/d1-binding";
import type { CategoryPageData } from "./category-loader";
import { getCategoryPageDataLocal, getCategoryPageDataLocalPaged } from "./category-loader";
import { CATEGORY_PAGE_SIZE, categoryTotalPages } from "./category-routes";
import { getTaxonomyBySlug } from "../processing/phase9/taxonomy";

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
      .prepare(D1_COUNT_BY_CATEGORY_PUBLIC)
      .bind(categorySlug)
      .all<{ cnt: number }>();
    const itemCount = Number(countRow.results?.[0]?.cnt ?? rows.length);
    const tax = getTaxonomyBySlug(categorySlug);
    const local = getCategoryPageDataLocal(categorySlug, 1);
    return {
      categorySlug,
      label: local?.label ?? tax?.label ?? categorySlug,
      group: local?.group ?? tax?.group ?? "EMOTION",
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

export async function getCategoryPageDataPaged(
  categorySlug: string,
  page: number,
  pageSize: number = CATEGORY_PAGE_SIZE,
): Promise<(CategoryPageData & { page: number; totalPages: number }) | null> {
  if (!Number.isFinite(page) || page < 1) return null;
  const db = await resolveKaomojiD1Binding();
  if (db) {
    const countRow = await db
      .prepare(D1_COUNT_BY_CATEGORY_PUBLIC)
      .bind(categorySlug)
      .all<{ cnt: number }>();
    const itemCount = Number(countRow.results?.[0]?.cnt ?? 0);
    if (itemCount <= 0) return null;
    const totalPages = categoryTotalPages(itemCount, pageSize);
    if (page > totalPages) return null;
    const offset = (page - 1) * pageSize;
    const rows =
      (
        await db.prepare(D1_LIST_BY_CATEGORY_RANKED_PAGE).bind(categorySlug, pageSize, offset).all<{
          canonical_id: string;
          slug: string;
          content: string;
          editorial_name: string | null;
          accessible_name: string;
        }>()
      ).results ?? [];
    const tax = getTaxonomyBySlug(categorySlug);
    return {
      categorySlug,
      label: tax?.label ?? categorySlug,
      group: tax?.group ?? "EMOTION",
      itemCount,
      page,
      totalPages,
      items: rows.map((r) => ({
        canonical_id: r.canonical_id,
        slug: r.slug,
        content: r.content,
        name: r.editorial_name,
        accessible_name: r.accessible_name,
      })),
    };
  }
  const local = getCategoryPageDataLocalPaged(categorySlug, page, pageSize);
  if (!local) return null;
  return {
    ...local,
    page,
    totalPages: categoryTotalPages(local.itemCount, pageSize),
  };
}

export async function countCategoryRecords(categorySlug: string): Promise<number> {
  const data = await getCategoryPageData(categorySlug, 1);
  return data?.itemCount ?? 0;
}
