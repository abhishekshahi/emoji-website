import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { EMOJIQUICK_TAXONOMY, TAXONOMY_GROUPS } from "@/lib/kaomoji/processing/phase9/taxonomy";
import { countCategoryRecordsLocal } from "@/lib/kaomoji/seo/category-loader";
import {
  CURATED_INTENT_SLUGS,
  groupLabel,
  MIN_INTENT_PAGE_RECORDS,
} from "@/lib/kaomoji/seo/intent-registry";
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
    categories: EMOJIQUICK_TAXONOMY.filter((c) => c.group === group).map((c) => ({
      ...c,
      count: countCategoryRecordsLocal(c.slug),
      indexable: CURATED_INTENT_SLUGS.includes(c.slug as (typeof CURATED_INTENT_SLUGS)[number]) &&
        countCategoryRecordsLocal(c.slug) >= MIN_INTENT_PAGE_RECORDS,
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
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Kaomoji", path: "/kaomoji" }, { name: "Categories", path: "/kaomoji/categories" }]} />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">Kaomoji categories</h1>
        <p className="text-muted">
          Browse public kaomoji by EmojiQuick taxonomy — emotions, love, cute styles, animals, actions, and visual styles.
          Indexable category pages include curated copy-ready grids; others link to search.
        </p>
      </header>
      {groups.map(({ group, label, categories }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-xl font-semibold">{label}</h2>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <li key={c.slug} className="rounded-lg border border-border p-3">
                <Link
                  href={c.indexable ? `/kaomoji/${c.slug}` : `/kaomoji/search?q=${encodeURIComponent(c.label)}`}
                  className="font-medium hover:underline"
                >
                  {c.label}
                </Link>
                <p className="text-xs text-muted mt-1">
                  {c.count.toLocaleString()} public · {c.indexable ? "category page" : "search"}
                </p>
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
      </div>
    </div>
  );
}
