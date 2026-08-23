export interface KaomojiSearchFilters {
  readonly category?: string;
  readonly locale?: string;
}

export function parseKaomojiSearchFilters(params: URLSearchParams): KaomojiSearchFilters {
  const category = params.get("category")?.trim() || undefined;
  const locale = params.get("locale")?.trim() || params.get("lang")?.trim() || undefined;
  return {
    ...(category ? { category } : {}),
    ...(locale ? { locale } : {}),
  };
}

export function buildKaomojiSearchUrl(query: string, filters: KaomojiSearchFilters = {}): string {
  const p = new URLSearchParams();
  if (query.trim()) p.set("q", query.trim());
  if (filters.category) p.set("category", filters.category);
  if (filters.locale) p.set("locale", filters.locale);
  const qs = p.toString();
  return qs ? `/api/kaomoji/search?${qs}` : "/api/kaomoji/search";
}

export const KAOMOJI_FILTER_CATEGORIES = [
  { slug: "cute", label: "Cute" },
  { slug: "happy", label: "Happy" },
  { slug: "love", label: "Love" },
  { slug: "cat", label: "Cat" },
  { slug: "japanese", label: "Japanese" },
  { slug: "ascii", label: "ASCII" },
] as const;
