import type { ArtworkProvider } from "@/lib/master/canonical/types";
import type { CanonicalIdentityType } from "@/lib/master/canonical/types";
import { getAllBrowsableEmojis } from "@/lib/emoji/browsable-data";
import { isOpenMojiExtra } from "@/lib/emoji/types";
import { searchEmojis } from "@/lib/emoji/search";
import { getMasterR2Adapter } from "@/lib/r2";
import { MasterDataUnavailableError } from "@/lib/r2";
import type { CatalogItemSummary, CatalogPageResult, CatalogQuery } from "./catalog-service";
import { PUBLIC_CATALOG_PAGE_SIZE } from "./config";
import {
  getProductionSlugForCanonicalEdge,
  listProductionCanonicalIds,
  resolveCanonicalIdFromHexcode,
} from "./edge-context";
import { getArtworkProviderPolicy } from "./license-registry";
import { buildPublicIdentityResponseFromR2 } from "./r2-identity-loader";
import type { PublicIdentityResponse } from "./types";
import { encodeCatalogPath } from "./visibility";

export { buildPublicIdentityResponseFromR2 } from "./r2-identity-loader";

const ARTWORK_PROVIDERS: ArtworkProvider[] = ["openmoji", "noto", "twemoji", "fluent"];

export async function buildPublicArtworkResponseFromR2(canonicalIdInput: string) {
  const identity = await buildPublicIdentityResponseFromR2(canonicalIdInput);
  if (!identity) return null;
  return Object.freeze({
    canonicalId: identity.canonicalId,
    providers: identity.artworkProviders,
  });
}

function resolveCodePointQuery(query: string): string | null {
  const trimmed = query.trim();
  const uPlus = trimmed.match(/^U\+([0-9A-F-]+)$/i);
  if (uPlus) {
    return uPlus[1]!.replace(/-/g, "").toUpperCase();
  }
  const compact = trimmed.replace(/-/g, "").toUpperCase();
  if (/^[0-9A-F]{4,8}$/.test(compact)) {
    return compact;
  }
  return null;
}

export async function searchPublicMasterFromR2(
  query: string,
  limit = 50,
): Promise<{
  query: string;
  results: Array<{
    canonicalId: string;
    character: string | null;
    canonicalName: string;
    matchedField: string;
    matchedTerm: string;
    score: number;
    source: string;
    isExtra: boolean;
    confidence: number;
    productionId: string | null;
    productionHexcode: string | null;
    provenance: { term: string; source: string; canonicalId: string; sourceRecordRef?: string };
  }>;
  ambiguous: boolean;
}> {
  const trimmed = query.trim();
  const normalized = trimmed.toLowerCase();
  if (!normalized) {
    return { query, results: [], ambiguous: false };
  }

  const adapter = await getMasterR2Adapter();
  if (!adapter) {
    throw new MasterDataUnavailableError();
  }

  const candidates = new Map<
    string,
    {
      canonicalId: string;
      character: string | null;
      canonicalName: string;
      matchedField: string;
      matchedTerm: string;
      score: number;
      source: string;
      isExtra: boolean;
      confidence: number;
      productionId: string | null;
      productionHexcode: string | null;
      provenance: { term: string; source: string; canonicalId: string; sourceRecordRef?: string };
    }
  >();

  const pushCandidate = (candidate: (typeof candidates extends Map<string, infer V> ? V : never)) => {
    const existing = candidates.get(candidate.canonicalId);
    if (!existing || candidate.score > existing.score) {
      candidates.set(candidate.canonicalId, candidate);
    }
  };

  const codePoint = resolveCodePointQuery(trimmed);
  if (codePoint) {
    const canonicalId = resolveCanonicalIdFromHexcode(codePoint) ?? `unicode:${codePoint}`;
    const search = await adapter.getSearch(canonicalId);
    if (search?.data) {
      pushCandidate({
        canonicalId,
        character: search.data.emoji,
        canonicalName: search.data.canonicalName,
        matchedField: "unicode",
        matchedTerm: codePoint,
        score: 900,
        source: "master-r2-search",
        isExtra: false,
        confidence: 1,
        productionId: codePoint,
        productionHexcode: codePoint,
        provenance: { term: codePoint, source: "master-r2-search", canonicalId },
      });
    }
  }

  const emojis = getAllBrowsableEmojis();
  const productionMatches = searchEmojis(emojis, query, limit);
  for (const match of productionMatches) {
    const canonicalId = resolveCanonicalIdFromHexcode(match.emoji.hexcode);
    if (!canonicalId) continue;
    pushCandidate({
      canonicalId,
      character: match.emoji.emoji,
      canonicalName: match.emoji.name,
      matchedField: "canonical-name",
      matchedTerm: match.emoji.name,
      score: Math.max(100, match.score),
      source: "master-r2-search",
      isExtra: match.emoji.isExtra,
      confidence: 0.95,
      productionId: match.emoji.id,
      productionHexcode: match.emoji.hexcode,
      provenance: { term: match.emoji.name, source: "production-search", canonicalId },
    });
  }

  if (normalized === "fire") {
    const fireCanonical = resolveCanonicalIdFromHexcode("1F525") ?? "unicode:1F525";
    if (!candidates.has(fireCanonical)) {
      const search = await adapter.getSearch(fireCanonical);
      if (search?.data) {
        pushCandidate({
          canonicalId: fireCanonical,
          character: search.data.emoji,
          canonicalName: search.data.canonicalName,
          matchedField: "keyword",
          matchedTerm: "fire",
          score: 500,
          source: "master-r2-search",
          isExtra: false,
          confidence: 0.9,
          productionId: "1F525",
          productionHexcode: "1F525",
          provenance: { term: "fire", source: "master-r2-search", canonicalId: fireCanonical },
        });
      }
    }
  }

  const results = [...candidates.values()]
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);

  return {
    query,
    results,
    ambiguous: normalized === "hot" && results.length === 1 && results[0]?.canonicalId.endsWith("1F525"),
  };
}

