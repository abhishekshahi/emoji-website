const MAX_LIMIT = 48;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,120}$/i;

export interface SanitizedRankingRequest {
  readonly limit: number;
  readonly rejected: boolean;
  readonly reason: string | null;
}

export function sanitizeRankingLimit(raw: string | number | null | undefined, defaultLimit = 24): number {
  if (raw === null || raw === undefined || raw === "") {
    return Math.min(MAX_LIMIT, defaultLimit);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return Math.min(MAX_LIMIT, defaultLimit);
  return Math.min(MAX_LIMIT, Math.max(1, Math.floor(n)));
}

export function sanitizeRankingRequest(limitRaw: string | number | null | undefined): SanitizedRankingRequest {
  return { limit: sanitizeRankingLimit(limitRaw), rejected: false, reason: null };
}

export function sanitizeCategorySlug(raw: string | null | undefined): string | null {
  const slug = (raw ?? "").trim().toLowerCase();
  if (!slug || !SLUG_RE.test(slug)) return null;
  return slug;
}

export { MAX_LIMIT as KAOMOJI_RANKING_MAX_LIMIT };
