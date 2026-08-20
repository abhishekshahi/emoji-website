import { listPublishedCombinations } from "../combinations/registry";

const COMBO_QUERY_PATTERNS = [
  /^(.+) emoji combination$/i,
  /^(.+) emoji combo$/i,
  /^(.+) emoji combinations$/i,
  /^emoji combination for (.+)$/i,
  /^(.+) combo emoji$/i,
];

const COMBO_INTENT_MAP: Record<string, readonly string[]> = {
  love: ["love-sparkle", "love-heart"],
  birthday: ["party-celebration", "party-cake"],
  party: ["party-celebration", "party-cake"],
  celebration: ["party-celebration", "party-cake"],
  congratulations: ["party-celebration", "fire-hundred"],
  laugh: ["laugh-fire", "skull-laugh", "laugh-cry"],
  funny: ["laugh-fire", "skull-laugh", "laugh-cry"],
  fire: ["laugh-fire", "fire-hundred"],
  romantic: ["love-sparkle", "love-heart"],
  romance: ["love-sparkle", "love-heart"],
  cute: ["love-sparkle"],
  friendship: ["pray-heart"],
  sad: ["laugh-cry"],
  gaming: ["skull-laugh", "fire-hundred"],
  instagram: ["love-sparkle", "fire-hundred"],
  work: ["pray-heart"],
};

function extractTerm(query: string): string | null {
  for (const pattern of COMBO_QUERY_PATTERNS) {
    const match = query.match(pattern);
    if (match?.[1]) return match[1].trim().toLowerCase();
  }
  return null;
}

export function isCombinationSearchQuery(query: string): boolean {
  return COMBO_QUERY_PATTERNS.some((p) => p.test(query.trim()));
}

export function searchCombinationsByIntent(query: string): readonly string[] {
  const term = extractTerm(query) ?? query.trim().toLowerCase();
  const slugs = COMBO_INTENT_MAP[term];
  if (slugs) return slugs;

  const all = listPublishedCombinations();
  return all
    .filter(
      (c) =>
        c.title.toLowerCase().includes(term) ||
        c.meaning.toLowerCase().includes(term) ||
        (c.contexts ?? []).some((ctx) => ctx.toLowerCase().includes(term)),
    )
    .map((c) => c.slug);
}
