import type { KaomojiRelationship } from "../phase9/types";

export function auditRelationships(
  rels: readonly KaomojiRelationship[],
  publicIds: ReadonlySet<string>,
): { count: number; broken_targets: number; self_links: number; duplicate_edges: number } {
  const seen = new Set<string>();
  let broken = 0, selfLinks = 0, dupes = 0;
  for (const r of rels) {
    const key = `${r.from_canonical_id}:${r.to_canonical_id}:${r.relationship_type}`;
    if (seen.has(key)) dupes++;
    seen.add(key);
    if (r.from_canonical_id === r.to_canonical_id) selfLinks++;
    if (!publicIds.has(r.from_canonical_id) || !publicIds.has(r.to_canonical_id)) broken++;
  }
  return { count: rels.length, broken_targets: broken, self_links: selfLinks, duplicate_edges: dupes };
}
