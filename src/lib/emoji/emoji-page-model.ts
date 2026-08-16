import type { EmojiEnrichmentRecord, EnrichmentVariantLink } from "./enrichment-types";
import { expandArtworkFromRecord, type ArtworkIntelSummary } from "./artwork-intelligence";
import { filterPublicDefinitions } from "@/lib/master/public/asset-rights";
import { sortVariantLinks, VARIANT_KIND_ORDER } from "./variant-intelligence";
import type { BrowsableEmoji } from "./types";
import { isOpenMojiExtra } from "./types";

const VARIANT_GROUP_LABELS: Record<EnrichmentVariantLink["kind"], string> = {
  "skin-tone": "Skin tone",
  gender: "Gender",
  profession: "Profession",
  family: "Family",
  couple: "Couple & relationship",
  zwj: "ZWJ sequences",
  flag: "Flag forms",
  keycap: "Keycap forms",
  related: "Related forms",
  sequence: "Related forms",
};

export interface EmojiMeaningView {
  readonly summary: string | null;
  readonly definitions: ReadonlyArray<{ readonly text: string; readonly source: string }>;
  readonly relatedConcepts: readonly string[];
}

export interface EmojiNamesView {
  readonly officialName: string | null;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly keywords: readonly string[];
  readonly searchTerms: readonly string[];
  readonly shortcodes: readonly string[];
}

export interface VariantGroupView {
  readonly kind: EnrichmentVariantLink["kind"];
  readonly title: string;
  readonly variants: ReadonlyArray<{
    readonly slug: string;
    readonly label: string;
    readonly emoji: BrowsableEmoji;
  }>;
}

export interface RelatedEmojiGroupView {
  readonly id: "variants" | "semantic" | "subcategory" | "category";
  readonly title: string;
  readonly description: string;
  readonly emojis: readonly BrowsableEmoji[];
}

export interface EmojiTechnicalView {
  readonly emoji: string;
  readonly officialName: string | null;
  readonly unicodeVersion: string;
  readonly codePointString: string;
  readonly hexcode: string;
  readonly codePoints: readonly string[];
  readonly qualificationStatus: string;
  readonly sequenceKind: string;
  readonly hasVariationSelector: boolean;
  readonly hasZeroWidthJoiner: boolean;
  readonly isRgi: boolean;
}

export interface ArtworkProviderView {
  readonly id: string;
  readonly name: string;
  readonly available: boolean;
  readonly publiclyServed: boolean;
  readonly license: string | null;
  readonly formats: readonly string[];
  readonly assetCount: number;
  readonly status: "available" | "indexed" | "missing";
  readonly statusLabel: string;
}

export interface ArtworkPanelView {
  readonly summary: ArtworkIntelSummary;
  readonly providers: readonly ArtworkProviderView[];
  readonly baseSlug: string | null;
}

