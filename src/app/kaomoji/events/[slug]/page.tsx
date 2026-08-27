import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { KaomojiSeoHubPage } from "@/components/kaomoji/kaomoji-seo-hub-page";
import { loadEventKaomoji } from "@/lib/kaomoji/events/loader-server";
import {
  buildEventFaq,
  buildEventPagePath,
  EVENT_PAGE_SLUGS,
  getEventGuide,
  getEventTimingDisplay,
  isEventPageSlug,
} from "@/lib/kaomoji/events/registry";
import { loadCollections } from "@/lib/kaomoji/product/loader";
import { resolveIntentTaxonomy } from "@/lib/kaomoji/seo/intent-registry";
import {
  buildKaomojiEventBreadcrumbJsonLd,
  buildKaomojiEventCollectionJsonLd,
} from "@/lib/kaomoji/seo/structured-data";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return EVENT_PAGE_SLUGS.map((slug) => ({ slug }));
}

function collectionLink(slug: string | null): { href: string; label: string } | null {
  if (!slug) return null;
  const col = loadCollections().find((c) => c.slug === slug);
  if (!col) return null;
  return { href: `/kaomoji/collections/${col.slug}/page/1`, label: col.title };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getEventGuide(slug);
  if (!guide) return { title: "Event Not Found" };
  const data = await loadEventKaomoji(guide, 1);
  if (!data) return { title: "Event Not Found" };
  return createPageMetadata({
    title: guide.title,
    description: guide.description,
    path: buildEventPagePath(guide.slug as (typeof EVENT_PAGE_SLUGS)[number]),
  });
}

export default async function KaomojiEventPage({ params }: Props) {
  const { slug } = await params;
  if (!isEventPageSlug(slug)) notFound();
  const guide = getEventGuide(slug);
  if (!guide) notFound();

  const data = await loadEventKaomoji(guide, 48);
  if (!data) notFound();

  const path = buildEventPagePath(guide.slug as (typeof EVENT_PAGE_SLUGS)[number]);
  const timing = getEventTimingDisplay(guide);
  const colLink = collectionLink(guide.collectionSlug);

  return (
    <KaomojiSeoHubPage
      path={path}
      title={guide.title}
      h1={guide.h1}
      description={guide.description}
      intro={guide.intro}
      itemCount={data.total}
      items={data.items}
      breadcrumbs={[
        { name: "Home", path: "/" },
        { name: "Kaomoji", path: "/kaomoji" },
        { name: "Events", path: "/kaomoji/events" },
        { name: guide.h1, path },
      ]}
      jsonLd={[
        buildKaomojiEventCollectionJsonLd(guide.h1, guide.slug, data.total, guide.description),
        buildKaomojiEventBreadcrumbJsonLd(guide.h1, guide.slug),
      ]}
      extra={
        <div className="space-y-6 max-w-3xl">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">About this occasion</h2>
            <p className="text-muted">{guide.context}</p>
          </section>
          {timing ? (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold">{timing.label}</h2>
              <p className="text-muted">{timing.detail}</p>
            </section>
          ) : null}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">When to use these kaomoji</h2>
            <p className="text-muted">{guide.usage}</p>
          </section>
        </div>
      }
      relatedIntents={guide.intentSlugs
        .map((s) => {
          const cat = resolveIntentTaxonomy(s);
          if (!cat) return null;
          return { href: `/kaomoji/${s}`, label: `${cat.label} kaomoji` };
        })
        .filter((x): x is { href: string; label: string } => Boolean(x))}
      relatedCollections={colLink ? [colLink] : []}
      relatedEvents={guide.relatedEventSlugs
        .filter((s) => isEventPageSlug(s))
        .map((s) => {
          const g = getEventGuide(s)!;
          return { href: buildEventPagePath(s), label: g.h1 };
        })}
      faq={buildEventFaq(guide, timing)}
    />
  );
}
