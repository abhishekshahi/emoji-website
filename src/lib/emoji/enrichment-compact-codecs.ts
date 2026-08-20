import type {
  CompactRelatedGrouped,
  CompactVariantKindCode,
} from "./enrichment-compact-types";
import type { EnrichmentRelatedLink, EnrichmentVariantKind } from "./enrichment-types";

const VARIANT_KIND_TO_CODE: Record<EnrichmentVariantKind, CompactVariantKindCode> = {
  "skin-tone": "t",
  gender: "g",
  profession: "p",
  family: "f",
  couple: "c",
  zwj: "z",
  flag: "l",
  keycap: "k",
  sequence: "s",
  related: "r",
};

const VARIANT_CODE_TO_KIND: Record<CompactVariantKindCode, EnrichmentVariantKind> = {
  t: "skin-tone",
  g: "gender",
  p: "profession",
  f: "family",
  c: "couple",
  z: "zwj",
  l: "flag",
  k: "keycap",
  s: "sequence",
  r: "related",
};

const RELATED_REASON_TO_KEY: Record<EnrichmentRelatedLink["reason"], keyof CompactRelatedGrouped> = {
  subcategory: "b",
  semantic: "m",
  category: "c",
  variant: "v",
};

const RELATED_KEY_TO_REASON: Record<keyof CompactRelatedGrouped, EnrichmentRelatedLink["reason"]> = {
  b: "subcategory",
  m: "semantic",
  c: "category",
  v: "variant",
};

export function encodeVariantKind(kind: EnrichmentVariantKind): CompactVariantKindCode {
  return VARIANT_KIND_TO_CODE[kind];
}

export function decodeVariantKind(code: CompactVariantKindCode): EnrichmentVariantKind {
  return VARIANT_CODE_TO_KIND[code];
}

export function compactCanonicalId(canonicalId: string): string {
  return canonicalId.startsWith("unicode:") ? canonicalId.slice("unicode:".length) : canonicalId;
}

export function expandCanonicalId(compactId: string): string {
  if (compactId.includes(":")) {
    return compactId;
  }
  return `unicode:${compactId}`;
}

export function groupRelatedLinks(links: readonly EnrichmentRelatedLink[]): CompactRelatedGrouped | undefined {
  if (!links.length) {
    return undefined;
  }

  const grouped: Record<keyof CompactRelatedGrouped, string[]> = {
    b: [],
    m: [],
    c: [],
    v: [],
  };

  for (const link of links) {
    const key = RELATED_REASON_TO_KEY[link.reason];
    grouped[key].push(link.slug);
  }

  const result: {
    b?: readonly string[];
    m?: readonly string[];
    c?: readonly string[];
    v?: readonly string[];
  } = {};

  if (grouped.b.length) result.b = grouped.b;
  if (grouped.m.length) result.m = grouped.m;
  if (grouped.c.length) result.c = grouped.c;
  if (grouped.v.length) result.v = grouped.v;

  return Object.keys(result).length > 0 ? result : undefined;
}

export function expandRelatedGrouped(grouped: CompactRelatedGrouped): EnrichmentRelatedLink[] {
  const links: EnrichmentRelatedLink[] = [];

  for (const key of ["b", "m", "c", "v"] as const) {
    const slugs = grouped[key];
    if (!slugs?.length) continue;
    const reason = RELATED_KEY_TO_REASON[key];
    for (const slug of slugs) {
      links.push({ slug, reason });
    }
  }

  return links;
}