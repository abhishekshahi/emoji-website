import { NextResponse } from "next/server";
import { kaomojiSearchCacheHeaders } from "@/lib/kaomoji/cloudflare/cache";
import { searchKaomojiRuntime } from "@/lib/kaomoji/cloudflare/search-loader";
import {
  checkKaomojiSearchRateLimit,
  kaomojiRateLimitKeyFromRequest,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { resolveMultilingualSearchQuery } from "@/lib/kaomoji/localization/multilingual-search";
import { parseKaomojiSearchLocale } from "@/lib/kaomoji/localization/search-terms";
import { parseKaomojiSearchFilters } from "@/lib/kaomoji/ui/filters";
import { sanitizeSearchRequest } from "@/lib/kaomoji/processing/phase14/security";

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: kaomojiSearchCacheHeaders() });
}

export async function GET(request: Request): Promise<NextResponse> {
  const rateKey = kaomojiRateLimitKeyFromRequest(request);
  if (!checkKaomojiSearchRateLimit(rateKey)) {
    return jsonResponse({ error: "rate_limit_exceeded", results: [] }, 429);
  }

  const url = new URL(request.url);
  const filters = parseKaomojiSearchFilters(url.searchParams);
  const sanitized = sanitizeSearchRequest(
    url.searchParams.get("q") ?? "",
    url.searchParams.get("limit"),
    url.searchParams.get("offset"),
  );

  if (sanitized.rejected) {
    return jsonResponse({ results: [], rejected: true, reason: sanitized.reason });
  }

  if (!sanitized.query.trim()) {
    return jsonResponse({ results: [] });
  }

  try {
    const localeHint = parseKaomojiSearchLocale(filters.locale ?? url.searchParams.get("lang"));
    const resolution = resolveMultilingualSearchQuery(sanitized.query, localeHint);
    const hits = await searchKaomojiRuntime(resolution.resolvedQuery, sanitized.limit, sanitized.offset);

    return jsonResponse({
      results: hits.map((hit) => ({
        canonical_id: hit.record.canonical_id,
        slug: hit.record.slug,
        content: hit.record.content,
        name: hit.record.name,
        accessible_name: hit.record.name ?? hit.record.content.slice(0, 48),
        score: hit.score,
        match_reason: hit.match_reason,
        meaning: hit.record.meaning,
      })),
      query: sanitized.query,
      resolved_query: resolution.resolvedQuery,
      detected_locale: resolution.detectedLocale,
      locale_hint: resolution.localeHint,
      language_fallback: resolution.usedFallback,
      mapped_terms: resolution.mappedTerms,
    });
  } catch {
    return jsonResponse({ results: [], query: sanitized.query });
  }
}

export async function POST(): Promise<NextResponse> {
  return jsonResponse({ error: "method_not_allowed", results: [] }, 405);
}
