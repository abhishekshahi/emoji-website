import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { EMOJIQUICK_TAXONOMY, TAXONOMY_GROUPS } from "@/lib/kaomoji/processing/phase9/taxonomy";
import { countCategoryRecordsLocal } from "@/lib/kaomoji/seo/category-loader";
import { nestedCategoryPath, nestedGroupPath } from "@/lib/kaomoji/seo/category-routes";
import { groupLabel } from "@/lib/kaomoji/seo/intent-registry";
import { createPageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = createPageMetadata({
  title: "Kaomoji Categories — Browse by Emotion, Style & Animals",
  description:
    "Browse kaomoji by category: happy, cute, love, sad, cat, japanese, and more. Copy text faces organized by EmojiQuick taxonomy.",
  path: "/kaomoji/categories",
});

export default function KaomojiCategoriesIndexPage() {
  const groups = TAXONOMY_GROUPS.map((group) => ({
    group,
    label: groupLabel(group),
    href: nestedGroupPath(group),
    categories: EMOJIQUICK_TAXONOMY.filter((c) => c.group === group).map((c) => ({
      ...c,
      count: countCategoryRecordsLocal(c.slug),
      href: nestedCategoryPath(c.slug, 1),
    })),
  }));

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Kaomoji Categories",
          url: "https://emojiquick.com/kaomoji/categories",
          description: "EmojiQuick kaomoji taxonomy categories for browsing and copy.",
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          { name: "Categories", path: "/kaomoji/categories" },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">Kaomoji categories</h1>
        <p className="text-muted">
          Browse public kaomoji by EmojiQuick taxonomy — emotions, affection, cute styles, animals, actions, and visual
          styles. Each subcategory page lists copy-ready text faces with pagination.
        </p>
      </header>
      {groups.map(({ group, label, href, categories }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-xl font-semibold">
            {href ? (
              <Link href={href} className="hover:underline">
                {label}
              </Link>
            ) : (
              label
            )}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <li key={c.slug} className="rounded-lg border border-border p-3">
                {c.href ? (
                  <Link href={c.href} className="font-medium hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="font-medium">{c.label}</span>
                )}
                <p className="text-xs text-muted mt-1">{c.count.toLocaleString()} public</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <div className="flex flex-wrap gap-2">
        <Link href="/kaomoji/collections" className="pill-link">
          Editorial collections
        </Link>
        <Link href="/kaomoji/meaning/hug" className="pill-link">
          Kaomoji meanings
        </Link>
        <Link href="/kaomoji/for/texting" className="pill-link">
          Kaomoji for texting
        </Link>
        <Link href="/kaomoji/events" className="pill-link">
          Seasonal events
        </Link>
      </div>
    </div>
  );
}
