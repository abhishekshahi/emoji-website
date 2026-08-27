import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { KaomojiSeoHubPage } from "@/components/kaomoji/kaomoji-seo-hub-page";
import { KaomojiDetailActions } from "@/components/kaomoji/kaomoji-detail-actions";
import { KaomojiRankingBadge } from "@/components/kaomoji/kaomoji-ranking-badge";
import { KaomojiRelatedSection } from "@/components/kaomoji/kaomoji-related-section";
import { KaomojiViewTracker } from "@/components/kaomoji/kaomoji-view-tracker";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getKaomojiDetailFromD1, getRelatedKaomojiBundleForPageFromD1 } from "@/lib/kaomoji/cloudflare/d1-pages";
import { getKaomojiRecordRank } from "@/lib/kaomoji/cloudflare/d1-rankings";
import {
  getEditorialBySlug,
  getIndexableSlugs,
  getRelatedEditorialBundle,
  kaomojiDataExists,
  loadCollections,
} from "@/lib/kaomoji/product/loader";
import { getCategoryPageData } from "@/lib/kaomoji/seo/category-loader-server";
import {
  buildIntentFaq,
  buildIntentIntro,
  buildIntentPageDescription,
  buildIntentPageTitle,
  CURATED_INTENT_SLUGS,
  isCuratedIntentSlug,
  isKaomojiDetailSlug,
  MIN_INTENT_PAGE_RECORDS,
  relatedIntentSlugs,
  resolveIntentTaxonomy,
} from "@/lib/kaomoji/seo/intent-registry";
import {
  buildKaomojiBreadcrumbJsonLd,
  buildKaomojiCollectionJsonLd,
  buildKaomojiIntentBreadcrumbJsonLd,
  buildKaomojiWebPageJsonLd,
} from "@/lib/kaomoji/seo/structured-data";
import { createPageMetadata } from "@/lib/seo/metadata";

const REQUIRED_STATIC_SLUGS = ["kao-00013e7cc777f411"] as const;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";
export const dynamicParams = true;

export async function generateStaticParams() {
  if (!kaomojiDataExists()) return [];
  const slugs = new Set(getIndexableSlugs(300));
  for (const slug of REQUIRED_STATIC_SLUGS) slugs.add(slug);
  for (const intent of CURATED_INTENT_SLUGS) slugs.add(intent);
  return [...slugs].map((slug) => ({ slug }));
}

function collectionLinkForIntent(slug: string): { href: string; label: string } | null {
  const col = loadCollections().find((c) => c.slug === `${slug}-kaomoji` || c.slug === `kaomoji-for-${slug}`);
  if (!col) return null;
  return { href: `/kaomoji/collections/${col.slug}/page/1`, label: col.title };
}

