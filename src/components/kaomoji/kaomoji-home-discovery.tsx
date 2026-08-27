import Link from "next/link";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { SectionHeader } from "@/components/ui/section-header";
import { getKaomojiPopularRanking } from "@/lib/kaomoji/cloudflare/d1-rankings";
import { kaomojiDataExists } from "@/lib/kaomoji/product/loader";

export async function KaomojiHomeDiscovery() {
  if (!kaomojiDataExists()) return null;

  const popular = await getKaomojiPopularRanking("7d", 6);
  if (popular.items.length === 0) return null;

  return (
    <section className="space-y-4">
      <SectionHeader
        title={popular.status === "LIVE" ? "Popular kaomoji" : "Featured kaomoji"}
        description={
          popular.status === "LIVE"
            ? "Japanese text faces ranked by real recent activity."
            : "Editorial featured kaomoji while live popularity data is still gathering."
        }
        action={{ href: "/kaomoji", label: "Browse kaomoji" }}
      />
      <div className="flex flex-wrap gap-2">
        <Link href="/kaomoji/popular" className="chip">
          Popular
        </Link>
        <Link href="/kaomoji/trending" className="chip">
          Trending
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
        {popular.items.map((item) => (
          <KaomojiCard
            key={item.canonical_id}
            item={{
              canonical_id: item.canonical_id,
              slug: item.slug,
              content: item.content,
              name: item.name,
              accessible_name: item.accessible_name,
            }}
          />
        ))}
      </div>
    </section>
  );
}
