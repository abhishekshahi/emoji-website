import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import {
  EmojiDetailActions,
  RelatedEmojiGrid,
} from "@/components/emoji/emoji-detail-actions";
import { EmojiArtwork } from "@/components/emoji/emoji-artwork";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import {
  getAllEmojiSlugs,
  getCategoryLabel,
  getEmojiBySlug,
  getRelatedEmojis,
} from "@/lib/emoji/data";
import { buildEmojiPageJsonLd } from "@/lib/seo/json-ld";
import { createEmojiPageMetadata } from "@/lib/seo/metadata";

interface EmojiPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllEmojiSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: EmojiPageProps): Promise<Metadata> {
  const { slug } = await params;
  const emoji = getEmojiBySlug(slug);

  if (!emoji) {
    return {
      title: "Emoji not found",
    };
  }

  return createEmojiPageMetadata({
    name: emoji.name,
    emoji: emoji.emoji,
    slug: emoji.slug,
    keywords: emoji.keywords,
    codePointString: emoji.codePointString,
    artworkPath: getOpenMojiArtworkPath(emoji.hexcode),
  });
}

export default async function EmojiDetailPage({ params }: EmojiPageProps) {
  const { slug } = await params;
  const emoji = getEmojiBySlug(slug);

  if (!emoji) {
    notFound();
  }

  const relatedEmojis = getRelatedEmojis(emoji);
  const categoryLabel = getCategoryLabel(emoji.category);
  const description = `Copy ${emoji.name} ${emoji.emoji}. Unicode ${emoji.codePointString}. Keywords: ${emoji.keywords.slice(0, 8).join(", ")}.`;

  const jsonLd = buildEmojiPageJsonLd({
    name: emoji.name,
    emoji: emoji.emoji,
    slug: emoji.slug,
    description,
    codePointString: emoji.codePointString,
    artworkPath: getOpenMojiArtworkPath(emoji.hexcode),
    categoryLabel,
    categoryId: emoji.category,
  });

  return (
    <div className="page-shell space-y-10">
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: categoryLabel, path: `/category/${emoji.category}` },
          { name: `${emoji.name} ${emoji.emoji}`, path: `/emoji/${emoji.slug}` },
        ]}
      />

      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent-strong">
          {categoryLabel}
        </p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {emoji.name} {emoji.emoji}
        </h1>
        <p className="max-w-2xl text-muted">
          Copy {emoji.name} instantly, explore Unicode details, and browse related
          emojis.
        </p>
      </header>

      <section className="card-surface grid gap-8 p-6 sm:p-8 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col items-center justify-center gap-4 rounded-[1.5rem] bg-surface-muted/80 p-8">
          <EmojiArtwork
            hexcode={emoji.hexcode}
            name={emoji.name}
            emoji={emoji.emoji}
            size="detail"
            priority
          />
          <span className="text-4xl leading-none" aria-label={`Native ${emoji.name} emoji`}>
            {emoji.emoji}
          </span>
        </div>

        <div className="space-y-6">
          <EmojiDetailActions emoji={emoji} />

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">What does {emoji.name} mean?</h2>
            <p className="text-muted">
              {emoji.name} is listed in the {categoryLabel.toLowerCase()} category
              {emoji.keywords.length > 0
                ? ` and is commonly associated with ${emoji.keywords.slice(0, 5).join(", ")}.`
                : "."}
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">How to copy {emoji.name}</h2>
            <p className="text-muted">
              Use the copy buttons to copy {emoji.emoji}, its Unicode code points,
              hex code{emoji.shortcodes.length > 0 ? ", or shortcode" : ""}. You can
              also click any emoji card throughout the site for one-click copy.
            </p>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-semibold text-muted">Unicode code points</dt>
              <dd className="mt-1 font-mono text-sm">{emoji.codePointString}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Hex code</dt>
              <dd className="mt-1 font-mono text-sm">{emoji.hexcode}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Category</dt>
              <dd className="mt-1">{categoryLabel}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Subcategory</dt>
              <dd className="mt-1 capitalize">
                {emoji.subcategory.replace(/-/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Unicode version</dt>
              <dd className="mt-1">{emoji.unicodeVersion}</dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-muted">Sequence type</dt>
              <dd className="mt-1 capitalize">{emoji.sequence.kind.replace(/-/g, " ")}</dd>
            </div>
          </dl>

          {emoji.keywords.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-muted">Keywords</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {emoji.keywords.map((keyword) => (
                  <li
                    key={keyword}
                    className="rounded-full bg-surface-muted px-3 py-1 text-sm"
                  >
                    {keyword}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {emoji.shortcodes.length > 0 ? (
            <div>
              <h2 className="text-sm font-semibold text-muted">Shortcodes</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {emoji.shortcodes.map((shortcode) => (
                  <li
                    key={shortcode}
                    className="rounded-full border border-border px-3 py-1 font-mono text-sm"
                  >
                    :{shortcode}:
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="section-title">Related Emojis</h2>
        <RelatedEmojiGrid emojis={relatedEmojis} />
      </section>
    </div>
  );
}