function uniqueTerms(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function isBaselineTerm(emoji: BrowsableEmoji, term: string): boolean {
  const lower = term.toLowerCase();
  const baseline = [
    emoji.name.toLowerCase(),
    emoji.slug.replace(/-/g, " ").toLowerCase(),
    ...emoji.keywords.map((keyword) => keyword.toLowerCase()),
    ...emoji.shortcodes.map((shortcode) => shortcode.toLowerCase()),
  ];
  return baseline.includes(lower);
}

export function buildMeaningView(
  emoji: BrowsableEmoji,
  enrichment: EmojiEnrichmentRecord | null,
): EmojiMeaningView {
  const definitions = filterPublicDefinitions(enrichment?.definitions ?? []);
  const summary = definitions[0]?.text ?? null;
  const relatedConcepts = uniqueTerms(
    (enrichment?.searchTerms ?? []).filter((term) => !isBaselineTerm(emoji, term)),
  ).slice(0, 8);

  return {
    summary,
    definitions,
    relatedConcepts,
  };
}

export function buildNamesView(
  emoji: BrowsableEmoji,
  enrichment: EmojiEnrichmentRecord | null,
): EmojiNamesView {
  const aliases = uniqueTerms(
    (enrichment?.aliases ?? []).filter(
      (alias) => alias.toLowerCase() !== emoji.name.toLowerCase(),
    ),
  );
  const searchTerms = uniqueTerms(
    (enrichment?.searchTerms ?? []).filter((term) => !isBaselineTerm(emoji, term)),
  );

  return {
    officialName: enrichment?.officialName ?? null,
    displayName: emoji.name,
    aliases,
    keywords: emoji.keywords,
    searchTerms,
    shortcodes: emoji.shortcodes,
  };
}

export function buildVariantGroups(
  enrichment: EmojiEnrichmentRecord | null,
  resolveEmoji: (slug: string) => BrowsableEmoji | undefined,
): VariantGroupView[] {
  if (!enrichment?.variants.length) {
    return [];
  }

  const orderedKinds = [...VARIANT_KIND_ORDER];
  const groups = new Map<EnrichmentVariantLink["kind"], VariantGroupView["variants"][number][]>();

  const links = sortVariantLinks(enrichment.variants);
  for (const variant of links) {
    const resolved = resolveEmoji(variant.slug);
    if (!resolved) continue;
    const bucket = groups.get(variant.kind) ?? [];
    bucket.push({
      slug: variant.slug,
      label: variant.label,
      emoji: resolved,
    });
    groups.set(variant.kind, bucket);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => orderedKinds.indexOf(left) - orderedKinds.indexOf(right))
    .map(([kind, variants]) => ({
      kind,
      title: VARIANT_GROUP_LABELS[kind],
      variants,
    }));
}

export function buildTechnicalView(
  emoji: BrowsableEmoji,
  enrichment: EmojiEnrichmentRecord | null,
): EmojiTechnicalView {
  const extra = isOpenMojiExtra(emoji);

  return {
    emoji: emoji.emoji,
    officialName: enrichment?.officialName ?? null,
    unicodeVersion: emoji.unicodeVersion,
    codePointString: emoji.codePointString,
    hexcode: emoji.hexcode,
    codePoints: emoji.codePoints,
    qualificationStatus: extra ? "OpenMoji Extra" : emoji.sequence.status.replace(/-/g, " "),
    sequenceKind: extra ? "openmoji-extra" : emoji.sequence.kind.replace(/-/g, " "),
    hasVariationSelector: extra ? false : emoji.sequence.hasVariationSelector,
    hasZeroWidthJoiner: extra ? false : emoji.sequence.hasZeroWidthJoiner,
    isRgi: extra ? false : emoji.sequence.isRGI,
  };
}

const PROVIDER_LABELS: Record<string, string> = {
  openmoji: "OpenMoji",
  noto: "Noto Emoji",
  twemoji: "Twemoji",
  fluent: "Fluent Emoji",
};

const STATUS_LABELS: Record<ArtworkProviderView["status"], string> = {
  available: "Available",
  indexed: "Indexed",
  missing: "Not indexed",
};

export function buildArtworkPanelView(
  enrichment: EmojiEnrichmentRecord | null,
): ArtworkPanelView {
  const summary = expandArtworkFromRecord(enrichment?.artwork);
  const providers: ArtworkProviderView[] = summary.providers.map((provider) => ({
    id: provider.provider,
    name: PROVIDER_LABELS[provider.provider] ?? provider.provider,
    available: provider.indexed,
    publiclyServed: provider.publiclyServed,
    license: provider.license,
    formats: provider.formats,
    assetCount: provider.assetCount,
    status: provider.status,
    statusLabel: provider.publiclyServed
      ? "Publicly served"
      : provider.indexed
        ? "Not publicly served"
        : STATUS_LABELS.missing,
  }));

  return {
    summary,
    providers,
    baseSlug: enrichment?.variantBaseSlug ?? null,
  };
}

export function buildArtworkProviderViews(
  enrichment: EmojiEnrichmentRecord | null,
): ArtworkProviderView[] {
  return buildArtworkPanelView(enrichment).providers.filter((provider) => provider.available);
}

export function buildEmojiPageDescription(
  emoji: BrowsableEmoji,
  enrichment: EmojiEnrichmentRecord | null,
): string {
  const extra = isOpenMojiExtra(emoji);
  const publicDefinitions = filterPublicDefinitions(enrichment?.definitions ?? []);
  const meaning = publicDefinitions[0]?.text;
  const keywordText = emoji.keywords.slice(0, 4).join(", ");

  if (meaning) {
    const trimmed = meaning.length > 140 ? `${meaning.slice(0, 137)}...` : meaning;
    return `Copy ${emoji.name} ${emoji.emoji}. ${trimmed} Unicode ${emoji.codePointString}.`;
  }

  if (extra) {
    return `Copy ${emoji.name} ${emoji.emoji}. OpenMoji Extra (${emoji.codePointString}).${keywordText ? ` Keywords: ${keywordText}.` : ""}`;
  }

  return `Copy ${emoji.name} ${emoji.emoji}. Unicode ${emoji.codePointString}.${keywordText ? ` Keywords: ${keywordText}.` : ""} Browse meaning, variants, and related emojis.`;
}
