import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PlatformSampleComparisonGrid } from "@/components/emoji/platform-sample-comparison-grid";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { buildSampleComparisonItems } from "@/lib/emoji/platforms/comparison-builder";
import {
  buildPlatformPagePath,
  getPlatformPageGuide,
  isPlatformPageSlug,
  OPEN_SOURCE_SAMPLE_SLUGS,
  PLATFORM_PAGE_SLUGS,
} from "@/lib/emoji/platforms/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PLATFORM_PAGE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const guide = getPlatformPageGuide(slug);
  if (!guide) return { title: "Platform Not Found" };
  return createPageMetadata({
    title: guide.title,
    description: guide.description,
    path: buildPlatformPagePath(guide.slug as (typeof PLATFORM_PAGE_SLUGS)[number]),
  });
}

export default async function EmojiPlatformPage({ params }: Props) {
  const { slug } = await params;
  if (!isPlatformPageSlug(slug)) notFound();
  const guide = getPlatformPageGuide(slug);
  if (!guide) notFound();

  const path = buildPlatformPagePath(slug);
  const sampleItems =
    guide.slug === "open-source-styles"
      ? buildSampleComparisonItems(OPEN_SOURCE_SAMPLE_SLUGS)
      : [];

  return (
    <div className="page-shell space-y-8 pb-12">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: guide.h1,
          url: `https://emojiquick.com${path}`,
          description: guide.description,
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: "https://emojiquick.com" },
            { "@type": "ListItem", position: 2, name: "Emoji", item: "https://emojiquick.com/emoji" },
            { "@type": "ListItem", position: 3, name: "Platforms", item: "https://emojiquick.com/emoji/platforms" },
            { "@type": "ListItem", position: 4, name: guide.h1, item: `https://emojiquick.com${path}` },
          ],
        }}
      />
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: "Emoji", path: "/emoji" },
          { name: "Platforms", path: "/emoji/platforms" },
          { name: guide.h1, path },
        ]}
      />
      <header className="space-y-3 max-w-3xl">
        <h1 className="text-3xl font-bold">{guide.h1}</h1>
        <p className="text-muted">{guide.description}</p>
      </header>

      <section className="prose max-w-3xl space-y-4">
        <p>{guide.intro}</p>
        <h2 className="text-lg font-semibold not-prose">Rendering notes</h2>
        <p className="text-muted">{guide.renderingNotes}</p>
        {guide.availability ? (
          <>
            <h2 className="text-lg font-semibold not-prose">Typical availability</h2>
            <p className="text-muted">{guide.availability}</p>
          </>
        ) : null}
        {!guide.hasVerifiedArtwork ? (
          <p className="text-sm text-muted border-l-4 border-border pl-4">
            Platform artwork may vary on your device. EmojiQuick does not host proprietary vendor artwork for this
            platform.
          </p>
        ) : guide.artworkProxy ? (
          <p className="text-sm text-muted border-l-4 border-border pl-4">
            When reference artwork appears on emoji detail pages, it comes from verified open-source sets — not a
            live vendor screenshot.
          </p>
        ) : null}
      </section>

      {guide.slug === "emoji-vs-kaomoji" ? (
        <section className="space-y-3 max-w-3xl">
          <h2 className="text-xl font-semibold">Quick comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm border border-border rounded-xl">
              <thead>
                <tr className="bg-surface-muted/50">
                  <th scope="col" className="p-3 text-left font-semibold">
                    Aspect
                  </th>
                  <th scope="col" className="p-3 text-left font-semibold">
                    Emoji
                  </th>
                  <th scope="col" className="p-3 text-left font-semibold">
                    Kaomoji
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <th scope="row" className="p-3 font-medium">
                    Nature
                  </th>
                  <td className="p-3 text-muted">Unicode character / sequence</td>
                  <td className="p-3 text-muted">Text composition</td>
                </tr>
                <tr className="border-t border-border">
                  <th scope="row" className="p-3 font-medium">
                    Platform artwork
                  </th>
                  <td className="p-3 text-muted">Often platform-specific emoji fonts</td>
                  <td className="p-3 text-muted">Plain text — generally consistent</td>
                </tr>
                <tr className="border-t border-border">
                  <th scope="row" className="p-3 font-medium">
                    EmojiQuick
                  </th>
                  <td className="p-3 text-muted">
                    <Link href="/emoji" className="underline">
                      Emoji pages
                    </Link>{" "}
                    + open-source artwork
                  </td>
                  <td className="p-3 text-muted">
                    <Link href="/kaomoji" className="underline">
                      Kaomoji hub
                    </Link>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {guide.slug === "open-source-styles" ? (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Sample side-by-side comparison</h2>
          <p className="text-sm text-muted max-w-3xl">
            Only verified open-source artwork publicly served on EmojiQuick is shown. Designs differ; Unicode code
            points are identical.
          </p>
          <PlatformSampleComparisonGrid items={sampleItems} />
        </section>
      ) : null}

      {guide.relatedSlugs.length > 0 ? (
        <nav className="space-y-2" aria-label="Related platform pages">
          <h2 className="text-lg font-semibold">Related</h2>
          <ul className="flex flex-wrap gap-2">
            {guide.relatedSlugs.filter(isPlatformPageSlug).map((rel) => {
              const g = getPlatformPageGuide(rel)!;
              return (
                <li key={rel}>
                  <Link href={buildPlatformPagePath(rel)} className="chip">
                    {g.h1}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/emoji/platforms" className="pill-link">
          All platforms
        </Link>
        <Link href="/emoji" className="pill-link">
          Browse emoji
        </Link>
        <Link href="/licenses" className="pill-link">
          Licenses
        </Link>
      </div>
    </div>
  );
}
