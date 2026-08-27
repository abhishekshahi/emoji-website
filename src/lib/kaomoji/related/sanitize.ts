const MAX_RELATED_LIMIT = 24;
const KAOMOJI_ID_RE = /^kao_[a-f0-9]{16}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,120}$/i;

export interface SanitizedRelatedRequest {
  readonly canonicalId: string | null;
  readonly slug: string | null;
  readonly similarLimit: number;
  readonly relatedLimit: number;
  readonly rejected: boolean;
  readonly reason: string | null;
}

export function sanitizeRelatedRequest(
  canonicalIdRaw: string | null | undefined,
  slugRaw: string | null | undefined,
  similarLimitRaw: string | number | null | undefined,
  relatedLimitRaw: string | number | null | undefined,
): SanitizedRelatedRequest {
  const canonicalId = (canonicalIdRaw ?? "").trim();
  const slug = (slugRaw ?? "").trim();

  if (canonicalId && !KAOMOJI_ID_RE.test(canonicalId)) {
    return {
      canonicalId: null,
      slug: null,
      similarLimit: 0,
      relatedLimit: 0,
      rejected: true,
      reason: "invalid_canonical_id",
    };
  }

  if (slug && !SLUG_RE.test(slug)) {
    return {
      canonicalId: null,
      slug: null,
      similarLimit: 0,
      relatedLimit: 0,
      rejected: true,
      reason: "invalid_slug",
    };
  }

  if (!canonicalId && !slug) {
    return {
      canonicalId: null,
      slug: null,
      similarLimit: 0,
      relatedLimit: 0,
      rejected: true,
      reason: "missing_identifier",
    };
  }

  const similarLimit = Math.min(MAX_RELATED_LIMIT, Math.max(0, Number(similarLimitRaw) || 8));
  const relatedLimit = Math.min(MAX_RELATED_LIMIT, Math.max(0, Number(relatedLimitRaw) || 12));

  return {
    canonicalId: canonicalId || null,
    slug: slug || null,
    similarLimit,
    relatedLimit,
    rejected: false,
    reason: null,
  };
}

export { MAX_RELATED_LIMIT, KAOMOJI_ID_RE, SLUG_RE };
