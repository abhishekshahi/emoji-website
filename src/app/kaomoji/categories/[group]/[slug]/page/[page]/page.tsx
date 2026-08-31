import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KaomojiCategoryPagination } from "@/components/kaomoji/kaomoji-category-pagination";
import { KaomojiGridItem } from "@/components/kaomoji/kaomoji-grid-item";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getCategoryPageDataPaged } from "@/lib/kaomoji/seo/category-loader-server";
import {
  CATEGORY_PAGE_SIZE,
  parseCategoryPageParam,
  resolveNestedCategory,
  taxonomyGroupFromPath,
} from "@/lib/kaomoji/seo/category-routes";
import { groupLabel } from "@/lib/kaomoji/seo/intent-registry";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props {
  params: Promise<{ group: string; slug: string; page: string }>;
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group, slug, page: pageRaw } = await params;
  const pageNum = parseCategoryPageParam(pageRaw);
  const cat = resolveNestedCategory(group, slug);
  if (!cat || pageNum == null) return { title: "Category not found" };
  const data = await getCategoryPageDataPaged(slug, pageNum, CATEGORY_PAGE_SIZE);
  if (!data) return { title: "Category not found" };
  const title = pageNum > 1 ? `${cat.label} Kaomoji — Page ${pageNum}` : `${cat.label} Kaomoji`;
  return createPageMetadata({
    title,
    description: `Browse and copy ${cat.label.toLowerCase()} kaomoji text faces. ${data.itemCount.toLocaleString()} public records.`,
    path: `/kaomoji/categories/${group}/${slug}/page/${pageNum}`,
  });
}

export default async function KaomojiNestedCategoryPage({ params }: Props) {
  const { group, slug, page: pageRaw } = await params;
  const pageNum = parseCategoryPageParam(pageRaw);
  if (pageNum == null) notFound();

  const cat = resolveNestedCategory(group, slug);
  if (!cat) notFound();

  const groupKey = taxonomyGroupFromPath(group);
  if (!groupKey) notFound();

  const data = await getCategoryPageDataPaged(slug, pageNum, CATEGORY_PAGE_SIZE);
  if (!data) notFound();

  const groupLbl = groupLabel(groupKey);
  const path = `/kaomoji/categories/${group}/${slug}/page/${data.page}`;

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${cat.label} Kaomoji`,
          description: `Public ${cat.label.toLowerCase()} kaomoji on EmojiQuick.`,
          url: `https://emojiquick.com${path}`,
          numberOfItems: data.itemCount,
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Categories", path: "/kaomoji/categories" },
          { name: groupLbl, path: `/kaomoji/categories/${group}` },
          { name: cat.label, path },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">{cat.label} Kaomoji</h1>
        <p className="text-muted">
          Browse and copy {cat.label.toLowerCase()} kaomoji text faces. Public records only — one-click copy, no
          account required.
        </p>
        <p className="text-sm text-muted">
          {data.itemCount.toLocaleString()} kaomoji
          {data.totalPages > 1 ? ` · Page ${data.page} of ${data.totalPages}` : ""}
        </p>
      </header>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {data.items.map((r) => (
          <KaomojiGridItem
            key={r.canonical_id}
            item={{
              canonical_id: r.canonical_id,
              slug: r.slug,
              content: r.content,
              name: r.name,
              accessible_name: r.accessible_name,
            }}
          />
        ))}
      </div>
      <KaomojiCategoryPagination group={group} slug={slug} page={data.page} totalPages={data.totalPages} />
      <div className="flex flex-wrap gap-2">
        <Link href={`/kaomoji/categories/${group}`} className="pill-link">
          More {groupLbl.toLowerCase()}
        </Link>
        <Link href="/kaomoji/categories" className="pill-link">
          All categories
        </Link>
        <Link href={`/kaomoji/search?q=${encodeURIComponent(cat.label)}`} className="pill-link">
          Search {cat.label.toLowerCase()}
        </Link>
      </div>
    </div>
  );
}
