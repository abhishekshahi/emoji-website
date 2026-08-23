const MAX_QUERY_LEN = 120;
const MAX_LIMIT = 48;
const MAX_OFFSET = 10000;

export interface SanitizedSearchRequest {
  readonly query: string;
  readonly limit: number;
  readonly offset: number;
  readonly rejected: boolean;
  readonly reason: string | null;
}

export function sanitizeSearchRequest(
  query: string,
  limitRaw: number | string | null | undefined,
  offsetRaw: number | string | null | undefined = 0,
): SanitizedSearchRequest {
  const q = (query ?? "").slice(0, MAX_QUERY_LEN);
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(q)) {
    return { query: "", limit: 0, offset: 0, rejected: true, reason: "control_chars" };
  }
  if (q.length > 500) {
    return { query: q.slice(0, MAX_QUERY_LEN), limit: 0, offset: 0, rejected: true, reason: "query_too_long" };
  }
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(limitRaw) || 24));
  const offset = Math.min(MAX_OFFSET, Math.max(0, Number(offsetRaw) || 0));
  return { query: q, limit, offset, rejected: false, reason: null };
}
