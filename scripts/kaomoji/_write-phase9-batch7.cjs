const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel);
}

w("src/app/kaomoji/[slug]/page.tsx", `import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KaomojiDetailActions } from "@/components/kaomoji/kaomoji-detail-actions";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getEditorialBySlug, getIndexableSlugs, loadEditorialRecords, loadRelationships, phase9DataExists } from "@/lib/kaomoji/product/loader";
import { relatedForRecord } from "@/lib/kaomoji/processing/phase9/relationships";
import { createPageMetadata } from "@/lib/seo/metadata";

interface PageProps { params: Promise<{ slug: string }> }

export const dynamicParams = true;

export async function generateStaticParams() {
  if (!phase9DataExists()) return [];
  return getIndexableSlugs(300).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = getEditorialBySlug(slug);
  if (!record || !record.is_public) return { title: "Kaomoji Not Found" };
  return createPageMetadata({ title: record.seo_title, description: record.seo_description, path: \`/kaomoji/\${slug}\` });
}

export default async function KaomojiDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const record = getEditorialBySlug(slug);
  if (!record || !record.is_public) notFound();
  const rels = relatedForRecord(loadRelationships(), record.canonical_id, 8);
  const byId = new Map(loadEditorialRecords().map((r) => [r.canonical_id, r]));
  const related = rels.map((r) => byId.get(r.to_canonical_id)).filter(Boolean);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: record.seo_title,
    description: record.seo_description,
    url: \`https://emojiquick.com/kaomoji/\${slug}\`,
  };
  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Kaomoji", path: "/kaomoji" }, { name: record.editorial_name ?? record.canonical_content.slice(0, 20), path: \`/kaomoji/\${slug}\` }]} />
      <header className="space-y-4 text-center">
        <div className="text-4xl sm:text-5xl break-all" aria-label={record.accessible_name}>{record.canonical_content}</div>
        {record.editorial_name ? <h1 className="text-2xl font-semibold">{record.editorial_name}</h1> : <h1 className="sr-only">{record.accessible_name}</h1>}
        <KaomojiDetailActions canonicalId={record.canonical_id} slug={record.slug} content={record.canonical_content} accessibleName={record.accessible_name} />
      </header>
      {record.meaning ? (
        <section className="prose max-w-2xl mx-auto"><h2>Meaning</h2><p>{record.meaning}</p>{record.common_usage ? <p className="text-muted">{record.common_usage}</p> : null}<p className="text-xs text-muted">EmojiQuick editorial — category-derived, not an official Unicode name.</p></section>
      ) : null}
      <section className="space-y-2 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold">Keywords</h2>
        <div className="flex flex-wrap gap-2">{record.emojiquick_keywords.slice(0, 12).map((k) => <span key={k} className="chip">{k}</span>)}</div>
      </section>
      <section className="space-y-2 max-w-2xl mx-auto text-sm text-muted">
        <p>Quality: {record.quality_score} · Aesthetic: {record.beauty_score} · Tier: {record.editorial_tier}</p>
        {record.license_status === "ATTRIBUTION_REQUIRED" ? <p>Attribution may be required for some sources.</p> : null}
      </section>
      {related.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Related Kaomoji</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {related.map((r) => r && <KaomojiCard key={r.canonical_id} item={{ canonical_id: r.canonical_id, slug: r.slug, content: r.canonical_content, name: r.editorial_name, accessible_name: r.accessible_name }} />)}
          </div>
        </section>
      ) : null}
      <nav className="flex flex-wrap gap-2 text-sm">
        {record.emojiquick_categories.map((c) => (
          <Link key={c.slug} href={\`/kaomoji?category=\${c.slug}\`} className="chip">{c.label}</Link>
        ))}
      </nav>
    </div>
  );
}
`);

w("src/components/kaomoji/kaomoji-detail-actions.tsx", `"use client";

import { useCallback, useState } from "react";
import { copyText } from "@/lib/clipboard/copy-text";
import { addRecentKaomoji, toggleKaomojiFavorite, readKaomojiIds, KAOMOJI_FAVORITES_KEY } from "@/lib/kaomoji/product/local-storage";

interface Props {
  canonicalId: string;
  slug: string;
  content: string;
  accessibleName: string;
}

export function KaomojiDetailActions({ canonicalId, slug, content, accessibleName }: Props) {
  const [copied, setCopied] = useState(false);
  const [fav, setFav] = useState(() =>
    typeof window !== "undefined" ? readKaomojiIds(KAOMOJI_FAVORITES_KEY).includes(canonicalId) : false,
  );

  const handleCopy = useCallback(async () => {
    if (await copyText(content)) {
      addRecentKaomoji(canonicalId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  }, [canonicalId, content]);

  const handleShare = useCallback(async () => {
    const url = \`\${window.location.origin}/kaomoji/\${slug}\`;
    if (navigator.share) {
      try { await navigator.share({ title: accessibleName, url }); return; } catch { /* fall through */ }
    }
    await copyText(url);
  }, [accessibleName, slug]);

  return (
    <div className="flex flex-wrap justify-center gap-2">
      <button type="button" className="btn btn--primary btn--lg min-h-11" onClick={() => void handleCopy()} aria-label={\`Copy \${accessibleName}\`}>{copied ? "Copied!" : "Copy"}</button>
      <button type="button" className="btn btn--secondary min-h-11" onClick={() => setFav(toggleKaomojiFavorite(canonicalId))} aria-label={fav ? "Unfavorite" : "Favorite"}>{fav ? "Favorited" : "Favorite"}</button>
      <button type="button" className="btn btn--ghost min-h-11" onClick={() => void handleShare()}>Share</button>
    </div>
  );
}
`);

w("src/app/kaomoji/collections/[slug]/page.tsx", `import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubLayout } from "@/components/hub/hub-layout";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { loadCollections, loadEditorialRecords, phase9DataExists } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props { params: Promise<{ slug: string }> }

export async function generateStaticParams() {
  if (!phase9DataExists()) return [];
  return loadCollections().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = loadCollections().find((c) => c.slug === slug);
  if (!col) return { title: "Collection Not Found" };
  return createPageMetadata({ title: col.title, description: col.description, path: \`/kaomoji/collections/\${slug}\` });
}

export default async function KaomojiCollectionPage({ params }: Props) {
  const { slug } = await params;
  const col = loadCollections().find((c) => c.slug === slug);
  if (!col) notFound();
  const byId = new Map(loadEditorialRecords().map((r) => [r.canonical_id, r]));
  const items = col.canonical_ids.map((id) => byId.get(id)).filter(Boolean);
  return (
    <HubLayout path={\`/kaomoji/collections/\${slug}\`} title={col.title} description={col.description} links={[{ href: "/kaomoji", label: "All kaomoji" }]}>
      <p className="text-sm text-muted">{items.length} kaomoji · Rule: {col.rule}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {items.map((r) => r && <KaomojiCard key={r.canonical_id} item={{ canonical_id: r.canonical_id, slug: r.slug, content: r.canonical_content, name: r.editorial_name, accessible_name: r.accessible_name }} />)}
      </div>
    </HubLayout>
  );
}
`);

w("src/app/kaomoji-content-coverage/page.tsx", `import type { Metadata } from "next";
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
`);

console.log("batch7 done");
