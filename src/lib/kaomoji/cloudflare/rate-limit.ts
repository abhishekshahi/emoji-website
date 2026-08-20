const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkKaomojiSearchRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now >= entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (entry.count >= MAX_REQUESTS) return false;
  entry.count += 1;
  return true;
}

export function kaomojiRateLimitKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for");
  return "kaomoji-search:" + (forwarded?.split(",")[0]?.trim() ?? "anonymous");
}

export function resetKaomojiSearchRateLimits(): void {
  buckets.clear();
}

export const KAOMOJI_SEARCH_RATE_LIMIT = MAX_REQUESTS;
export const KAOMOJI_SEARCH_RATE_WINDOW_MS = WINDOW_MS;
