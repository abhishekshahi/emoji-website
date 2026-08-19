import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KaomojiDetailActions } from "@/components/kaomoji/kaomoji-detail-actions";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getEditorialBySlug, getIndexableSlugs, kaomojiDataExists, loadEditorialRecords, loadRelationships } from "@/lib/kaomoji/product/loader";
import { relatedForRecord } from "@/lib/kaomoji/processing/phase9/relationships";
import { createPageMetadata } from "@/lib/seo/metadata";

interface PageProps { params: Promise<{ slug: string }> }

export const dynamicParams = true;

export async function generateStaticParams() {
  if (!kaomojiDataExists()) return [];
  return getIndexableSlugs(300).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = getEditorialBySlug(slug);
  if (!record || !record.is_public) return { title: "Kaomoji Not Found" };
  return createPageMetadata({ title: record.seo_title, description: record.seo_description, path: `/kaomoji/${slug}` });
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
    url: `https://emojiquick.com/kaomoji/${slug}`,
  };
  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd data={jsonLd} />
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Kaomoji", path: "/kaomoji" }, { name: record.editorial_name ?? record.canonical_content.slice(0, 20), path: `/kaomoji/${slug}` }]} />
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
          <Link key={c.slug} href={`/kaomoji?category=${c.slug}`} className="chip">{c.label}</Link>
        ))}
      </nav>
    </div>
  );
}
