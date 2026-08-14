import type { CanonicalIdentityType } from "@/lib/master/canonical/types";
import type { ArtworkProvider } from "@/lib/master/canonical/types";
import { MASTER_IDENTITY_COUNT } from "@/lib/master/r2/catalog";
import { getMasterReader } from "@/lib/master/integration/master-reader";
import { PUBLIC_CATALOG_PAGE_SIZE } from "./config";
import { resolvePublicVisibility } from "./visibility";

export type CatalogFilterType = "all" | CanonicalIdentityType;
export type CatalogSortField = "name" | "unicode" | "type";

export interface CatalogItemSummary {
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly canonicalName: string;
  readonly identityType: CanonicalIdentityType;
  readonly hexcode: string | null;
  readonly hasArtwork: boolean;
  readonly hasMetadata: boolean;
  readonly indexable: boolean;
  readonly seoPageUrl: string | null;
  readonly catalogUrl: string;
  readonly providers: readonly ArtworkProvider[];
}

export interface CatalogQuery {
  readonly filter?: CatalogFilterType;
  readonly provider?: ArtworkProvider;
  readonly search?: string;
  readonly sort?: CatalogSortField;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface CatalogPageResult {
  readonly items: readonly CatalogItemSummary[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
  readonly filter: CatalogFilterType;
}

let catalogCache: CatalogItemSummary[] | null = null;

function buildCatalogCache(rootDir: string): CatalogItemSummary[] {
  const reader = getMasterReader(rootDir);
  const items: CatalogItemSummary[] = [];

  for (const entry of reader.searchIndex.values()) {
    const canonical = reader.canonicalRecords.get(entry.canonicalId);
    if (!canonical) continue;

    const artwork = reader.artworkByCanonical.get(entry.canonicalId);
    const providers: ArtworkProvider[] = ["openmoji", "noto", "twemoji", "fluent"];
    const availableProviders = providers.filter((p) => (artwork?.[p]?.length ?? 0) > 0);
    const visibility = resolvePublicVisibility(entry.canonicalId, rootDir);
    if (!visibility?.public) continue;

    items.push(
      Object.freeze({
        canonicalId: entry.canonicalId,
        emoji: entry.emoji,
        canonicalName: entry.canonicalName,
        identityType: canonical.identityType,
        hexcode: entry.hexcode,
        hasArtwork: availableProviders.length > 0,
        hasMetadata: canonical.metadataSources.length > 0,
        indexable: visibility.indexable,
        seoPageUrl: visibility.seoPageUrl,
        catalogUrl: visibility.catalogUrl,
        providers: Object.freeze(availableProviders),
      }),
    );
  }

  return items.sort((left, right) => left.canonicalName.localeCompare(right.canonicalName));
}

function getCatalogItems(rootDir: string): CatalogItemSummary[] {
  if (!catalogCache) {
    catalogCache = buildCatalogCache(rootDir);
  }
  return catalogCache;
}

export function resetCatalogCache(): void {
  catalogCache = null;
}

export function queryCatalog(query: CatalogQuery, rootDir: string = process.cwd()): CatalogPageResult {
  const pageSize = Math.min(query.pageSize ?? PUBLIC_CATALOG_PAGE_SIZE, 100);
  const page = Math.max(1, query.page ?? 1);
  const filter = query.filter ?? "all";
  const sort = query.sort ?? "name";
  const search = query.search?.trim().toLowerCase() ?? "";

  let items = getCatalogItems(rootDir);

  if (filter !== "all") {
    items = items.filter((item) => item.identityType === filter);
  }

  if (query.provider) {
    items = items.filter((item) => item.providers.includes(query.provider!));
  }

  if (search) {
    items = items.filter((item) => {
      const haystack = [
        item.canonicalName,
        item.canonicalId,
        item.emoji ?? "",
        item.hexcode ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  if (sort === "unicode") {
    items = [...items].sort((left, right) => (left.hexcode ?? "").localeCompare(right.hexcode ?? ""));
  } else if (sort === "type") {
    items = [...items].sort((left, right) => left.identityType.localeCompare(right.identityType));
  }

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const paged = items.slice(start, start + pageSize);

  return Object.freeze({
    items: Object.freeze(paged),
    total,
    page,
    pageSize,
    totalPages,
    filter,
  });
}

export function getCatalogStats(rootDir: string = process.cwd()): {
  totalIdentities: number;
  publicIdentities: number;
  indexableIdentities: number;
  withArtwork: number;
  withMetadata: number;
  byType: Record<CanonicalIdentityType, number>;
} {
  const items = getCatalogItems(rootDir);
  const byType: Record<CanonicalIdentityType, number> = {
    unicode: 0,
    "source-specific": 0,
    "private-use": 0,
  };
  let indexable = 0;
  let withArtwork = 0;
  let withMetadata = 0;

  for (const item of items) {
    byType[item.identityType] += 1;
    if (item.indexable) indexable += 1;
    if (item.hasArtwork) withArtwork += 1;
    if (item.hasMetadata) withMetadata += 1;
  }

  return {
    totalIdentities: MASTER_IDENTITY_COUNT,
    publicIdentities: items.length,
    indexableIdentities: indexable,
    withArtwork,
    withMetadata,
    byType,
  };
}

export function getCatalogItem(canonicalId: string, rootDir?: string): CatalogItemSummary | null {
  return getCatalogItems(rootDir ?? process.cwd()).find((item) => item.canonicalId === canonicalId) ?? null;
}

export function getCatalogFilterCounts(rootDir: string = process.cwd()): Record<CatalogFilterType, number> {
  const items = getCatalogItems(rootDir);
  return {
    all: items.length,
    unicode: items.filter((i) => i.identityType === "unicode").length,
    "source-specific": items.filter((i) => i.identityType === "source-specific").length,
    "private-use": items.filter((i) => i.identityType === "private-use").length,
  };
}
