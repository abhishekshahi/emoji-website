export function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizeForComparison(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeKeyword(value: string): string {
  return normalizeWhitespace(value).toLowerCase().normalize("NFKC");
}

export function normalizeShortcode(value: string): string {
  return value.trim().replace(/^:+|:+$/g, "").toLowerCase();
}

export function keywordDedupKey(value: string): string {
  return normalizeForComparison(value);
}

export function slugifyName(value: string): string {
  return normalizeWhitespace(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function disambiguatedSlug(baseSlug: string, canonicalId: string): string {
  if (!canonicalId.startsWith("unicode:")) {
    const tail = canonicalId.replace(/^source:[^:]+:/, "").replace(/\.[^.]+$/, "");
    const safe = slugifyName(tail) || "item";
    return `${baseSlug || "item"}-${safe}`;
  }

  const sequence = canonicalId.slice("unicode:".length).toLowerCase().replace(/-/g, "");
  return `${baseSlug || "emoji"}-u${sequence}`;
}

export function isLikelyDefinition(value: string): boolean {
  if (value.length > 80) {
    return true;
  }
  if (/https?:\/\//i.test(value)) {
    return true;
  }
  if ((value.match(/[.!?]/g) ?? []).length >= 2) {
    return true;
  }
  return false;
}

export function tokenizeWords(value: string): string[] {
  return normalizeForComparison(value)
    .split(" ")
    .filter((token) => token.length > 0);
}

export function singularizeToken(token: string): string {
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("s") && token.length > 3 && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export const REGIONAL_TERM_PAIRS: Array<[string, string]> = [
  ["pants", "trousers"],
  ["trousers", "pants"],
  ["cookie", "biscuit"],
  ["biscuit", "cookie"],
  ["elevator", "lift"],
  ["lift", "elevator"],
  ["truck", "lorry"],
  ["lorry", "truck"],
];

export function isRegionalPair(left: string, right: string): boolean {
  const a = normalizeForComparison(left);
  const b = normalizeForComparison(right);
  return REGIONAL_TERM_PAIRS.some(([one, two]) => (a === one && b === two) || (a === two && b === one));
}
