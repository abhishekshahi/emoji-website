import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import productionToMasterMap from "@/data/master/integration/production-to-master-map.json";
import type { ProductionToMasterMap } from "@/lib/master/integration/types";

const map = productionToMasterMap as ProductionToMasterMap;

const slugByCanonicalId = new Map<string, string>();
const canonicalByHex = new Map<string, string>();

for (const entry of [...map.standardRecords.entries, ...map.extrasRecords.entries]) {
  canonicalByHex.set(entry.productionHexcode.toUpperCase(), entry.canonicalId);
}

for (const emoji of [...emojis, ...extras] as Array<{ slug: string; hexcode: string }>) {
  const canonicalId = canonicalByHex.get(emoji.hexcode.toUpperCase());
  if (canonicalId) {
    slugByCanonicalId.set(canonicalId, emoji.slug);
  }
}

export function resolvePublicCanonicalIdParam(input: string): string {
  const decoded = decodeURIComponent(input.trim());
  if (decoded.includes(":")) {
    return decoded;
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
  return [...map.standardRecords.entries, ...map.extrasRecords.entries].map((entry) => entry.canonicalId);
}