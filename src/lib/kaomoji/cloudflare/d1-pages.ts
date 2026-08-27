import "server-only";
import {
  D1_GET_COLLECTION,
  D1_GET_COLLECTION_ITEMS,
  D1_GET_KAOMOJI_BY_SLUG,
} from "./d1-queries";
import { getRelatedKaomojiBundleFromD1 } from "./d1-related";
import { resolveKaomojiD1Binding } from "./d1-binding";
import { KAOMOJI_COLLECTION_PAGE_SIZE } from "../product/collection-pages";

export interface D1CollectionMeta {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly rule: string;
  readonly item_count: number;
}

export interface D1CollectionItem {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly editorial_name: string | null;
  readonly accessible_name: string;
}

export interface D1KaomojiDetail {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly editorial_name: string | null;
  readonly accessible_name: string;
  readonly seo_title: string | null;
  readonly seo_description: string | null;
  readonly meaning: string | null;
  readonly common_usage: string | null;
}

export interface D1RelatedKaomoji {
  readonly canonical_id: string;
  readonly slug: string;
  readonly content: string;
  readonly accessible_name: string;
}

const D1_GET_COLLECTION_ITEMS_PAGED = `
  SELECT k.canonical_id, k.slug, k.content, k.editorial_name, k.accessible_name, k.quality_score
  FROM collection_item ci
  INNER JOIN kaomoji k ON k.canonical_id = ci.canonical_id
  WHERE ci.collection_slug = ?1 AND k.is_public = 1
  ORDER BY ci.sort_order ASC
  LIMIT ?2 OFFSET ?3
`.trim();

export async function getCollectionFromD1(
  slug: string,
  page: number,
): Promise<{ meta: D1CollectionMeta; items: D1CollectionItem[]; page: number; totalPages: number } | null> {
  const db = await resolveKaomojiD1Binding();
  if (!db) return null;

  const col = await db.prepare(D1_GET_COLLECTION).bind(slug).all<D1CollectionMeta>();
  const meta = col.results?.[0];
  if (!meta) return null;

  const totalPages = Math.max(1, Math.ceil(meta.item_count / KAOMOJI_COLLECTION_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const offset = (safePage - 1) * KAOMOJI_COLLECTION_PAGE_SIZE;

  const items = await db
    .prepare(D1_GET_COLLECTION_ITEMS_PAGED)
    .bind(slug, KAOMOJI_COLLECTION_PAGE_SIZE, offset)
    .all<D1CollectionItem>();

  return {
    meta,
    items: items.results ?? [],
    page: safePage,
    totalPages,
  };
}

export async function getKaomojiDetailFromD1(slug: string): Promise<D1KaomojiDetail | null> {
  const db = await resolveKaomojiD1Binding();
  if (!db) return null;
  const row = await db.prepare(D1_GET_KAOMOJI_BY_SLUG).bind(slug).all<D1KaomojiDetail & { common_usage?: string }>();
  return row.results?.[0] ?? null;
}

export async function getRelatedKaomojiFromD1(canonicalId: string, limit = 12): Promise<D1RelatedKaomoji[]> {
  const similarLimit = Math.min(8, limit);
  const relatedLimit = Math.max(0, limit - similarLimit);
  const bundle = await getRelatedKaomojiBundleFromD1(canonicalId, { similarLimit, relatedLimit });
  return [...bundle.similar, ...bundle.related].slice(0, limit).map((r) => ({
    canonical_id: r.canonical_id,
    slug: r.slug,
    content: r.content,
    accessible_name: r.accessible_name,
  }));
}

export async function getRelatedKaomojiBundleForPageFromD1(canonicalId: string) {
  return getRelatedKaomojiBundleFromD1(canonicalId, { similarLimit: 8, relatedLimit: 12 });
}

/** Count items for collections that lack item_count sync (fallback). */
export async function countCollectionItems(slug: string): Promise<number> {
  const db = await resolveKaomojiD1Binding();
  if (!db) return 0;
  const rows = await db.prepare(D1_GET_COLLECTION_ITEMS).bind(slug, 5000).all<{ canonical_id: string }>();
  return rows.results?.length ?? 0;
}
