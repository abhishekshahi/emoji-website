import { NextResponse } from "next/server";
import { kaomojiSearchCacheHeaders } from "@/lib/kaomoji/cloudflare/cache";
import { resolveKaomojiD1Binding } from "@/lib/kaomoji/cloudflare/d1-binding";
import { D1_SEARCH_BY_CATEGORY_FAST, D1_SEARCH_BY_KEYWORD_FAST } from "@/lib/kaomoji/cloudflare/d1-queries";
import {
  checkKaomojiSearchRateLimit,
  kaomojiRateLimitKeyFromRequest,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { sanitizeSearchRequest } from "@/lib/kaomoji/processing/phase14/security";

interface SearchRow {
  canonical_id: string;
  slug: string;
  content: string;
  editorial_name: string | null;
  accessible_name: string;
  quality_score: number;
}

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: kaomojiSearchCacheHeaders() });
}

function primaryToken(query: string): string {
  const normalized = query.normalize("NFC").trim().toLowerCase();
  if (normalized === "anime") return "japanese";
  const token = normalized
    .replace(/[^\p{L}\p{N}\s+-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .find((t) => t.length >= 2);
  return token ?? normalized;
}

export async function GET(request: Request): Promise<NextResponse> {
  const rateKey = kaomojiRateLimitKeyFromRequest(request);
  if (!checkKaomojiSearchRateLimit(rateKey)) {
    return jsonResponse({ error: "rate_limit_exceeded", results: [] }, 429);
  }

  const url = new URL(request.url);
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
    const db = await resolveKaomojiD1Binding();
    if (!db) return jsonResponse({ results: [] });

    const token = primaryToken(sanitized.query);
    const limit = Math.min(sanitized.limit, 10);
    const keyword = await db.prepare(D1_SEARCH_BY_KEYWORD_FAST).bind(token, limit).all<SearchRow>();
    let rows = keyword.results ?? [];
    if (rows.length === 0) {
      const category = await db.prepare(D1_SEARCH_BY_CATEGORY_FAST).bind(token, limit).all<SearchRow>();
      rows = category.results ?? [];
    }

    return jsonResponse({
      results: rows.map((row) => ({
        canonical_id: row.canonical_id,
        slug: row.slug,
        content: row.content,
        name: row.editorial_name,
        accessible_name: row.accessible_name || "kaomoji expression",
        score: row.quality_score,
      })),
    });
  } catch {
    return jsonResponse({ results: [] });
  }
}

export async function POST(): Promise<NextResponse> {
  return jsonResponse({ error: "method_not_allowed", results: [] }, 405);
}
