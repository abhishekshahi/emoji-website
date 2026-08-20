import { NextResponse } from "next/server";
import { searchKaomojiPublic } from "@/lib/kaomoji/product/search";
import { kaomojiDataExists } from "@/lib/kaomoji/product/loader";

export async function GET(request: Request): Promise<NextResponse> {
  if (!kaomojiDataExists()) {
    return NextResponse.json({ results: [] });
  }
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").slice(0, 120);
  const limit = Math.min(48, Math.max(1, Number(url.searchParams.get("limit") ?? 24)));
  if (!q.trim()) return NextResponse.json({ results: [] });
  const hits = searchKaomojiPublic(q, limit);
  return NextResponse.json({
    results: hits.map((h) => ({
      canonical_id: h.record.canonical_id,
      slug: h.record.slug,
      content: h.record.content,
      name: h.record.name,
      accessible_name: h.record.name ? `${h.record.name.toLowerCase()} kaomoji` : "kaomoji expression",
      score: h.score,
    })),
  });
}
