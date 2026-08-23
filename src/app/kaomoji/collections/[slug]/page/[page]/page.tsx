import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubLayout } from "@/components/hub/hub-layout";
import { KaomojiCollectionPagination } from "@/components/kaomoji/kaomoji-collection-pagination";
import { KaomojiGridItem } from "@/components/kaomoji/kaomoji-grid-item";
import { getCollectionFromD1 } from "@/lib/kaomoji/cloudflare/d1-pages";
import {
  paginateCollectionIds,
  resolveCollectionItems,
} from "@/lib/kaomoji/product/collection-pages";
import { kaomojiDataExists, loadCollections, loadEditorialRecords } from "@/lib/kaomoji/product/loader";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props {
  params: Promise<{ slug: string; page: string }>;
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  if (!kaomojiDataExists()) return [];
  return loadCollections().flatMap((c) => {
    const pages = Math.max(1, Math.ceil(c.canonical_ids.length / 48));
    return Array.from({ length: pages }, (_, i) => ({ slug: c.slug, page: String(i + 1) }));
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, page } = await params;
  const d1 = await getCollectionFromD1(slug, Number(page) || 1);
  if (d1) {
    const title = d1.page > 1 ? `${d1.meta.title} — Page ${d1.page}` : d1.meta.title;
    return createPageMetadata({
      title,
      description: d1.meta.description,
      path: `/kaomoji/collections/${slug}/page/${page}`,
    });
  }
  const col = loadCollections().find((c) => c.slug === slug);
  if (!col) return { title: "Collection Not Found" };
  const pageNum = Number(page);
  const title = pageNum > 1 ? `${col.title} — Page ${pageNum}` : col.title;
  return createPageMetadata({
    title,
    description: col.description,
    path: `/kaomoji/collections/${slug}/page/${page}`,
  });
}

export default async function KaomojiCollectionPage({ params }: Props) {
  const { slug, page: pageRaw } = await params;
  const pageNum = Number(pageRaw);
  if (!Number.isFinite(pageNum) || pageNum < 1) notFound();

  const d1 = await getCollectionFromD1(slug, pageNum);
  if (d1) {
    if (d1.page !== pageNum) notFound();
    return (
      <HubLayout
        path={`/kaomoji/collections/${slug}/page/${d1.page}`}
        title={d1.meta.title}
        description={d1.meta.description}
        links={[{ href: "/kaomoji", label: "All kaomoji" }]}
      >
        <p className="text-sm text-muted">
          {d1.meta.item_count} kaomoji · Rule: {d1.meta.rule}
          {d1.totalPages > 1 ? ` · Page ${d1.page} of ${d1.totalPages}` : ""}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {d1.items.map((r) => (
            <KaomojiGridItem
              key={r.canonical_id}
              item={{
                canonical_id: r.canonical_id,
                slug: r.slug,
                content: r.content,
                name: r.editorial_name,
                accessible_name: r.accessible_name,
              }}
            />
          ))}
        </div>
        <KaomojiCollectionPagination slug={slug} page={d1.page} totalPages={d1.totalPages} />
      </HubLayout>
    );
  }

  if (!kaomojiDataExists()) notFound();

  const col = loadCollections().find((c) => c.slug === slug);
  if (!col) notFound();

  const { page, totalPages, pageIds } = paginateCollectionIds(col.canonical_ids, pageNum);
  if (page !== pageNum) notFound();

  const byId = new Map(loadEditorialRecords().map((r) => [r.canonical_id, r]));
  const items = resolveCollectionItems(pageIds, byId);

  return (
    <HubLayout
      path={`/kaomoji/collections/${slug}/page/${page}`}
      title={col.title}
      description={col.description}
      links={[{ href: "/kaomoji", label: "All kaomoji" }]}
    >
      <p className="text-sm text-muted">
        {col.canonical_ids.length} kaomoji · Rule: {col.rule}
        {totalPages > 1 ? ` · Page ${page} of ${totalPages}` : ""}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {items.map((r) => (
          <KaomojiGridItem
            key={r.canonical_id}
            item={{
              canonical_id: r.canonical_id,
              slug: r.slug,
              content: r.canonical_content,
              name: r.editorial_name,
              accessible_name: r.accessible_name,
            }}
          />
        ))}
      </div>
      <KaomojiCollectionPagination slug={slug} page={page} totalPages={totalPages} />
    </HubLayout>
  );
}
