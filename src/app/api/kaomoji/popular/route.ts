import { NextResponse } from "next/server";
import { kaomojiSearchCacheHeaders } from "@/lib/kaomoji/cloudflare/cache";
import {
  getKaomojiMostCopiedRanking,
  getKaomojiPopularRanking,
} from "@/lib/kaomoji/cloudflare/d1-rankings";
import {
  checkKaomojiSearchRateLimit,
  kaomojiRateLimitKeyFromRequest,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { sanitizeCategorySlug, sanitizeRankingRequest } from "@/lib/kaomoji/rankings/sanitize";
import type { KaomojiRankingWindow } from "@/lib/kaomoji/rankings/types";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: kaomojiSearchCacheHeaders() });
}

function parseWindow(raw: string | null): KaomojiRankingWindow {
  if (raw === "24h" || raw === "7d" || raw === "30d" || raw === "all") return raw;
  return "30d";
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!checkKaomojiSearchRateLimit(kaomojiRateLimitKeyFromRequest(request))) {
    return json({ error: "rate_limit_exceeded", items: [] }, 429);
  }

  const url = new URL(request.url);
  const sanitized = sanitizeRankingRequest(url.searchParams.get("limit"));
  const kind = url.searchParams.get("kind") === "most_copied" ? "most_copied" : "popular";
  const window = parseWindow(url.searchParams.get("window"));
  const category = sanitizeCategorySlug(url.searchParams.get("category"));

  if (category) {
    const { getKaomojiCategoryFeatured } = await import("@/lib/kaomoji/cloudflare/d1-rankings");
    const result = await getKaomojiCategoryFeatured(category, sanitized.limit);
    return json(result);
  }

  try {
    const result =
      kind === "most_copied"
        ? await getKaomojiMostCopiedRanking(window === "all" ? "30d" : window, sanitized.limit)
        : await getKaomojiPopularRanking(window, sanitized.limit);
    return json(result);
  } catch {
    return json({ status: "INSUFFICIENT_DATA", items: [], label: "Popular Kaomoji" });
  }
}
