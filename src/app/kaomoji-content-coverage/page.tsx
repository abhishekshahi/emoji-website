import type { Metadata } from "next";
import { HubLayout } from "@/components/hub/hub-layout";
import { getPhase9Manifest, phase9DataExists } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Kaomoji Content Coverage",
  description: "Editorial coverage dashboard for EmojiQuick kaomoji — tiers, quality, categories, and publication gates.",
  path: "/kaomoji-content-coverage",
});

export default function KaomojiContentCoveragePage() {
  if (!phase9DataExists()) {
    return <HubLayout path="/kaomoji-content-coverage" title="Kaomoji Coverage" description="Run npm run kaomoji:phase9 first."><p className="text-muted">Not built.</p></HubLayout>;
  }
  const m = getPhase9Manifest();
  return (
    <HubLayout path="/kaomoji-content-coverage" title="Kaomoji Content Coverage" description="Honest coverage metrics for the Phase 9 kaomoji knowledge layer.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          ["Canonical candidates", m.canonical_candidates],
          ["Public candidates", m.public_candidates],
          ["Review", m.review],
          ["Remove candidates", m.remove_candidates],
          ["Tier 1", m.tier_1],
          ["Tier 2", m.tier_2],
          ["Tier 3", m.tier_3],
          ["Categories assigned", m.categories_assigned],
          ["Names assigned", m.names_assigned],
          ["Meanings (editorial)", m.meanings_editorial],
          ["Collections", m.collections],
          ["Relationships", m.relationships],
          ["Search index", m.search_index_records],
          ["RAW (immutable)", m.raw_after],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border border-border p-4"><p className="text-sm text-muted">{label}</p><p className="text-2xl font-semibold">{value}</p></div>
        ))}
      </div>
      <p className="text-sm text-muted">Popularity: {m.popularity_status}. No fabricated traffic. RAW removed: {m.raw_removed}.</p>
    </HubLayout>
  );
}
