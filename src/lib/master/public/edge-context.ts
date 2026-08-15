import productionToMasterMap from "@/data/master/integration/production-to-master-map.json";
import type { ProductionToMasterMap } from "@/lib/master/integration/types";
import { getIdentitySlugMap } from "./identity-slug-map";

const map = productionToMasterMap as ProductionToMasterMap;
const identitySlugMap = getIdentitySlugMap();

const slugByCanonicalId = new Map<string, string>();
const canonicalBySlug = new Map<string, string>();
const canonicalByHex = new Map<string, string>();

for (const entry of [...map.standardRecords.entries, ...map.extrasRecords.entries]) {
  canonicalByHex.set(entry.productionHexcode.toUpperCase(), entry.canonicalId);
}

for (const entry of identitySlugMap.entries) {
  slugByCanonicalId.set(entry.canonicalId, entry.slug);
  canonicalBySlug.set(entry.slug, entry.canonicalId);
}

export function resolvePublicCanonicalIdParam(input: string): string {
  const decoded = decodeURIComponent(input.trim());
  if (decoded.includes(":")) {
    return decoded;
  }

  const slugMatch = canonicalBySlug.get(decoded);
  if (slugMatch) {
    return slugMatch;
  }

  const hex = decoded.replace(/^U\+/i, "").replace(/-/g, "").toUpperCase();
  if (/^[0-9A-F]+$/.test(hex)) {
    return canonicalByHex.get(hex) ?? `unicode:${hex}`;
  }

  return decoded;
}

export function resolveCanonicalIdFromHexcode(hexcode: string): string | null {
  return canonicalByHex.get(hexcode.toUpperCase()) ?? null;
}

export function getProductionSlugForCanonicalEdge(canonicalId: string): string | null {
  return slugByCanonicalId.get(canonicalId) ?? null;
}

export function listProductionCanonicalIds(): readonly string[] {
  return identitySlugMap.entries.map((entry) => entry.canonicalId);
}

export function listAllIdentitySlugs(): readonly string[] {
  return identitySlugMap.entries.map((entry) => entry.slug);
}