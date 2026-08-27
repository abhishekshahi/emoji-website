import "server-only";
import {
  D1_GET_KAOMOJI_BY_CANONICAL_ID,
  D1_GET_KAOMOJI_BY_SLUG,
  D1_GET_RELATED_KAOMOJI,
  D1_GET_SAME_CATEGORY_PEERS,
} from "./d1-queries";
import { resolveKaomojiD1Binding } from "./d1-binding";
import {
  D1_CATEGORY_FALLBACK_LIMIT,
  D1_RELATIONSHIP_FETCH_LIMIT,
  mergeRelatedBundles,
  partitionRelatedCandidates,
} from "../related/ranking";
import type { RelatedKaomojiBundle, RelatedKaomojiCandidate } from "../related/types";

interface D1RelatedRow {
  relationship_type: string;
  confidence: string;
  score: number;
  canonical_id: string;
  slug: string;
  content: string;
  normalized_content: string;
  accessible_name: string;
  editorial_name: string | null;
  quality_score: number;
  category_label: string | null;
}

interface D1PeerRow {
  canonical_id: string;
  slug: string;
  content: string;
  normalized_content: string;
  accessible_name: string;
  editorial_name: string | null;
  quality_score: number;
  category_label: string | null;
}

function rowToCandidate(row: D1RelatedRow): RelatedKaomojiCandidate {
  return {
    canonical_id: row.canonical_id,
    slug: row.slug,
    content: row.content,
    normalized_content: row.normalized_content,
    accessible_name: row.accessible_name,
    editorial_name: row.editorial_name,
    quality_score: row.quality_score,
    relationship_type: row.relationship_type,
    confidence: row.confidence,
    score: row.score,
    category_label: row.category_label,
  };
}

function peerToCandidate(row: D1PeerRow): RelatedKaomojiCandidate {
  return {
    canonical_id: row.canonical_id,
    slug: row.slug,
    content: row.content,
    normalized_content: row.normalized_content,
    accessible_name: row.accessible_name,
    editorial_name: row.editorial_name,
    quality_score: row.quality_score,
    relationship_type: "same_category",
    confidence: "medium",
    score: 65 + Math.min(20, row.quality_score / 5),
    category_label: row.category_label,
  };
}

export async function resolveCanonicalIdFromD1(
  canonicalId: string | null,
  slug: string | null,
): Promise<string | null> {
  const db = await resolveKaomojiD1Binding();
  if (!db) return canonicalId;

  if (canonicalId) {
    const byId = await db.prepare(D1_GET_KAOMOJI_BY_CANONICAL_ID).bind(canonicalId).all<{ canonical_id: string }>();
    return byId.results?.[0]?.canonical_id ?? null;
  }

  if (slug) {
    const bySlug = await db.prepare(D1_GET_KAOMOJI_BY_SLUG).bind(slug).all<{ canonical_id: string }>();
    return bySlug.results?.[0]?.canonical_id ?? null;
  }

  return null;
}

export async function getRelatedKaomojiBundleFromD1(
  canonicalId: string,
  options?: { similarLimit?: number; relatedLimit?: number },
): Promise<RelatedKaomojiBundle> {
  const db = await resolveKaomojiD1Binding();
  if (!db) return { similar: [], related: [] };

  const similarLimit = options?.similarLimit ?? 8;
  const relatedLimit = options?.relatedLimit ?? 12;

  const relRows = await db
    .prepare(D1_GET_RELATED_KAOMOJI)
    .bind(canonicalId, D1_RELATIONSHIP_FETCH_LIMIT)
    .all<D1RelatedRow>();

  const candidates = (relRows.results ?? []).map(rowToCandidate);
  let bundle = partitionRelatedCandidates(candidates, {
    sourceCanonicalId: canonicalId,
    similarLimit,
    relatedLimit,
  });

  const minResults = Math.min(4, similarLimit + relatedLimit);
  if (bundle.similar.length + bundle.related.length < minResults) {
    const peerRows = await db
      .prepare(D1_GET_SAME_CATEGORY_PEERS)
      .bind(canonicalId, D1_CATEGORY_FALLBACK_LIMIT)
      .all<D1PeerRow>();
    const fallback = (peerRows.results ?? []).map(peerToCandidate);
    bundle = mergeRelatedBundles(bundle, fallback, {
      sourceCanonicalId: canonicalId,
      similarLimit,
      relatedLimit,
    });
  }

  return bundle;
}

/** Flat list for legacy callers — similar first, then related. */
export async function getRelatedKaomojiListFromD1(
  canonicalId: string,
  limit = 12,
): Promise<RelatedKaomojiBundle["similar"][number][]> {
  const similarLimit = Math.min(8, limit);
  const relatedLimit = Math.max(0, limit - similarLimit);
  const bundle = await getRelatedKaomojiBundleFromD1(canonicalId, { similarLimit, relatedLimit });
  return [...bundle.similar, ...bundle.related].slice(0, limit);
}
