import productionToMasterMap from "@/data/master/integration/production-to-master-map.json";
import type { ProductionToMasterMap } from "@/lib/master/integration/types";
import { getIdentitySlugMap, type IdentitySlugMap } from "./identity-slug-map";

interface EdgeContextMaps {
  readonly slugByCanonicalId: Map<string, string>;
  readonly canonicalBySlug: Map<string, string>;
  readonly canonicalByHex: Map<string, string>;
  readonly identitySlugMap: IdentitySlugMap;
}

let edgeContextMaps: EdgeContextMaps | null = null;

function getEdgeContextMaps(): EdgeContextMaps {
  if (edgeContextMaps) {
    return edgeContextMaps;
  }

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

  edgeContextMaps = Object.freeze({
    slugByCanonicalId,
    canonicalBySlug,
    canonicalByHex,
    identitySlugMap,
  });
  return edgeContextMaps;
}

export function resetEdgeContextMaps(): void {
  edgeContextMaps = null;
}

export function resolvePublicCanonicalIdParam(input: string): string {
  const { canonicalBySlug, canonicalByHex } = getEdgeContextMaps();
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
  return getEdgeContextMaps().canonicalByHex.get(hexcode.toUpperCase()) ?? null;
}

export function getProductionSlugForCanonicalEdge(canonicalId: string): string | null {
  return getEdgeContextMaps().slugByCanonicalId.get(canonicalId) ?? null;
}

export function listProductionCanonicalIds(): readonly string[] {
  return getEdgeContextMaps().identitySlugMap.entries.map((entry) => entry.canonicalId);
}

export function listAllIdentitySlugs(): readonly string[] {
  return getEdgeContextMaps().identitySlugMap.entries.map((entry) => entry.slug);
}
