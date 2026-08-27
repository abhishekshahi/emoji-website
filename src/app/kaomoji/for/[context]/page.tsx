import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KaomojiSeoHubPage } from "@/components/kaomoji/kaomoji-seo-hub-page";
import { getCategoryPageData } from "@/lib/kaomoji/seo/category-loader-server";
import { isCuratedIntentSlug, MIN_INTENT_PAGE_RECORDS, resolveIntentTaxonomy } from "@/lib/kaomoji/seo/intent-registry";
import { buildKaomojiCollectionJsonLd, buildKaomojiIntentBreadcrumbJsonLd } from "@/lib/kaomoji/seo/structured-data";
import {
  getUseCasePageContent,
  USE_CASE_PAGE_SLUGS,
} from "@/lib/kaomoji/seo/use-case-pages";
import { getCollectionFromD1 } from "@/lib/kaomoji/cloudflare/d1-pages";
import { kaomojiDataExists, loadCollections, loadEditorialRecords } from "@/lib/kaomoji/product/loader";
import { resolveCollectionItems } from "@/lib/kaomoji/product/collection-pages";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props {
  params: Promise<{ context: string }>;
}

export async function generateStaticParams() {
  return USE_CASE_PAGE_SLUGS.map((context) => ({ context }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { context } = await params;
  const content = getUseCasePageContent(context);
  if (!content) return { title: "Page Not Found" };
  return createPageMetadata({
    title: content.title,
    description: content.description,
    path: `/kaomoji/for/${context}`,
  });
}

async function loadUseCaseItems(collectionSlug: string | null, relatedSlugs: readonly string[]) {
  if (collectionSlug) {
    const d1 = await getCollectionFromD1(collectionSlug, 1);
    if (d1?.items.length) {
      return {
        items: d1.items.map((r) => ({
          canonical_id: r.canonical_id,
          slug: r.slug,
          content: r.content,
          name: r.editorial_name,
          accessible_name: r.accessible_name,
        })),
        count: d1.meta.item_count,
      };
    }
    const col = loadCollections().find((c) => c.slug === collectionSlug);
    if (col && kaomojiDataExists()) {
      const byId = new Map(loadEditorialRecords().map((r) => [r.canonical_id, r]));
      const items = resolveCollectionItems(col.canonical_ids.slice(0, 48), byId);
      return {
        items: items.map((r) => ({
          canonical_id: r.canonical_id,
          slug: r.slug,
          content: r.canonical_content,
          name: r.editorial_name,
          accessible_name: r.accessible_name,
        })),
        count: col.canonical_ids.length,
      };
    }
  }

  const merged: Awaited<ReturnType<typeof getCategoryPageData>>[] = [];
  for (const slug of relatedSlugs) {
    if (!isCuratedIntentSlug(slug)) continue;
    const data = await getCategoryPageData(slug, 12);
    if (data) merged.push(data);
  }
  const items = merged.flatMap((d) => d!.items).slice(0, 48);
  const count = merged.reduce((n, d) => n + (d?.itemCount ?? 0), 0);
  return { items, count: count || items.length };
}

export default async function KaomojiUseCasePage({ params }: Props) {
  const { context } = await params;
  const content = getUseCasePageContent(context);
  if (!content) notFound();

  const { items, count } = await loadUseCaseItems(content.collectionSlug, content.relatedIntentSlugs);
  if (items.length === 0) notFound();

  const path = `/kaomoji/for/${context}`;
  const collectionLink = content.collectionSlug
    ? { href: `/kaomoji/collections/${content.collectionSlug}/page/1`, label: "Full collection" }
    : null;

  return (
    <KaomojiSeoHubPage
      path={path}
      title={content.title}
      h1={content.h1}
      description={content.description}
      intro={`${content.intro} ${content.tips}`}
      itemCount={count}
      items={items}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Kaomoji", path: "/kaomoji" },
        { name: content.h1, path },
      ]}
      jsonLd={[
        buildKaomojiCollectionJsonLd(content.h1, context, count, path),
        buildKaomojiIntentBreadcrumbJsonLd(content.h1, context),
      ]}
      relatedIntents={content.relatedIntentSlugs
        .filter(isCuratedIntentSlug)
        .map((s) => ({
          href: `/kaomoji/${s}`,
          label: `${resolveIntentTaxonomy(s)?.label ?? s} kaomoji`,
        }))}
      relatedCollections={collectionLink ? [collectionLink] : []}
      extra={
        collectionLink ? (
          <p className="text-sm">
            <Link href={collectionLink.href} className="underline">
              Browse the full EmojiQuick editorial collection
            </Link>{" "}
            for this use case.
          </p>
        ) : null
      }
    />
  );
}
