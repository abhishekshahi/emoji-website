import type { KaomojiEditorialRecord } from "../processing/phase9/types";

export const KAOMOJI_COLLECTION_PAGE_SIZE = 48;

export function paginateCollectionIds(ids: readonly string[], page: number): {
  readonly page: number;
  readonly totalPages: number;
  readonly pageIds: readonly string[];
} {
  const totalPages = Math.max(1, Math.ceil(ids.length / KAOMOJI_COLLECTION_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * KAOMOJI_COLLECTION_PAGE_SIZE;
  return {
    page: safePage,
    totalPages,
    pageIds: ids.slice(start, start + KAOMOJI_COLLECTION_PAGE_SIZE),
  };
}

export function resolveCollectionItems(
  ids: readonly string[],
  byId: ReadonlyMap<string, KaomojiEditorialRecord>,
): KaomojiEditorialRecord[] {
  return ids.map((id) => byId.get(id)).filter((r): r is KaomojiEditorialRecord => Boolean(r));
}
