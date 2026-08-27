import type { Metadata } from "next";
import Link from "next/link";
import { HubLayout } from "@/components/hub/hub-layout";
import { KaomojiEventsDiscovery } from "@/components/kaomoji/kaomoji-events-discovery";
import { KaomojiHubRankings } from "@/components/kaomoji/kaomoji-hub-rankings";
import { KaomojiSearchPanel } from "@/components/kaomoji/kaomoji-search-panel";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { getPublicEditorialRecords, kaomojiDataExists, loadCollections } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Kaomoji — Japanese Text Faces",
  description: "Browse, search, and copy kaomoji text faces. Cute, love, happy, sad, and more.",
  path: "/kaomoji",
});

export default async function KaomojiHubPage() {
  if (!kaomojiDataExists()) {
    return (
      <HubLayout path="/kaomoji" title="Kaomoji" description="Kaomoji dataset not built yet. Run npm run kaomoji:phase12.">
        <p className="text-muted">Phase 12 public library required.</p>
      </HubLayout>
    );
  }
  const featured = getPublicEditorialRecords(12);
  const collections = loadCollections().slice(0, 10);
  return (
    <HubLayout
      path="/kaomoji"
      title="Kaomoji"
      description="Search and copy Japanese-style text faces (kaomoji). No account required."
      links={[
        { href: "/kaomoji/search", label: "Search" },
        { href: "/kaomoji/categories", label: "Categories" },
        { href: "/kaomoji/collections", label: "Collections" },
        { href: "/kaomoji/events", label: "Events" },
        { href: "/kaomoji/my", label: "My collections" },
        { href: "/kaomoji/popular", label: "Popular" },
        { href: "/kaomoji/trending", label: "Trending" },
        { href: "/kaomoji-content-coverage", label: "Content coverage" },
        { href: "/search", label: "Emoji search" },
      ]}
    >
      <KaomojiSearchPanel />
      <KaomojiEventsDiscovery />
      <KaomojiHubRankings />
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Featured</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {featured.map((r) => (
            <KaomojiCard key={r.canonical_id} item={{ canonical_id: r.canonical_id, slug: r.slug, content: r.canonical_content, name: r.editorial_name, accessible_name: r.accessible_name }} />
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Collections</h2>
        <ul className="flex flex-wrap gap-2">
          {collections.map((c) => (
            <li key={c.slug}><Link className="chip" href={`/kaomoji/collections/${c.slug}/page/1`}>{c.title}</Link></li>
          ))}
        </ul>
      </section>
    </HubLayout>
  );
}
