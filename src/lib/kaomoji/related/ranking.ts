import { relatedReasonLabel } from "./reasons";
import type {
  PartitionRelatedOptions,
  RelatedKaomojiBundle,
  RelatedKaomojiCandidate,
  RelatedKaomojiHit,
} from "./types";

export const SIMILAR_RELATIONSHIP_TYPES = new Set<string>(["variant", "similar_expression"]);

export const DEFAULT_SIMILAR_LIMIT = 8;
export const DEFAULT_RELATED_LIMIT = 12;
export const D1_RELATIONSHIP_FETCH_LIMIT = 48;
export const D1_CATEGORY_FALLBACK_LIMIT = 24;

function normalizeContentKey(content: string, normalized?: string): string {
  const n = normalized?.trim();
  if (n) return n;
  return content.trim();
}

function effectiveScore(candidate: RelatedKaomojiCandidate): number {
  let score = candidate.score;
  if (candidate.confidence === "high") score += 5;
  else if (candidate.confidence === "medium") score += 2;
  const quality = candidate.quality_score ?? 0;
  score += Math.min(10, quality / 10);
  return score;
}

function toHit(candidate: RelatedKaomojiCandidate): RelatedKaomojiHit {
  return {
    canonical_id: candidate.canonical_id,
    slug: candidate.slug,
    content: candidate.content,
    name: candidate.editorial_name ?? null,
    accessible_name: candidate.accessible_name,
    reason: relatedReasonLabel(candidate.relationship_type, candidate.category_label),
    relationship_type: candidate.relationship_type,
  };
}

export function partitionRelatedCandidates(
  candidates: readonly RelatedKaomojiCandidate[],
  options: PartitionRelatedOptions,
): RelatedKaomojiBundle {
  const similarLimit = options.similarLimit ?? DEFAULT_SIMILAR_LIMIT;
  const relatedLimit = options.relatedLimit ?? DEFAULT_RELATED_LIMIT;
  const sourceId = options.sourceCanonicalId;

  const seenIds = new Set<string>([sourceId]);
  const seenSlugs = new Set<string>();
  const seenContent = new Set<string>();

  const ranked = [...candidates]
    .filter((c) => c.canonical_id !== sourceId)
    .sort((a, b) => effectiveScore(b) - effectiveScore(a) || a.canonical_id.localeCompare(b.canonical_id));

  const similar: RelatedKaomojiHit[] = [];
  const related: RelatedKaomojiHit[] = [];

  for (const candidate of ranked) {
    const contentKey = normalizeContentKey(candidate.content, candidate.normalized_content);
    if (seenIds.has(candidate.canonical_id)) continue;
    if (seenSlugs.has(candidate.slug)) continue;
    if (seenContent.has(contentKey)) continue;

    seenIds.add(candidate.canonical_id);
    seenSlugs.add(candidate.slug);
    seenContent.add(contentKey);

    const hit = toHit(candidate);
    if (SIMILAR_RELATIONSHIP_TYPES.has(candidate.relationship_type)) {
      if (similar.length < similarLimit) similar.push(hit);
      else if (related.length < relatedLimit) related.push(hit);
    } else if (related.length < relatedLimit) {
      related.push(hit);
    }

    if (similar.length >= similarLimit && related.length >= relatedLimit) break;
  }

  return { similar, related };
}

export function mergeRelatedBundles(
  primary: RelatedKaomojiBundle,
  fallbackCandidates: readonly RelatedKaomojiCandidate[],
  options: PartitionRelatedOptions,
): RelatedKaomojiBundle {
  const merged = partitionRelatedCandidates([...fallbackCandidates], options);

  const seenSimilar = new Set(primary.similar.map((h) => h.canonical_id));
  const seenRelated = new Set(primary.related.map((h) => h.canonical_id));
  const similar = [...primary.similar];
  const related = [...primary.related];

  for (const hit of merged.similar) {
    if (similar.length >= (options.similarLimit ?? DEFAULT_SIMILAR_LIMIT)) break;
    if (seenSimilar.has(hit.canonical_id) || seenRelated.has(hit.canonical_id)) continue;
    seenSimilar.add(hit.canonical_id);
    similar.push(hit);
  }

  for (const hit of merged.related) {
    if (related.length >= (options.relatedLimit ?? DEFAULT_RELATED_LIMIT)) break;
    if (seenSimilar.has(hit.canonical_id) || seenRelated.has(hit.canonical_id)) continue;
    seenRelated.add(hit.canonical_id);
    related.push(hit);
  }

  return { similar, related };
}
