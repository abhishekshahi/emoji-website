import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getArtworkPath } from "@/lib/artwork/providers";
import { EmojiArtworkPanel } from "@/components/emoji/emoji-artwork-panel";
import { EmojiPlatformComparisonSection } from "@/components/emoji/emoji-platform-comparison-section";
import { EmojiDetailHero } from "@/components/emoji/emoji-detail-hero";
import { EmojiMeaningSection } from "@/components/emoji/emoji-meaning-section";
import { EmojiNamesKeywordsSection } from "@/components/emoji/emoji-names-keywords-section";
import { EmojiRelatedGroups } from "@/components/emoji/emoji-related-groups";
import { EmojiTechnicalDetails } from "@/components/emoji/emoji-technical-details";
import { EmojiVariantExplorer } from "@/components/emoji/emoji-variant-explorer";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { getBrowsableEmojiBySlug } from "@/lib/emoji/browsable-data";
import { getIndexableEmojiPageSlugs } from "@/lib/master/public/identity-slug-map";
import { getEmojiEnrichmentBySlug } from "@/lib/emoji/enrichment";
import {
  buildArtworkPanelView,
  buildEmojiPageDescription,
  buildMeaningView,
  buildNamesView,
  buildTechnicalView,
  buildVariantGroups,
} from "@/lib/emoji/emoji-page-model";
import { filterPublicDefinitions } from "@/lib/master/public/asset-rights";
import { getCategoryLabel } from "@/lib/emoji/data";
import { getEnrichedRelatedEmojiGroups } from "@/lib/emoji/related-emojis";
import { isOpenMojiExtra } from "@/lib/emoji/types";
import { buildEmojiPageJsonLd } from "@/lib/seo/json-ld";
import { absoluteUrl, createEmojiPageMetadata, withEmojiHreflangAlternates } from "@/lib/seo/metadata";
import {
  OPENMOJI_LICENSE,
  OPENMOJI_LICENSE_URL,
  OPENMOJI_PROJECT_URL,
} from "@/lib/site/config";
import { EmojiViewTracker } from "@/components/analytics/emoji-view-tracker";
import { hexcodeToCanonicalId } from "@/lib/content/analytics/validation";
import { MasterEmojiPanelsGate } from "@/components/master/master-emoji-panels-gate";
import { MasterIdentityDetailPage } from "@/components/master/master-identity-detail-page";
import {
  getActiveEmojiSitemapSlugs,
  isActiveApprovedRedirectSourceSlug,
  resolveActiveEmojiPageSlug,
} from "@/lib/master/integration/seo-canary/active-migration";
import { createMasterIdentityPageMetadata } from "@/lib/seo/metadata";
import { buildEmojiPlatformComparisonView } from "@/lib/emoji/platforms/comparison-builder";

async function resolveOnDemandEmojiPage(slug: string) {
  const { resolveEmojiPage } = await import("@/lib/master/public/identity-page-resolver");
  return resolveEmojiPage(slug);
}

interface EmojiPageProps {
  params: Promise<{ slug: string }>;
}

/** Phase 8.62-A: all 6955 canonical identities are pre-rendered; no on-demand emoji pages. */
export const dynamicParams = false;

export async function generateStaticParams() {
  const canonicalSlugs = getActiveEmojiSitemapSlugs(getIndexableEmojiPageSlugs());
  return canonicalSlugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: EmojiPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (isActiveApprovedRedirectSourceSlug(slug)) {
    return {
      title: "Emoji redirect",
    };
  }

  const { lookupSlug, canonicalSlug } = resolveActiveEmojiPageSlug(slug);
  const emoji = getBrowsableEmojiBySlug(lookupSlug);

  if (emoji) {
    const enrichment = getEmojiEnrichmentBySlug(canonicalSlug);
    const publicDefinitions = filterPublicDefinitions(enrichment?.definitions ?? []);
    return withEmojiHreflangAlternates(
      createEmojiPageMetadata({
        name: emoji.name,
        emoji: emoji.emoji,
        slug: canonicalSlug,
        keywords: [
          ...emoji.keywords,
          ...(enrichment?.searchTerms.slice(0, 8) ?? []),
        ],
        codePointString: emoji.codePointString,
        artworkPath: getArtworkPath(emoji.hexcode),
        meaningSnippet: publicDefinitions[0]?.text,
        categoryLabel: getCategoryLabel(emoji.category),
      }),
      canonicalSlug,
    );
  }

  const resolved = await resolveOnDemandEmojiPage(canonicalSlug);
  if (resolved?.kind === "master-identity" && resolved.identity) {
    return withEmojiHreflangAlternates(
      createMasterIdentityPageMetadata({
        name: resolved.identity.officialName,
        emoji: resolved.identity.glyph ?? "",
        slug: canonicalSlug,
        keywords: [...resolved.identity.keywords],
        codePointString: resolved.identity.unicodeSequence ?? resolved.identity.hexcode ?? "",
        definition: resolved.identity.definitions[0],
      }),
      canonicalSlug,
    );
  }

  return {
    title: "Emoji not found",
  };
}

