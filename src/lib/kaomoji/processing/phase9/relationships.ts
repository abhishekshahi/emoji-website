import type { KaomojiEditorialRecord, KaomojiRelationship } from "./types";

const OPPOSITE: Record<string, string> = {
  happy: "sad",
  sad: "happy",
  angry: "calm",
  love: "angry",
  crying: "laughing",
  laughing: "crying",
};

export function buildRelationships(records: readonly KaomojiEditorialRecord[]): KaomojiRelationship[] {
  const byCategory = new Map<string, KaomojiEditorialRecord[]>();
  const byVariant = new Map<string, KaomojiEditorialRecord[]>();
  const byId = new Map(records.map((r) => [r.canonical_id, r]));
  const rels: KaomojiRelationship[] = [];
  const seen = new Set<string>();

  for (const r of records) {
    if (!r.is_public) continue;
    const cat = r.emojiquick_categories[0]?.slug;
    if (cat) {
      const list = byCategory.get(cat) ?? [];
      list.push(r);
      byCategory.set(cat, list);
    }
    if (r.variant_group_id) {
      const list = byVariant.get(r.variant_group_id) ?? [];
      list.push(r);
      byVariant.set(r.variant_group_id, list);
    }
  }

  function add(from: string, to: string, type: KaomojiRelationship["relationship_type"], confidence: "high" | "medium" | "low", score: number) {
    if (from === to) return;
    const key = `${from}:${to}:${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    rels.push({ from_canonical_id: from, to_canonical_id: to, relationship_type: type, confidence, score });
  }

  for (const [cat, members] of byCategory) {
    members.sort((a, b) => b.quality_score - a.quality_score || a.canonical_id.localeCompare(b.canonical_id));
    byCategory.set(cat, members);
  }

  for (const [vgId, members] of byVariant) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length && j < i + 6; j++) {
        add(members[i]!.canonical_id, members[j]!.canonical_id, "variant", "high", 90);
      }
    }
  }

  for (const r of records) {
    if (!r.is_public) continue;
    const cat = r.emojiquick_categories[0]?.slug;
    if (!cat) continue;
    const sorted = byCategory.get(cat) ?? [];
    const peers: KaomojiEditorialRecord[] = [];
    for (const p of sorted) {
      if (p.canonical_id === r.canonical_id) continue;
      peers.push(p);
      if (peers.length >= 6) break;
    }
    for (const p of peers) {
      add(r.canonical_id, p.canonical_id, "same_category", "medium", 70 + Math.min(20, p.quality_score / 5));
    }
    const opposite = OPPOSITE[cat];
    if (opposite) {
      const opp = (byCategory.get(opposite) ?? [])[0];
      if (opp) add(r.canonical_id, opp.canonical_id, "opposite_emotion", "low", 50);
    }
    if (r.duplicate_group_id) {
      for (const p of peers.slice(0, 2)) add(r.canonical_id, p.canonical_id, "alternative", "medium", 60);
    }
  }

  return rels.sort((a, b) => a.from_canonical_id.localeCompare(b.from_canonical_id));
}

export function relatedForRecord(rels: readonly KaomojiRelationship[], canonicalId: string, limit = 8): KaomojiRelationship[] {
  return rels.filter((r) => r.from_canonical_id === canonicalId).slice(0, limit);
}
