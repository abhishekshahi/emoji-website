import { NextResponse } from "next/server";
import { getAllBrowsableEmojis } from "@/lib/emoji/browsable-data";
import { isR2SearchBackendActive, searchMasterViaR2, toPublicMasterError } from "@/lib/r2";
import { searchProductionEmojisAsync } from "@/lib/master/integration/search/production-bridge";
import { jsonResponseHeaders } from "@/lib/master/r2/http";

export async function GET(request: Request): Promise<NextResponse> {
  if (!isR2SearchBackendActive()) {
    return NextResponse.json({ error: "Master R2 search is disabled" }, { status: 404 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const limit = Math.min(120, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));

  if (!query.trim()) {
    return NextResponse.json({ query, results: [], ambiguous: false }, { headers: jsonResponseHeaders() });
  }

  try {
    const emojis = getAllBrowsableEmojis();
    const results = await searchProductionEmojisAsync(emojis, query, limit);
    const r2Audit = await searchMasterViaR2(query, process.cwd(), Math.min(limit, 10));

    return NextResponse.json(
      {
        query,
        results: results.map((result) => ({
          id: result.emoji.id,
          slug: result.emoji.slug,
          name: result.emoji.name,
          emoji: result.emoji.emoji,
          score: result.score,
        })),
        ambiguous: r2Audit.ambiguous,
      },
      { headers: { ...jsonResponseHeaders(), "Cache-Control": "private, no-store" } },
    );
  } catch (error: unknown) {
    const pub = toPublicMasterError(error);
    return NextResponse.json({ error: pub.message, code: pub.code }, { status: 503 });
  }
}