async function renderIntentPage(slug: string) {
  const category = resolveIntentTaxonomy(slug);
  if (!category) notFound();
  const data = await getCategoryPageData(slug, 48);
  if (!data || data.itemCount < MIN_INTENT_PAGE_RECORDS) notFound();

  const path = `/kaomoji/${slug}`;
  const title = buildIntentPageTitle(category.label);
  const description = buildIntentPageDescription(category.label, data.itemCount);
  const colLink = collectionLinkForIntent(slug);

  return (
    <KaomojiSeoHubPage
      path={path}
      title={title}
      h1={`${category.label} kaomoji`}
      description={description}
      intro={buildIntentIntro(category, data.itemCount)}
      itemCount={data.itemCount}
      items={data.items}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Kaomoji", path: "/kaomoji" },
        { name: `${category.label} kaomoji`, path },
      ]}
      jsonLd={[
        buildKaomojiCollectionJsonLd(category.label, slug, data.itemCount, path),
        buildKaomojiIntentBreadcrumbJsonLd(category.label, slug),
      ]}
      relatedIntents={relatedIntentSlugs(slug).map((s) => ({
        href: `/kaomoji/${s}`,
        label: `${resolveIntentTaxonomy(s)?.label ?? s} kaomoji`,
      }))}
      relatedCollections={colLink ? [colLink] : []}
      relatedMeanings={[{ href: `/kaomoji/meaning/${slug}`, label: `${category.label} meaning` }]}
      relatedUseCases={[
        { href: "/kaomoji/for/texting", label: "For texting" },
        { href: "/kaomoji/for/discord", label: "For Discord" },
      ]}
      faq={buildIntentFaq(category)}
    />
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  if (isCuratedIntentSlug(slug) && !isKaomojiDetailSlug(slug)) {
    const category = resolveIntentTaxonomy(slug);
    if (category) {
      const data = await getCategoryPageData(slug, 1);
      if (data && data.itemCount >= MIN_INTENT_PAGE_RECORDS) {
        return createPageMetadata({
          title: buildIntentPageTitle(category.label),
          description: buildIntentPageDescription(category.label, data.itemCount),
          path: `/kaomoji/${slug}`,
        });
      }
    }
  }

  const d1 = await getKaomojiDetailFromD1(slug);
  if (d1) {
    return createPageMetadata({
      title: d1.seo_title ?? d1.editorial_name ?? "Kaomoji",
      description: d1.seo_description ?? d1.accessible_name,
      path: `/kaomoji/${slug}`,
    });
  }
  if (!kaomojiDataExists()) return { title: "Kaomoji Not Found" };
  const record = getEditorialBySlug(slug);
  if (!record || !record.is_public) return { title: "Kaomoji Not Found" };
  return createPageMetadata({ title: record.seo_title, description: record.seo_description, path: `/kaomoji/${slug}` });
}

