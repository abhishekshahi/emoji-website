import type { BrowsableEmoji, UnicodeDataSource } from "./types";

export interface CatalogApiItem {
  readonly canonicalId: string;
  readonly emoji: string | null;
  readonly canonicalName: string;
  readonly hexcode: string | null;
  readonly seoPageUrl: string | null;
}

export interface CatalogApiPage {
  readonly items: readonly CatalogApiItem[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

const DEFAULT_SEQUENCE = {
  kind: "single" as const,
  status: "fully-qualified" as const,
  hasVariationSelector: false,
  hasZeroWidthJoiner: false,
  isRGI: true,
  sources: ["emoji-test"] as UnicodeDataSource[],
};

function slugFromSeoUrl(seoPageUrl: string | null): string | null {
  if (!seoPageUrl) return null;
  const match = seoPageUrl.match(/\/emoji\/([^/?#]+)/);
  return match?.[1] ?? null;
}

function hexcodeFromCanonicalId(canonicalId: string): string {
  if (canonicalId.startsWith("unicode:")) {
    return canonicalId.slice("unicode:".length);
  }
  return canonicalId.replace(/[^0-9A-F-]/gi, "").replace(/-/g, "-");
}

export function mapCatalogItemToBrowsable(item: CatalogApiItem): BrowsableEmoji | null {
  const slug = slugFromSeoUrl(item.seoPageUrl);
  if (!slug) return null;

  const hexcode = item.hexcode ?? hexcodeFromCanonicalId(item.canonicalId);
  const codePoints = hexcode
    .split("-")
    .filter(Boolean)
    .map((part) => part.toUpperCase());

  return {
    id: item.canonicalId.replace(/[^a-zA-Z0-9:-]/g, "-"),
    emoji: item.emoji ?? "\u00b7",
    name: item.canonicalName,
    slug,
    category: "symbols",
    subcategory: "other-symbol",
    keywords: [],
    shortcodes: [],
    unicodeVersion: "17.0",
    codePoints,
    codePointsDecimal: [],
    codePointString: codePoints.join(" "),
    hexcode,
    sequence: { ...DEFAULT_SEQUENCE },
  };
}

export async function fetchCatalogPage(page: number, pageSize = 100): Promise<CatalogApiPage | null> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    sort: "name",
  });
  const response = await fetch("/api/master/catalog?" + params.toString());
  if (!response.ok) return null;
  return (await response.json()) as CatalogApiPage;
}