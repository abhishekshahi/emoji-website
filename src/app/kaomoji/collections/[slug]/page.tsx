import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubLayout } from "@/components/hub/hub-layout";
import { KaomojiCard } from "@/components/kaomoji/kaomoji-card";
import { kaomojiDataExists, loadCollections, loadEditorialRecords } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props { params: Promise<{ slug: string }> }

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  if (!kaomojiDataExists()) return [];
  return loadCollections().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const col = loadCollections().find((c) => c.slug === slug);
  if (!col) return { title: "Collection Not Found" };
  return createPageMetadata({ title: col.title, description: col.description, path: `/kaomoji/collections/${slug}` });
}

export default async function KaomojiCollectionPage({ params }: Props) {
  const { slug } = await params;
  const col = loadCollections().find((c) => c.slug === slug);
  if (!col) notFound();
  const byId = new Map(loadEditorialRecords().map((r) => [r.canonical_id, r]));
  const items = col.canonical_ids.map((id) => byId.get(id)).filter(Boolean);
  return (
    <HubLayout path={`/kaomoji/collections/${slug}`} title={col.title} description={col.description} links={[{ href: "/kaomoji", label: "All kaomoji" }]}>
      <p className="text-sm text-muted">{items.length} kaomoji · Rule: {col.rule}</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {items.map((r) => r && <KaomojiCard key={r.canonical_id} item={{ canonical_id: r.canonical_id, slug: r.slug, content: r.canonical_content, name: r.editorial_name, accessible_name: r.accessible_name }} />)}
      </div>
    </HubLayout>
  );
}