export default async function KaomojiSlugPage({ params }: PageProps) {
  const { slug } = await params;

  if (isCuratedIntentSlug(slug) && !isKaomojiDetailSlug(slug)) {
    return renderIntentPage(slug);
  }

  const d1 = await getKaomojiDetailFromD1(slug);
  if (d1) {
    const [relatedBundle, recordRank] = await Promise.all([
      getRelatedKaomojiBundleForPageFromD1(d1.canonical_id),
      getKaomojiRecordRank(d1.canonical_id),
    ]);
    return (
      <div className="page-shell space-y-8 pb-12">
        <KaomojiViewTracker canonicalId={d1.canonical_id} slug={d1.slug} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: d1.seo_title ?? d1.editorial_name ?? "Kaomoji",
            description: d1.seo_description ?? d1.accessible_name,
            url: `https://emojiquick.com/kaomoji/${d1.slug}`,
          }}
        />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: "https://emojiquick.com" },
              { "@type": "ListItem", position: 2, name: "Kaomoji", item: "https://emojiquick.com/kaomoji" },
              {
                "@type": "ListItem",
                position: 3,
                name: d1.editorial_name ?? d1.accessible_name,
                item: `https://emojiquick.com/kaomoji/${d1.slug}`,
              },
            ],
          }}
        />
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Kaomoji", path: "/kaomoji" },
            { name: d1.editorial_name ?? d1.content.slice(0, 20), path: `/kaomoji/${slug}` },
          ]}
        />
        <header className="space-y-4 text-center">
          <div className="text-4xl sm:text-5xl break-all" aria-label={d1.accessible_name}>
            {d1.content}
          </div>
          {d1.editorial_name ? (
            <h1 className="text-2xl font-semibold">{d1.editorial_name}</h1>
          ) : (
            <h1 className="sr-only">{d1.accessible_name}</h1>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            <KaomojiRankingBadge
              popularRank={recordRank.popularRank}
              trendingRank={recordRank.trendingRank}
              status={recordRank.status}
            />
          </div>
          <KaomojiDetailActions
            canonicalId={d1.canonical_id}
            slug={d1.slug}
            content={d1.content}
            accessibleName={d1.accessible_name}
          />
        </header>
        {d1.meaning ? (
          <section className="prose max-w-2xl mx-auto">
            <h2>Meaning</h2>
            <p>{d1.meaning}</p>
            {d1.common_usage ? <p className="text-muted">{d1.common_usage}</p> : null}
          </section>
        ) : null}
        <KaomojiRelatedSection similar={relatedBundle.similar} related={relatedBundle.related} />
      </div>
    );
  }

  if (!kaomojiDataExists()) notFound();

  const record = getEditorialBySlug(slug);
  if (!record || !record.is_public) notFound();
  const relatedBundle = getRelatedEditorialBundle(record.canonical_id);
  const primaryCat = record.emojiquick_categories[0];

  return (
    <div className="page-shell space-y-8 pb-12">
      <KaomojiViewTracker canonicalId={record.canonical_id} slug={record.slug} />
      <JsonLd data={buildKaomojiWebPageJsonLd(record)} />
      <JsonLd
        data={
          primaryCat
            ? {
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: "https://emojiquick.com" },
                  { "@type": "ListItem", position: 2, name: "Kaomoji", item: "https://emojiquick.com/kaomoji" },
                  {
                    "@type": "ListItem",
                    position: 3,
                    name: `${primaryCat.label} kaomoji`,
                    item: `https://emojiquick.com/kaomoji/${primaryCat.slug}`,
                  },
                  {
                    "@type": "ListItem",
                    position: 4,
                    name: record.editorial_name ?? record.accessible_name,
                    item: `https://emojiquick.com/kaomoji/${slug}`,
                  },
                ],
              }
            : buildKaomojiBreadcrumbJsonLd(record)
        }
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Kaomoji", path: "/kaomoji" },
          ...(primaryCat && isCuratedIntentSlug(primaryCat.slug)
            ? [{ name: `${primaryCat.label} kaomoji`, path: `/kaomoji/${primaryCat.slug}` }]
            : []),
          { name: record.editorial_name ?? record.canonical_content.slice(0, 20), path: `/kaomoji/${slug}` },
        ]}
      />
      <header className="space-y-4 text-center">
        <div className="text-4xl sm:text-5xl break-all" aria-label={record.accessible_name}>
          {record.canonical_content}
        </div>
        {record.editorial_name ? (
          <h1 className="text-2xl font-semibold">{record.editorial_name}</h1>
        ) : (
          <h1 className="sr-only">{record.accessible_name}</h1>
        )}
        <KaomojiDetailActions
          canonicalId={record.canonical_id}
          slug={record.slug}
          content={record.canonical_content}
          accessibleName={record.accessible_name}
        />
      </header>
      {record.meaning ? (
        <section className="prose max-w-2xl mx-auto">
          <h2>Meaning</h2>
          <p>{record.meaning}</p>
          {record.common_usage ? <p className="text-muted">{record.common_usage}</p> : null}
          <p className="text-xs text-muted">EmojiQuick editorial — category-derived, not an official Unicode name.</p>
        </section>
      ) : null}
      <section className="space-y-2 max-w-2xl mx-auto">
        <h2 className="text-lg font-semibold">Keywords</h2>
        <div className="flex flex-wrap gap-2">
          {record.emojiquick_keywords.slice(0, 12).map((k) => (
            <span key={k} className="chip">
              {k}
            </span>
          ))}
        </div>
      </section>
      <nav className="flex flex-wrap gap-2 text-sm" aria-label="Categories">
        {record.emojiquick_categories.map((c) => (
          <Link
            key={c.slug}
            href={isCuratedIntentSlug(c.slug) ? `/kaomoji/${c.slug}` : `/kaomoji/search?q=${encodeURIComponent(c.label)}`}
            className="chip"
          >
            {c.label}
          </Link>
        ))}
      </nav>
      <KaomojiRelatedSection similar={relatedBundle.similar} related={relatedBundle.related} />
    </div>
  );
}
