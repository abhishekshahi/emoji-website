import type { BrowsableEmoji, UnicodeDataSource } from "./types";

export interface MasterSearchResult {
  readonly canonicalId: string;
  readonly character: string | null;
  readonly canonicalName: string;
  readonly score: number;
  readonly seoPageUrl: string | null;
  readonly productionHexcode: string | null;
}

export interface MasterSearchResponse {
  readonly query: string;
  readonly results: readonly MasterSearchResult[];
  readonly ambiguous: boolean;
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

export function mapMasterSearchResultToBrowsable(result: MasterSearchResult): BrowsableEmoji | null {
  const slug = slugFromSeoUrl(result.seoPageUrl);
  if (!slug) return null;

  const hexcode = result.productionHexcode ?? result.canonicalId.replace(/^unicode:/, "");
  const codePoints = hexcode
    .split("-")
    .filter(Boolean)
    .map((part) => part.toUpperCase());

  return {
    id: result.productionHexcode ?? result.canonicalId.replace(/[^a-zA-Z0-9:-]/g, "-"),
    emoji: result.character ?? "\u00b7",
    name: result.canonicalName,
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

export async function fetchMasterSearch(
  query: string,
  limit = 120,
  language = "en",
): Promise<MasterSearchResponse | null> {
  const trimmed = query.trim();
  if (!trimmed) {
    return { query: trimmed, results: [], ambiguous: false };
  }

  const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
  if (language && language !== "en") {
    params.set("lang", language);
  }
  const response = await fetch("/api/master/search?" + params.toString());
  if (!response.ok) return null;
  return (await response.json()) as MasterSearchResponse;
}