import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { BrowsableEmoji, EmojiRecord, OpenMojiExtraRecord } from "../src/lib/emoji/types";
import type { CompactEmojiEnrichmentRecord, EmojiEnrichmentCompactFile } from "../src/lib/emoji/enrichment-compact-types";
import { compactEnrichmentRecord } from "../src/lib/emoji/enrichment-compact";
import { expandCompactRecord } from "../src/lib/emoji/enrichment-expand";
import { logicalEnrichmentEquals, toLogicalEnrichment } from "../src/lib/emoji/enrichment-logical";
import type {
  EmojiEnrichmentRecord,
  EnrichmentDefinition,
  EnrichmentRelatedLink,
  EnrichmentVariantLink,
} from "../src/lib/emoji/enrichment-types";
import { buildArtworkIntelSummary, compactArtworkForRecord } from "../src/lib/emoji/artwork-intelligence";
import {
  buildVariantGroupsMap,
  buildVariantLabel,
  classifyVariantKind,
  findVariantBaseSlug,
  getVariantBaseKey,
  sortVariantLinks,
} from "../src/lib/emoji/variant-intelligence";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..");
const MAX_SEARCH_TERMS = 25;
const MAX_DEFINITIONS = 2;
const MAX_VARIANTS = 16;
const MAX_RELATED = 10;

function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(rootDir, relativePath), "utf8")) as T;
}

