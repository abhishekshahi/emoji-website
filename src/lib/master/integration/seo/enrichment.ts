import { readFileSync } from "node:fs";
import { join } from "node:path";
import { absoluteUrl } from "@/lib/seo/metadata";
import type { CanonicalSeoRecord } from "@/lib/master/reconciliation/types";
import type { CanonicalSemanticIndexEntry } from "@/lib/master/semantic/types";
import { integrationDataPaths } from "../config";
import { getMasterReader } from "../master-reader";
import { loadProductionCanonicalRecords } from "../production-map";
import type { ProductionToMasterMap } from "../types";
import { evaluateSeoPolicy } from "./policy";
import type { ProductionSeoLookup, SeoSourceProvenance } from "./types";

const MAX_PUBLIC_KEYWORDS = 6;

let productionSlugByCanonicalId: Map<string, string> | null = null;

function loadProductionSlugByCanonicalId(rootDir: string): Map<string, string> {
  if (productionSlugByCanonicalId) {
    return productionSlugByCanonicalId;
  }

  const map = JSON.parse(
    readFileSync(join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"), "utf8"),
  ) as ProductionToMasterMap;
  const emojis = JSON.parse(readFileSync(join(rootDir, "src/data/emojis.json"), "utf8")) as Array<{ slug: string; hexcode: string }>;
  const extras = JSON.parse(readFileSync(join(rootDir, "src/data/openmoji-extras.json"), "utf8")) as Array<{ slug: string; hexcode: string }>;
  const byHex = new Map<string, string>();
  for (const emoji of emojis) {
    byHex.set(emoji.hexcode.toUpperCase(), emoji.slug);
  }
  for (const emoji of extras) {
    byHex.set(emoji.hexcode.toUpperCase(), emoji.slug);
  }

  const result = new Map<string, string>();
  for (const entry of [...map.standardRecords.entries, ...map.extrasRecords.entries]) {
    const slug = byHex.get(entry.productionHexcode.toUpperCase());
    if (slug) {
      result.set(entry.canonicalId, slug);
    }
  }

  productionSlugByCanonicalId = result;
  return result;
}

export function resetProductionSlugCache(): void {
  productionSlugByCanonicalId = null;
}

function buildSafeKeywords(semanticEntry: CanonicalSemanticIndexEntry | null, seoRecord: CanonicalSeoRecord | null): string[] {
  const safeSeoTerms = semanticEntry?.safeSeoTerms ?? [];
  const fromSemantic = safeSeoTerms
    .filter((term) => term.publicSeo)
    .map((term) => term.term);

  if (fromSemantic.length > 0) {
    return [...new Set(fromSemantic)].slice(0, MAX_PUBLIC_KEYWORDS);
  }

  return (seoRecord?.keywords ?? []).slice(0, MAX_PUBLIC_KEYWORDS);
}

function buildSafeAliases(semanticEntry: CanonicalSemanticIndexEntry | null, seoRecord: CanonicalSeoRecord | null): string[] {
  const safeAliases = semanticEntry?.aliasAudits
    ?.filter((alias) => alias.publicAlias)
    .map((alias) => alias.value) ?? [];

  if (safeAliases.length > 0) {
    return [...new Set(safeAliases)];
  }

  return seoRecord?.aliases ?? [];
}

function buildSourceProvenance(semanticEntry: CanonicalSemanticIndexEntry | null): SeoSourceProvenance[] {
  if (!semanticEntry) {
    return [];
  }

  return semanticEntry.safeSeoTerms
    .filter((term) => term.publicSeo)
    .map((term) =>
      Object.freeze({
        term: term.term,
        source: term.source,
        canonicalId: term.canonicalId,
        sourceVersion: term.sourceVersion ?? null,
        sourceRecordRef: term.sourceRecord ?? null,
      }),
    );
}

function buildDeterministicTitle(canonicalName: string, emoji: string | null): string {
  if (emoji) {
    return `${canonicalName} ${emoji} — Meaning, Copy & Unicode`;
  }
  return `${canonicalName} — Meaning, Copy & Unicode`;
}

function buildDeterministicDescription(
  canonicalName: string,
  emoji: string | null,
  codePointLabel: string | null,
  keywords: readonly string[],
): string {
  const keywordText = keywords.slice(0, MAX_PUBLIC_KEYWORDS).join(", ");
  const emojiPart = emoji ? `${canonicalName} ${emoji}` : canonicalName;
  const unicodePart = codePointLabel ? ` Unicode details (${codePointLabel}).` : "";
  const keywordPart = keywordText ? ` Keywords: ${keywordText}.` : "";
  return `Copy ${emojiPart}. Learn the meaning,${unicodePart} and related emojis.${keywordPart}`;
}

export function buildProductionSeoLookup(canonicalId: string, rootDir: string = process.cwd()): ProductionSeoLookup | null {
  const reader = getMasterReader(rootDir);
  const canonical = reader.canonicalRecords.get(canonicalId);
  const seoRecord = reader.seoRecords.get(canonicalId) ?? null;
  const semanticEntry = reader.semanticIndex.get(canonicalId) ?? null;

  if (!canonical || !seoRecord) {
    return null;
  }

  const productionRecords = loadProductionCanonicalRecords(rootDir);
  const productionRecord = productionRecords.get(canonicalId);
  const productionSlug = loadProductionSlugByCanonicalId(rootDir).get(canonicalId) ?? null;
  const policy = evaluateSeoPolicy({
    canonical,
    seoRecord,
    productionRecord,
    productionSlug,
    semanticEntry,
  });

  const keywords = buildSafeKeywords(semanticEntry, seoRecord);
  const aliases = buildSafeAliases(semanticEntry, seoRecord);
  const routeSlug = productionSlug ?? seoRecord.slug;
  const canonicalURL = absoluteUrl(`/emoji/${routeSlug}`);
  const codePointLabel = canonical.unicodeSequence ? `U+${canonical.unicodeSequence.replace(/-/g, " U+")}` : null;

  return Object.freeze({
    canonicalId,
    slug: seoRecord.slug,
    title: buildDeterministicTitle(seoRecord.canonicalName, canonical.emoji),
    description: buildDeterministicDescription(seoRecord.canonicalName, canonical.emoji, codePointLabel, keywords),
    canonicalURL,
    indexable: policy.indexable,
    robots: policy.robots,
    keywords: Object.freeze(keywords),
    aliases: Object.freeze(aliases),
    sourceProvenance: Object.freeze(buildSourceProvenance(semanticEntry)),
  });
}

export function getMasterSeoForCanonical(canonicalId: string, rootDir?: string): CanonicalSeoRecord | null {
  return getMasterReader(rootDir).seoRecords.get(canonicalId) ?? null;
}
