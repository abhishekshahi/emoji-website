import slugMapData from "@/data/master/integration/identity-slug-map.json";
import { isUtilityCanonicalId } from "@/lib/master/integration/seo/policy";

export interface IdentitySlugEntry {
  readonly canonicalId: string;
  readonly slug: string;
  readonly canonicalName: string;
  readonly source: "preserved-production" | "master-seo" | "disambiguated";
  readonly disambiguated: boolean;
}

export interface IdentitySlugMap {
  readonly generatedAt: string;
  readonly phase: string;
  readonly totalIdentities: number;
  readonly preservedProductionSlugs: number;
  readonly collisionsResolved: number;
  readonly entries: readonly IdentitySlugEntry[];
}

const map = slugMapData as IdentitySlugMap;
const slugByCanonicalId = new Map<string, string>();
const canonicalIdBySlug = new Map<string, string>();
const entryByCanonicalId = new Map<string, IdentitySlugEntry>();

for (const entry of map.entries) {
  slugByCanonicalId.set(entry.canonicalId, entry.slug);
  canonicalIdBySlug.set(entry.slug, entry.canonicalId);
  entryByCanonicalId.set(entry.canonicalId, entry);
}

export function getIdentitySlugMap(): IdentitySlugMap { return map; }
export function getAllIdentitySlugs(): readonly string[] { return map.entries.map((e) => e.slug); }

/** Indexable emoji pages: all identities except utility/support artwork (noto.png placeholders). */
export function getIndexableEmojiPageSlugs(): readonly string[] {
  return map.entries.filter((e) => !isUtilityCanonicalId(e.canonicalId)).map((e) => e.slug);
}
export function getSlugForCanonicalId(canonicalId: string): string | null { return slugByCanonicalId.get(canonicalId) ?? null; }
export function getCanonicalIdForSlug(slug: string): string | null { return canonicalIdBySlug.get(slug) ?? null; }
export function getIdentitySlugEntry(canonicalId: string): IdentitySlugEntry | null { return entryByCanonicalId.get(canonicalId) ?? null; }
export const IDENTITY_SLUG_COUNT = map.totalIdentities;