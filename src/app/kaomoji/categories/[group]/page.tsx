import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { groupLabel } from "@/lib/kaomoji/seo/intent-registry";
import {
  listTaxonomyInGroupPath,
  nestedCategoryPath,
  taxonomyGroupFromPath,
} from "@/lib/kaomoji/seo/category-routes";
import { countCategoryRecords } from "@/lib/kaomoji/seo/category-loader-server";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props {
  params: Promise<{ group: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { group: groupPath } = await params;
  const group = taxonomyGroupFromPath(groupPath);
  if (!group) return { title: "Category group not found" };
  const label = groupLabel(group);
  return createPageMetadata({
    title: `${label} Kaomoji Categories`,
    description: `Browse ${label.toLowerCase()} kaomoji categories and copy Japanese text faces.`,
    path: `/kaomoji/categories/${groupPath}`,
  });
}

export default async function KaomojiCategoryGroupPage({ params }: Props) {
  const { group: groupPath } = await params;
  const group = taxonomyGroupFromPath(groupPath);
  if (!group) notFound();

  const cats = listTaxonomyInGroupPath(groupPath);
  if (cats.length === 0) notFound();

  const label = groupLabel(group);
  const withCounts = await Promise.all(
    cats.map(async (c) => ({
      ...c,
      count: await countCategoryRecords(c.slug),
      href: nestedCategoryPath(c.slug, 1),
    })),
  );

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `${label} Kaomoji`,
          url: `https://emojiquick.com/kaomoji/categories/${groupPath}`,
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Categories", path: "/kaomoji/categories" },
          { name: label, path: `/kaomoji/categories/${groupPath}` },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">{label}</h1>
        <p className="text-muted">
          Browse public {label.toLowerCase()} kaomoji by subcategory. Each page lists copy-ready text faces.
        </p>
      </header>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {withCounts.map((c) =>
          c.href ? (
            <li key={c.slug} className="rounded-lg border border-border p-3">
              <Link href={c.href} className="font-medium hover:underline">
                {c.label}
              </Link>
              <p className="text-xs text-muted mt-1">{c.count.toLocaleString()} public</p>
            </li>
          ) : null,
        )}
      </ul>
      <Link href="/kaomoji/categories" className="pill-link">
        All category groups
      </Link>
    </div>
  );
}
