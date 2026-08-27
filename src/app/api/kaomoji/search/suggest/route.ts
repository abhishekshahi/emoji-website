import { NextResponse } from "next/server";
import { kaomojiSearchCacheHeaders } from "@/lib/kaomoji/cloudflare/cache";
import {
  checkKaomojiSearchRateLimit,
  kaomojiRateLimitKeyFromRequest,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { getMultilingualSearchSuggestions } from "@/lib/kaomoji/localization/multilingual-search";
import { parseKaomojiSearchLocale } from "@/lib/kaomoji/localization/search-terms";
import { parseKaomojiSearchFilters } from "@/lib/kaomoji/ui/filters";
import { sanitizeSearchRequest } from "@/lib/kaomoji/processing/phase14/security";

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: kaomojiSearchCacheHeaders() });
}

export async function GET(request: Request): Promise<NextResponse> {
  const rateKey = kaomojiRateLimitKeyFromRequest(request);
  if (!checkKaomojiSearchRateLimit(rateKey)) {
    return jsonResponse({ error: "rate_limit_exceeded", suggestions: [] }, 429);
  }

  const url = new URL(request.url);
  const filters = parseKaomojiSearchFilters(url.searchParams);
  const sanitized = sanitizeSearchRequest(url.searchParams.get("q") ?? "", url.searchParams.get("limit") ?? 8, 0);
  const localeHint = parseKaomojiSearchLocale(filters.locale ?? url.searchParams.get("lang"));
  const limit = Math.min(12, Math.max(1, sanitized.limit));

  if (sanitized.rejected) {
    return jsonResponse({ suggestions: [], rejected: true, reason: sanitized.reason });
  }

  try {
    const suggestions = getMultilingualSearchSuggestions(sanitized.query, localeHint, limit);
    return jsonResponse({
      suggestions: suggestions.map((s) => ({
        term: s.term,
        locale: s.locale,
        label: s.label,
        english_tokens: s.englishTokens,
      })),
      locale_hint: localeHint,
    });
  } catch {
    return jsonResponse({ suggestions: [] });
  }
}

export async function POST(): Promise<NextResponse> {
  return jsonResponse({ error: "method_not_allowed", suggestions: [] }, 405);
}