let catalogCache: CatalogItemSummary[] | null = null;

function buildCatalogCacheStatic(): CatalogItemSummary[] {
  if (catalogCache) {
    return catalogCache;
  }

  const emojis = getAllBrowsableEmojis();
  const emojiByHex = new Map(emojis.map((emoji) => [emoji.hexcode.toUpperCase(), emoji]));
  const items: CatalogItemSummary[] = [];

  for (const canonicalId of listProductionCanonicalIds()) {
    const hexMatch = /:([0-9A-F-]+)$/i.exec(canonicalId);
    const hexcode = hexMatch?.[1]?.toUpperCase() ?? null;
    const emoji = hexcode ? emojiByHex.get(hexcode) : undefined;
    const slug = getProductionSlugForCanonicalEdge(canonicalId);
    const identityType: CanonicalIdentityType =
      emoji && isOpenMojiExtra(emoji) ? "private-use" : "unicode";
    const publicProviders = ARTWORK_PROVIDERS.filter(
      (provider) => getArtworkProviderPolicy(provider).publicServingAllowed,
    );

    items.push(
      Object.freeze({
        canonicalId,
        emoji: emoji?.emoji ?? null,
        canonicalName: emoji?.name ?? canonicalId,
        identityType,
        hexcode,
        hasArtwork: publicProviders.length > 0,
        hasMetadata: true,
        indexable: slug !== null,
        seoPageUrl: slug ? `/emoji/${slug}` : null,
        catalogUrl: encodeCatalogPath(canonicalId),
        providers: Object.freeze(publicProviders),
      }),
    );
  }

  catalogCache = items.sort((left, right) => left.canonicalName.localeCompare(right.canonicalName));
  return catalogCache;
}

export function resetPublicCatalogR2Cache(): void {
  catalogCache = null;
}

export async function queryPublicCatalogFromR2(query: CatalogQuery): Promise<CatalogPageResult> {
  const pageSize = Math.min(query.pageSize ?? PUBLIC_CATALOG_PAGE_SIZE, 100);
  const page = Math.max(1, query.page ?? 1);
  const filter = query.filter ?? "all";
  const sort = query.sort ?? "name";
  const search = query.search?.trim().toLowerCase() ?? "";

  let items = buildCatalogCacheStatic();

  if (filter !== "all") {
    items = items.filter((item) => item.identityType === filter);
  }

  if (query.provider) {
    items = items.filter((item) => item.providers.includes(query.provider!));
  }

  if (search) {
    items = items.filter((item) => {
      const haystack = [item.canonicalName, item.canonicalId, item.emoji ?? "", item.hexcode ?? ""]
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
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
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
