import Link from "next/link";
import { KaomojiRankingSection } from "@/components/kaomoji/kaomoji-ranking-section";
import {
  getKaomojiCategoryFeatured,
  getKaomojiPopularRanking,
  getKaomojiTrendingRanking,
} from "@/lib/kaomoji/cloudflare/d1-rankings";

const HUB_CATEGORIES = [
  { slug: "happy", label: "Happy" },
  { slug: "love", label: "Love" },
  { slug: "cute", label: "Cute" },
] as const;

export async function KaomojiHubRankings() {
  const [popular, trending, ...categoryRankings] = await Promise.all([
    getKaomojiPopularRanking("7d", 12),
    getKaomojiTrendingRanking(12),
    ...HUB_CATEGORIES.map((c) => getKaomojiCategoryFeatured(c.slug, 8)),
  ]);

  return (
    <div className="space-y-10">
      <nav className="flex flex-wrap gap-2" aria-label="Kaomoji rankings">
        <Link href="/kaomoji/popular" className="chip">
          Popular kaomoji
        </Link>
        <Link href="/kaomoji/trending" className="chip">
          Trending kaomoji
        </Link>
      </nav>

      <KaomojiRankingSection result={popular} headingId="kaomoji-hub-popular" />
      <KaomojiRankingSection result={trending} headingId="kaomoji-hub-trending" />

      {HUB_CATEGORIES.map((category, index) => {
        const result = categoryRankings[index];
        if (!result || result.items.length === 0) return null;
        return (
          <KaomojiRankingSection
            key={category.slug}
            result={{
              ...result,
              label: `${result.label} — ${category.label}`,
            }}
            showRank={result.status === "LIVE"}
            headingId={`kaomoji-hub-category-${category.slug}`}
          />
        );
      })}
    </div>
  );
}
