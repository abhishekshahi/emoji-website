import { EMOJIQUICK_TAXONOMY, TAXONOMY_GROUPS, getTaxonomyBySlug } from "../processing/phase9/taxonomy";
import type { TaxonomyCategory } from "../processing/phase9/types";

/** URL segment for each taxonomy group — must match production paths. */
export const TAXONOMY_GROUP_PATH: Record<(typeof TAXONOMY_GROUPS)[number], string> = {
  EMOTION: "emotions",
  LOVE_RELATIONSHIP: "affection",
  CUTE_KAWAII: "cute-kawaii",
  ANIMALS: "animals",
  ACTIONS: "actions",
  STYLE: "style",
};

export const TAXONOMY_GROUP_PATHS = Object.values(TAXONOMY_GROUP_PATH);

const PATH_TO_GROUP = new Map(
  (Object.entries(TAXONOMY_GROUP_PATH) as Array<[(typeof TAXONOMY_GROUPS)[number], string]>).map(
    ([group, path]) => [path, group],
  ),
);

export const CATEGORY_PAGE_SIZE = 48 as const;

export function taxonomyGroupFromPath(groupPath: string): (typeof TAXONOMY_GROUPS)[number] | undefined {
  return PATH_TO_GROUP.get(groupPath);
}

export function taxonomyGroupPath(group: string): string | undefined {
  if ((TAXONOMY_GROUPS as readonly string[]).includes(group)) {
    return TAXONOMY_GROUP_PATH[group as (typeof TAXONOMY_GROUPS)[number]];
  }
  return undefined;
}

export function listTaxonomyInGroupPath(groupPath: string): readonly TaxonomyCategory[] {
  const group = taxonomyGroupFromPath(groupPath);
  if (!group) return [];
  return EMOJIQUICK_TAXONOMY.filter((c) => c.group === group);
}

export function resolveNestedCategory(
  groupPath: string,
  slug: string,
): TaxonomyCategory | undefined {
  const cat = getTaxonomyBySlug(slug);
  if (!cat) return undefined;
  if (taxonomyGroupPath(cat.group) !== groupPath) return undefined;
  return cat;
}

export function nestedCategoryPath(categorySlug: string, page = 1): string | null {
  const cat = getTaxonomyBySlug(categorySlug);
  if (!cat) return null;
  const groupPath = taxonomyGroupPath(cat.group);
  if (!groupPath) return null;
  return `/kaomoji/categories/${groupPath}/${categorySlug}/page/${page}`;
}

export function nestedGroupPath(group: string): string | null {
  const path = taxonomyGroupPath(group);
  return path ? `/kaomoji/categories/${path}` : null;
}

export function parseCategoryPageParam(raw: string): number | null {
  if (!/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return n;
}

export function categoryTotalPages(itemCount: number, pageSize: number = CATEGORY_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, itemCount) / pageSize));
}
