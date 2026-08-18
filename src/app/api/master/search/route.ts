import { NextResponse } from "next/server";
import { isPublicMasterApiEnabled } from "@/lib/master/public/config";
import { searchMasterIntegrated } from "@/lib/master/integration/search/adapter";
import { sanitizePublicProvenanceSource } from "@/lib/master/public/asset-rights";
import { getProductionSlugForCanonical } from "@/lib/master/public/production-slug";
import { encodeCatalogPath } from "@/lib/master/public/visibility";
import { shouldReadFromR2Binding } from "@/lib/master/r2/config";
import { jsonResponseHeaders } from "@/lib/master/r2/http";
import { resolveSearchQuery } from "@/lib/content/search-intent/classifier";
import { searchPublicMasterFromR2 } from "@/lib/master/public/r2-service";
import { getProductionSlugForCanonicalEdge } from "@/lib/master/public/edge-context";
import { toPublicMasterError } from "@/lib/r2";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isPublicMasterApiEnabled()) {
    return NextResponse.json({ error: "Public master API is disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const rawQuery = url.searchParams.get("q") ?? "";
  const limit = Math.min(120, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const language = url.searchParams.get("lang") ?? "en";
  const { intent, searchQuery, combinationSlugs } = resolveSearchQuery(rawQuery, language);

  if (!searchQuery.trim()) {
    return NextResponse.json({ query: rawQuery, results: [], ambiguous: false, intent, combinationSlugs: combinationSlugs ?? [] }, { headers: jsonResponseHeaders() });
  }

  try {
    const response = shouldReadFromR2Binding()
      ? await searchPublicMasterFromR2(searchQuery, limit)
      : searchMasterIntegrated(searchQuery, process.cwd(), limit);

    const enriched = response.results.map((result) => {
      const seoSlug = shouldReadFromR2Binding()
        ? getProductionSlugForCanonicalEdge(result.canonicalId)
        : getProductionSlugForCanonical(result.canonicalId);
      return {
        ...result,
        source: sanitizePublicProvenanceSource(result.source),
        provenance: Object.freeze({
          ...result.provenance,
          source: sanitizePublicProvenanceSource(result.provenance.source),
        }),
        resultType: seoSlug ? "seo-page" : "catalog-item",
        seoPageUrl: seoSlug ? `/emoji/${seoSlug}` : null,
        catalogUrl: encodeCatalogPath(result.canonicalId),
      };
    });

    return NextResponse.json(
      { query: rawQuery, results: enriched, ambiguous: response.ambiguous, intent, combinationSlugs: combinationSlugs ?? [] },
      { headers: jsonResponseHeaders() },
    );
  } catch (error: unknown) {
    const pub = toPublicMasterError(error);
    return NextResponse.json(
      { error: pub.message, code: pub.code },
      { status: pub.code === "NOT_FOUND" ? 404 : 503, headers: jsonResponseHeaders() },
    );
  }
}
