import type { KaomojiEditorialRecord, KaomojiRelationship } from "../processing/phase9/types";
import type { RelatedKaomojiBundle } from "./types";
import {
  D1_CATEGORY_FALLBACK_LIMIT,
  partitionRelatedCandidates,
} from "./ranking";
import type { RelatedKaomojiCandidate } from "./types";

function recordToCandidate(
  record: KaomojiEditorialRecord,
  rel: KaomojiRelationship,
): RelatedKaomojiCandidate {
  const primary = record.emojiquick_categories.find((c) => c) ?? record.emojiquick_categories[0];
  return {
    canonical_id: record.canonical_id,
    slug: record.slug,
    content: record.canonical_content,
    normalized_content: record.normalized_content,
    accessible_name: record.accessible_name,
    editorial_name: record.editorial_name,
    quality_score: record.quality_score,
    relationship_type: rel.relationship_type,
    confidence: rel.confidence,
    score: rel.score,
    category_label: primary?.label ?? null,
  };
}

export function resolveEditorialRelatedBundle(
  source: KaomojiEditorialRecord,
  relationships: readonly KaomojiRelationship[],
  recordsById: ReadonlyMap<string, KaomojiEditorialRecord>,
  options?: { similarLimit?: number; relatedLimit?: number },
): RelatedKaomojiBundle {
  const rels = relationships.filter((r) => r.from_canonical_id === source.canonical_id);
  const candidates: RelatedKaomojiCandidate[] = [];

  for (const rel of rels) {
    const target = recordsById.get(rel.to_canonical_id);
    if (!target?.is_public) continue;
    candidates.push(recordToCandidate(target, rel));
  }

  let bundle = partitionRelatedCandidates(candidates, {
    sourceCanonicalId: source.canonical_id,
    similarLimit: options?.similarLimit,
    relatedLimit: options?.relatedLimit,
  });

  if (bundle.similar.length + bundle.related.length < 4) {
    const primarySlug = source.emojiquick_categories[0]?.slug;
    if (primarySlug) {
      const peers: RelatedKaomojiCandidate[] = [];
      for (const peer of recordsById.values()) {
        if (!peer.is_public || peer.canonical_id === source.canonical_id) continue;
        if (!peer.emojiquick_categories.some((c) => c.slug === primarySlug)) continue;
        peers.push({
          canonical_id: peer.canonical_id,
          slug: peer.slug,
          content: peer.canonical_content,
          normalized_content: peer.normalized_content,
          accessible_name: peer.accessible_name,
          editorial_name: peer.editorial_name,
          quality_score: peer.quality_score,
          relationship_type: "same_category",
          confidence: "medium",
          score: 65 + Math.min(20, peer.quality_score / 5),
          category_label: source.emojiquick_categories[0]?.label ?? null,
        });
        if (peers.length >= D1_CATEGORY_FALLBACK_LIMIT) break;
      }
      bundle = partitionRelatedCandidates([...candidates, ...peers], {
        sourceCanonicalId: source.canonical_id,
        similarLimit: options?.similarLimit,
        relatedLimit: options?.relatedLimit,
      });
    }
  }

  return bundle;
}