function uniqueStrings(values: readonly string[]): string[] {
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

function readOpenMojiPublicHexcodes(): Set<string> {
  const manifest = readJson<{ artwork: Record<string, unknown> }>("src/data/openmoji-manifest.json");
  const extras = readJson<{ artwork: Record<string, unknown> }>("src/data/openmoji-extras-artwork-manifest.json");
  const hexcodes = new Set<string>();
  for (const hexcode of Object.keys(manifest.artwork)) hexcodes.add(hexcode.toUpperCase());
  for (const hexcode of Object.keys(extras.artwork)) hexcodes.add(hexcode.toUpperCase());
  return hexcodes;
}

function buildVariantGroups(emojis: BrowsableEmoji[]): Map<string, BrowsableEmoji[]> {
  return buildVariantGroupsMap(emojis);
}

interface ProductionMapEntry {
  productionId: string;
  productionHexcode: string;
  productionType: "standard" | "extra";
  canonicalId: string;
}

interface SearchIndexEntry {
  canonicalId: string;
  canonicalName: string;
  aliases: string[];
  keywords: string[];
  shortcodes: string[];
  semanticSearchTerms: string[];
}

interface SemanticIndexEntry {
  canonicalId: string;
  safeSearchTerms: Array<{ term: string; publicSearch: boolean }>;
}

interface DefinitionEntry {
  canonicalId: string;
  source: string;
  definition: string;
}

interface ArtworkIndexEntry {
  canonicalId: string;
  artwork: { openmoji: string[]; noto: string[]; twemoji: string[]; fluent: string[] };
}

function buildDeltaSearchTerms(emoji: BrowsableEmoji, terms: readonly string[]): string[] {
  const baseline = new Set<string>([
    emoji.name.toLowerCase(),
    emoji.slug.replace(/-/g, " ").toLowerCase(),
    ...emoji.keywords.map((keyword) => keyword.toLowerCase()),
    ...emoji.shortcodes.map((shortcode) => shortcode.toLowerCase()),
  ]);

  return uniqueStrings(
    terms.filter((term) => !baseline.has(term.toLowerCase())),
  ).slice(0, MAX_SEARCH_TERMS);
}

function buildSemanticNeighbors(
  canonicalId: string,
  termToCanonical: Map<string, Set<string>>,
  searchTerms: string[],
): string[] {
  const neighbors = new Set<string>();
  for (const term of searchTerms) {
    const bucket = termToCanonical.get(term.toLowerCase());
    if (!bucket) continue;
    for (const id of bucket) {
      if (id !== canonicalId) neighbors.add(id);
    }
  }
  return [...neighbors].slice(0, MAX_RELATED);
}

function main(): void {
  const standard = readJson<EmojiRecord[]>("src/data/emojis.json");
  const extras = readJson<OpenMojiExtraRecord[]>("src/data/openmoji-extras.json");
  const allEmojis: BrowsableEmoji[] = [...standard, ...extras];

  const productionMap = readJson<{
    standardRecords: { entries: ProductionMapEntry[] };
    extrasRecords: { entries: ProductionMapEntry[] };
  }>("src/data/master/integration/production-to-master-map.json");

  const hexToCanonical = new Map<string, string>();
  for (const entry of [...productionMap.standardRecords.entries, ...productionMap.extrasRecords.entries]) {
    hexToCanonical.set(
      `${entry.productionType}:${entry.productionHexcode.toUpperCase()}`,
      entry.canonicalId,
    );
  }

  const searchByCanonical = new Map<string, SearchIndexEntry>();
  for (const entry of readJson<SearchIndexEntry[]>("src/data/master/metadata/canonical-search-index.json")) {
    searchByCanonical.set(entry.canonicalId, entry);
  }

  const semanticByCanonical = new Map<string, SemanticIndexEntry>();
  for (const entry of readJson<SemanticIndexEntry[]>("src/data/master/semantic/canonical-semantic-index.json")) {
    semanticByCanonical.set(entry.canonicalId, entry);
  }

  const definitionsByCanonical = new Map<string, DefinitionEntry[]>();
  for (const entry of readJson<DefinitionEntry[]>("src/data/master/semantic/semantic-definitions-index.json")) {
    const bucket = definitionsByCanonical.get(entry.canonicalId) ?? [];
    bucket.push(entry);
    definitionsByCanonical.set(entry.canonicalId, bucket);
  }

  const artworkByCanonical = new Map<string, ArtworkIndexEntry>();
  for (const entry of readJson<ArtworkIndexEntry[]>("src/data/master/artwork/canonical-artwork-index.json")) {
    artworkByCanonical.set(entry.canonicalId, entry);
  }

  const slugByCanonical = new Map<string, string>();
  for (const emoji of allEmojis) {
    const productionType = "isOpenMojiExtra" in emoji && emoji.isOpenMojiExtra ? "extra" : "standard";
    const canonicalId = hexToCanonical.get(`${productionType}:${emoji.hexcode.toUpperCase()}`);
    if (!canonicalId) continue;
    slugByCanonical.set(canonicalId, emoji.slug);
  }

  const variantGroups = buildVariantGroups(allEmojis);
  const openMojiPublicHexcodes = readOpenMojiPublicHexcodes();

  const termToCanonical = new Map<string, Set<string>>();
  for (const [canonicalId, entry] of searchByCanonical) {
    if (!slugByCanonical.has(canonicalId)) continue;
    for (const term of [...entry.keywords, ...entry.semanticSearchTerms, ...entry.aliases]) {
      const key = term.toLowerCase();
      const bucket = termToCanonical.get(key) ?? new Set<string>();
      bucket.add(canonicalId);
      termToCanonical.set(key, bucket);
    }
  }

  const bySlug: Record<string, EmojiEnrichmentRecord> = {};
  const searchTermsById: Record<string, string[]> = {};

  for (const emoji of allEmojis) {
    const productionType = "isOpenMojiExtra" in emoji && emoji.isOpenMojiExtra ? "extra" : "standard";
    const canonicalId = hexToCanonical.get(`${productionType}:${emoji.hexcode.toUpperCase()}`);
    if (!canonicalId) continue;

    const searchEntry = searchByCanonical.get(canonicalId);
    const semanticEntry = semanticByCanonical.get(canonicalId);
    const artworkEntry = artworkByCanonical.get(canonicalId);

    const safeSemanticTerms =
      semanticEntry?.safeSearchTerms
        .filter((term) => term.publicSearch)
        .map((term) => term.term) ?? [];

    const searchTerms = uniqueStrings([
      ...(searchEntry?.keywords ?? []),
      ...(searchEntry?.aliases ?? []),
      // canonical search semanticSearchTerms are EmojiNet-derived — excluded from public index
      ...safeSemanticTerms,
      emoji.name,
      emoji.slug.replace(/-/g, " "),
    ]).slice(0, MAX_SEARCH_TERMS);

    const definitions: EnrichmentDefinition[] = [];

    const artworkSummary = buildArtworkIntelSummary({
      openmoji: artworkEntry?.artwork.openmoji ?? [],
      noto: artworkEntry?.artwork.noto ?? [],
      twemoji: artworkEntry?.artwork.twemoji ?? [],
      fluent: artworkEntry?.artwork.fluent ?? [],
      openmojiPubliclyAvailable: openMojiPublicHexcodes.has(emoji.hexcode.toUpperCase()),
    });
    const artwork = compactArtworkForRecord(artworkSummary);

    const variantGroup = variantGroups.get(getVariantBaseKey(emoji)) ?? [];
    const variantBaseSlug = findVariantBaseSlug(emoji, variantGroup);

    const variants: EnrichmentVariantLink[] = sortVariantLinks(
      variantGroup
        .filter((candidate) => candidate.slug !== emoji.slug)
        .map((candidate) => ({
          slug: candidate.slug,
          label: buildVariantLabel(emoji, candidate),
          kind: classifyVariantKind(emoji, candidate),
        })),
    ).slice(0, MAX_VARIANTS);

    const related: EnrichmentRelatedLink[] = [];
    const sameSubcategory = allEmojis.filter(
      (candidate) =>
        candidate.slug !== emoji.slug &&
        candidate.subcategory === emoji.subcategory &&
        candidate.category === emoji.category,
    );
    for (const candidate of sameSubcategory.slice(0, 6)) {
      related.push({ slug: candidate.slug, reason: "subcategory" });
    }

    for (const neighborId of buildSemanticNeighbors(canonicalId, termToCanonical, searchTerms)) {
      const slug = slugByCanonical.get(neighborId);
      if (!slug || slug === emoji.slug) continue;
      if (related.some((entry) => entry.slug === slug)) continue;
      related.push({ slug, reason: "semantic" });
      if (related.length >= MAX_RELATED) break;
    }

    const record: EmojiEnrichmentRecord = Object.freeze({
      canonicalId,
      officialName: searchEntry?.canonicalName ?? null,
      aliases: Object.freeze(uniqueStrings(searchEntry?.aliases ?? [])),
      searchTerms: Object.freeze(searchTerms),
      definitions: Object.freeze(definitions),
      artwork: Object.freeze(artwork),
      variantBaseSlug,
      variants: Object.freeze(variants),
      related: Object.freeze(related),
    });

    bySlug[emoji.slug] = record;
    searchTermsById[emoji.id] = buildDeltaSearchTerms(emoji, searchTerms);
  }

  const slugResolver = (slug: string): BrowsableEmoji | undefined =>
    allEmojis.find((emoji) => emoji.slug === slug);

  const compactBySlug: Record<string, CompactEmojiEnrichmentRecord> = {};
  let roundTripMismatches = 0;

  for (const [slug, record] of Object.entries(bySlug)) {
    const source = slugResolver(slug);
    if (!source) continue;

    const compact = compactEnrichmentRecord(slug, record);
    compactBySlug[slug] = compact;

    const expanded = expandCompactRecord(slug, compact, source, slugResolver);
    if (!logicalEnrichmentEquals(toLogicalEnrichment(record), toLogicalEnrichment(expanded))) {
      roundTripMismatches += 1;
    }
  }

  if (roundTripMismatches > 0) {
    throw new Error(`Compact enrichment round-trip failed for ${roundTripMismatches} records`);
  }

  const output: EmojiEnrichmentCompactFile = {
    generatedAt: new Date().toISOString(),
    releaseId: "master-8.10-20260809",
    recordCount: Object.keys(compactBySlug).length,
    schemaVersion: 2,
    bySlug: compactBySlug,
  };

  const searchOutput = {
    generatedAt: output.generatedAt,
    releaseId: output.releaseId,
    recordCount: Object.keys(searchTermsById).length,
    byId: searchTermsById,
  };

  const detailPath = join(rootDir, "src/data/emoji-enrichment.json");
  const searchPath = join(rootDir, "src/data/emoji-search-enrichment.json");
  writeFileSync(detailPath, `${JSON.stringify(output)}\n`, "utf8");
  writeFileSync(searchPath, `${JSON.stringify(searchOutput)}\n`, "utf8");

  console.log(`Emoji enrichment built: ${output.recordCount} detail records`);
  console.log(`Search enrichment built: ${searchOutput.recordCount} search records`);
  console.log(`Detail output: ${detailPath}`);
  console.log(`Search output: ${searchPath}`);

  const stats = {
    published: output.recordCount,
    withOpenMoji: 0,
    withNoto: 0,
    withTwemoji: 0,
    withFluent: 0,
    multiProvider: 0,
    withoutArtwork: 0,
    withVariants: 0,
    skinToneGroups: 0,
    genderGroups: 0,
    professionGroups: 0,
    familyGroups: 0,
    coupleGroups: 0,
    zwjGroups: 0,
    invalidVariantLinks: 0,
  };
  const slugSet = new Set(allEmojis.map((emoji) => emoji.slug));

  for (const record of Object.values(bySlug) as EmojiEnrichmentRecord[]) {
    if (record.artwork.p.openmoji) stats.withOpenMoji += 1;
    if (record.artwork.p.noto) stats.withNoto += 1;
    if (record.artwork.p.twemoji) stats.withTwemoji += 1;
    if (record.artwork.p.fluent) stats.withFluent += 1;
    if (record.artwork.count > 1) stats.multiProvider += 1;
    if (record.artwork.count === 0) stats.withoutArtwork += 1;
    if (record.variants.length > 0) stats.withVariants += 1;

    for (const variant of record.variants) {
      if (!slugSet.has(variant.slug)) stats.invalidVariantLinks += 1;
      if (variant.kind === "skin-tone") stats.skinToneGroups += 1;
      if (variant.kind === "gender") stats.genderGroups += 1;
      if (variant.kind === "profession") stats.professionGroups += 1;
      if (variant.kind === "family") stats.familyGroups += 1;
      if (variant.kind === "couple") stats.coupleGroups += 1;
      if (variant.kind === "zwj") stats.zwjGroups += 1;
    }
  }

  console.log("Enrichment validation:", JSON.stringify(stats, null, 2));
}

main();
