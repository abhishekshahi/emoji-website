import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPageTracker, TrackedContentLink } from "@/components/analytics/content-analytics";
import { HubLayout } from "@/components/hub/hub-layout";
import { COLLECTION_SLUGS, getCollection } from "@/lib/content/collections/registry";
import { getCombination } from "@/lib/content/combinations/registry";
import { createPageMetadata } from "@/lib/seo/metadata";

interface CollectionPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return COLLECTION_SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: CollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) return { title: "Collection not found" };
  return createPageMetadata({
    title: collection.title,
    description: collection.description,
    path: `/collections/${slug}`,
  });
}

export default async function CollectionPage({ params }: CollectionPageProps) {
  const { slug } = await params;
  const collection = getCollection(slug);
  if (!collection) notFound();

  const trackerCanonicalId = collection.emojiIds[0] ?? "unicode:1F525";

  return (
    <HubLayout
      path={`/collections/${slug}`}
      title={collection.title}
      description={collection.description}
      eyebrow="Collection"
      links={[
        ...(collection.topicSlug
          ? [{ href: `/topics/${collection.topicSlug}`, label: "Related topic" }]
          : []),
        { href: "/collections", label: "All collections" },
      ]}
    >
      <ContentPageTracker kind="collection_view" canonicalId={trackerCanonicalId} slug={slug} />

      {collection.context ? (
        <p className="text-sm text-muted">Context: {collection.context}</p>
      ) : null}

      <section className="card-surface space-y-4 p-6">
        <h2 className="text-xl font-semibold">Emojis in this collection</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {collection.emojiSlugs.map((emojiSlug, index) => (
            <li key={emojiSlug}>
              <TrackedContentLink
                kind="collection_click"
                canonicalId={collection.emojiIds[index] ?? trackerCanonicalId}
                slug={slug}
                href={`/emoji/${emojiSlug}`}
                className="text-accent-strong underline"
              >
                {emojiSlug.replace(/-/g, " ")}
              </TrackedContentLink>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">Source: EmojiQuick editorial collection</p>
      </section>

      {(collection.relatedCombinationSlugs?.length ?? 0) > 0 ? (
        <section className="card-surface space-y-3 p-6">
          <h2 className="text-xl font-semibold">Related combinations</h2>
          <ul className="space-y-2">
            {collection.relatedCombinationSlugs!.map((comboSlug) => {
              const combo = getCombination(comboSlug);
              if (!combo) return null;
              return (
                <li key={comboSlug}>
                  <Link href={`/combinations/${comboSlug}`} className="text-accent-strong underline">
                    {combo.sequence} — {combo.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <p className="text-sm">
        <Link href="/collections" className="text-accent-strong underline">
          All collections
        </Link>
      </p>
    </HubLayout>
  );
}
