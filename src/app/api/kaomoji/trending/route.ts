import { NextResponse } from "next/server";
import { kaomojiSearchCacheHeaders } from "@/lib/kaomoji/cloudflare/cache";
import {
  getKaomojiRisingRanking,
  getKaomojiTrendingRanking,
} from "@/lib/kaomoji/cloudflare/d1-rankings";
import {
  checkKaomojiSearchRateLimit,
  kaomojiRateLimitKeyFromRequest,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { sanitizeRankingRequest } from "@/lib/kaomoji/rankings/sanitize";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: kaomojiSearchCacheHeaders() });
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!checkKaomojiSearchRateLimit(kaomojiRateLimitKeyFromRequest(request))) {
    return json({ error: "rate_limit_exceeded", items: [] }, 429);
  }

  const url = new URL(request.url);
  const sanitized = sanitizeRankingRequest(url.searchParams.get("limit"));
  const kind = url.searchParams.get("kind") === "rising" ? "rising" : "trending";

  try {
    const result =
      kind === "rising"
        ? await getKaomojiRisingRanking(sanitized.limit)
        : await getKaomojiTrendingRanking(sanitized.limit);
    return json(result);
  } catch {
    return json({ status: "INSUFFICIENT_DATA", items: [], label: "Trending Kaomoji" });
  }
}
