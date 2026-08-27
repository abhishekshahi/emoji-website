import { NextResponse } from "next/server";
import { kaomojiSearchCacheHeaders } from "@/lib/kaomoji/cloudflare/cache";
import {
  getRelatedKaomojiBundleFromD1,
  resolveCanonicalIdFromD1,
} from "@/lib/kaomoji/cloudflare/d1-related";
import {
  checkKaomojiSearchRateLimit,
  kaomojiRateLimitKeyFromRequest,
} from "@/lib/kaomoji/cloudflare/rate-limit";
import { sanitizeRelatedRequest } from "@/lib/kaomoji/related/sanitize";

function jsonResponse(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: kaomojiSearchCacheHeaders() });
}

export async function GET(request: Request): Promise<NextResponse> {
  const rateKey = kaomojiRateLimitKeyFromRequest(request);
  if (!checkKaomojiSearchRateLimit(rateKey)) {
    return jsonResponse({ error: "rate_limit_exceeded", similar: [], related: [] }, 429);
  }

  const url = new URL(request.url);
  const sanitized = sanitizeRelatedRequest(
    url.searchParams.get("canonical_id"),
    url.searchParams.get("slug"),
    url.searchParams.get("similar_limit"),
    url.searchParams.get("related_limit"),
  );

  if (sanitized.rejected) {
    return jsonResponse({ similar: [], related: [], rejected: true, reason: sanitized.reason });
  }

  try {
    const canonicalId = await resolveCanonicalIdFromD1(sanitized.canonicalId, sanitized.slug);
    if (!canonicalId) {
      return jsonResponse({ similar: [], related: [], found: false });
    }

    const bundle = await getRelatedKaomojiBundleFromD1(canonicalId, {
      similarLimit: sanitized.similarLimit,
      relatedLimit: sanitized.relatedLimit,
    });

    return jsonResponse({
      canonical_id: canonicalId,
      similar: bundle.similar,
      related: bundle.related,
      found: true,
    });
  } catch {
    return jsonResponse({ similar: [], related: [], found: false });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const rateKey = kaomojiRateLimitKeyFromRequest(request);
  if (!checkKaomojiSearchRateLimit(rateKey)) {
    return NextResponse.json(
      { error: "rate_limit_exceeded", similar: [], related: [] },
      { status: 429, headers: kaomojiSearchCacheHeaders() },
    );
  }

  try {
    const body = (await request.json()) as {
      canonical_id?: string;
      slug?: string;
      similar_limit?: number;
      related_limit?: number;
    };
    const sanitized = sanitizeRelatedRequest(
      body.canonical_id,
      body.slug,
      body.similar_limit,
      body.related_limit,
    );

    if (sanitized.rejected) {
      return jsonResponse({ similar: [], related: [], rejected: true, reason: sanitized.reason });
    }

    const canonicalId = await resolveCanonicalIdFromD1(sanitized.canonicalId, sanitized.slug);
    if (!canonicalId) {
      return jsonResponse({ similar: [], related: [], found: false });
    }

    const bundle = await getRelatedKaomojiBundleFromD1(canonicalId, {
      similarLimit: sanitized.similarLimit,
      relatedLimit: sanitized.relatedLimit,
    });

    return jsonResponse({
      canonical_id: canonicalId,
      similar: bundle.similar,
      related: bundle.related,
      found: true,
    });
  } catch {
    return jsonResponse({ similar: [], related: [], found: false });
  }
}