export default async function EmojiDetailPage({ params }: EmojiPageProps) {
  const { slug } = await params;
  const { lookupSlug, canonicalSlug } = resolveActiveEmojiPageSlug(slug);
  const emoji = getBrowsableEmojiBySlug(lookupSlug);

  if (!emoji) {
    const resolved = await resolveOnDemandEmojiPage(canonicalSlug);
    if (resolved?.kind === "master-identity" && resolved.identity) {
      return <MasterIdentityDetailPage slug={canonicalSlug} identity={resolved.identity} />;
    }
    notFound();
  }

  const enrichment = getEmojiEnrichmentBySlug(canonicalSlug);
  const categoryLabel = getCategoryLabel(emoji.category);
  const extra = isOpenMojiExtra(emoji);
  const pageUrl = absoluteUrl(`/emoji/${canonicalSlug}`);
  const meaning = buildMeaningView(emoji, enrichment);
  const names = buildNamesView(emoji, enrichment);
  const technical = buildTechnicalView(emoji, enrichment);
  const variantGroups = buildVariantGroups(enrichment, getBrowsableEmojiBySlug);
  const relatedGroups = getEnrichedRelatedEmojiGroups(emoji);
  const artworkPanel = buildArtworkPanelView(enrichment);
  const platformComparison = buildEmojiPlatformComparisonView(emoji);
  const description = buildEmojiPageDescription(emoji, enrichment);

  const jsonLd = buildEmojiPageJsonLd({
    name: emoji.name,
    emoji: emoji.emoji,
    slug: canonicalSlug,
    description,
    codePointString: emoji.codePointString,
    artworkPath: getArtworkPath(emoji.hexcode),
    categoryLabel,
    categoryId: emoji.category,
  });

  return (
    <div className="page-shell space-y-10 pb-12">
      <JsonLd data={jsonLd} />
      <EmojiViewTracker canonicalId={hexcodeToCanonicalId(emoji.hexcode)} slug={canonicalSlug} />

      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: categoryLabel, path: `/category/${emoji.category}` },
          { name: emoji.name, path: `/emoji/${canonicalSlug}` },
        ]}
      />

      <EmojiDetailHero
        emoji={emoji}
        canonicalSlug={canonicalSlug}
        categoryLabel={categoryLabel}
        summary={meaning.summary}
        pageUrl={pageUrl}
      />

      <EmojiMeaningSection emojiName={emoji.name} meaning={meaning} />

      <EmojiNamesKeywordsSection names={names} />

      <EmojiVariantExplorer
        groups={variantGroups}
        baseSlug={enrichment?.variantBaseSlug ?? null}
        currentSlug={canonicalSlug}
      />

      <EmojiTechnicalDetails technical={technical} emojiId={emoji.hexcode} />

      <EmojiArtworkPanel
        hexcode={emoji.hexcode}
        name={emoji.name}
        emoji={emoji.emoji}
        artwork={artworkPanel}
        openmojiAuthor={extra ? emoji.openmojiAuthor : undefined}
      />

      {!extra ? (
        <EmojiPlatformComparisonSection comparison={platformComparison} emojiSlug={canonicalSlug} />
      ) : null}

      <MasterEmojiPanelsGate emoji={emoji} />

      <EmojiRelatedGroups
        groups={relatedGroups}
        categoryLabel={categoryLabel}
        categoryId={emoji.category}
      />

      {extra ? (
        <section className="card-surface space-y-3 p-6 text-sm text-muted">
          <h2 className="text-base font-semibold text-foreground">OpenMoji Extra details</h2>
          <p>
            This symbol is part of the OpenMoji Extras collection and is not part of the standard
            Unicode emoji set.
          </p>
          <p>
            Artwork by {emoji.openmojiAuthor} via{" "}
            <Link href={OPENMOJI_PROJECT_URL} className="text-accent-strong underline">
              OpenMoji
            </Link>{" "}
            (
            <Link href={OPENMOJI_LICENSE_URL} className="text-accent-strong underline">
              {OPENMOJI_LICENSE}
            </Link>
            ).
          </p>
        </section>
      ) : null}
    </div>
  );
}
