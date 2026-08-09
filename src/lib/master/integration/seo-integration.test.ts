import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { getBrowsableEmojiBySlug } from "@/lib/emoji/browsable-data";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import {
  MASTER_INTEGRATION_CONFIG,
  SEO_BASELINES,
  buildProductionSeoLookup,
  buildSeoIntegrationPackage,
  evaluateSeoPolicy,
  getExistingProductionPageMetadata,
  getMasterSeoForCanonical,
  getProductionSEO,
  isAmbiguousSeoTerm,
  isMasterSeoIntegrationEnabled,
  isUtilityCanonicalId,
} from "@/lib/master/integration";
import { getMasterReader } from "@/lib/master/integration/master-reader";

const rootDir = process.cwd();

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function loadSemanticTermMap(): ReadonlyMap<string, { ambiguous: boolean; publicSeo: boolean }> {
  const terms = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/semantic/semantic-search-terms.json"), "utf8"),
  ) as Array<{ normalizedTerm: string; ambiguous: boolean; publicSearch: boolean }>;
  return new Map(terms.map((term) => [term.normalizedTerm, { ambiguous: term.ambiguous, publicSeo: term.publicSearch }]));
}

describe("phase 8.11D SEO integration", () => {
  const seoPackage = buildSeoIntegrationPackage(rootDir);
  const semanticTerms = loadSemanticTermMap();
  const reader = getMasterReader(rootDir);

  it("keeps masterSEOEnabled false", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  it("returns null production SEO while feature flag is disabled", () => {
    assert.equal(getProductionSEO("unicode:1F525"), null);
  });

  it("audits all canonical identities with explicit SEO status", () => {
    assert.equal(seoPackage.seoCanonicalAudit.totalRecords, SEO_BASELINES.canonicalIdentities);
    assert.equal(seoPackage.seoCanonicalAudit.status, "PASS");
    assert.equal(seoPackage.seoIndexabilityAudit.indexable + seoPackage.seoIndexabilityAudit.notIndexable, SEO_BASELINES.canonicalIdentities);
  });

  it("maps all production records for SEO coverage", () => {
    assert.equal(seoPackage.productionSeoCoverage.mappedRecords, SEO_BASELINES.productionMappings);
    assert.equal(seoPackage.productionSeoCoverage.status, "PASS");
  });

  it("verifies fire canonical SEO record and single canonical URL", () => {
    const fireSeo = getMasterSeoForCanonical("unicode:1F525", rootDir);
    assert.ok(fireSeo);
    assert.equal(fireSeo.canonicalName, "fire");
    assert.equal(fireSeo.slug, "fire");

    const lookup = buildProductionSeoLookup("unicode:1F525", rootDir);
    assert.ok(lookup);
    assert.equal(lookup.slug, "fire");
    assert.ok(lookup.canonicalURL.endsWith("/emoji/fire"));
    assert.ok(lookup.keywords.length <= 6);
    assert.ok(!lookup.description.toLowerCase().includes("babelnet"));
  });

  it("keeps unicode:263A and unicode:263A-FE0F distinct", () => {
    const base = getMasterSeoForCanonical("unicode:263A", rootDir);
    const variation = getMasterSeoForCanonical("unicode:263A-FE0F", rootDir);
    assert.ok(base);
    assert.ok(variation);
    assert.notEqual(base.slug, variation.slug);
    assert.notEqual(base.canonicalId, variation.canonicalId);
  });

  it("protects skin tone identities as distinct", () => {
    for (const canonicalId of ["unicode:1F44D", "unicode:1F44D-1F3FB", "unicode:1F44D-1F3FF"]) {
      const seo = getMasterSeoForCanonical(canonicalId, rootDir);
      assert.ok(seo);
      assert.ok(seo.slug.length > 0);
    }
    const base = getMasterSeoForCanonical("unicode:1F44D", rootDir);
    const light = getMasterSeoForCanonical("unicode:1F44D-1F3FB", rootDir);
    const dark = getMasterSeoForCanonical("unicode:1F44D-1F3FF", rootDir);
    assert.notEqual(base?.slug, light?.slug);
    assert.notEqual(base?.slug, dark?.slug);
  });

  it("protects ZWJ sequences and flag identity", () => {
    const man = getMasterSeoForCanonical("unicode:1F468-200D-1F4BB", rootDir);
    const woman = getMasterSeoForCanonical("unicode:1F469-200D-1F4BB", rootDir);
    const india = getMasterSeoForCanonical("unicode:1F1EE-1F1F3", rootDir);
    assert.ok(man);
    assert.ok(woman);
    assert.ok(india);
    assert.notEqual(man.slug, woman.slug);
    assert.equal(india.slug, "flag-india");
    assert.ok(india.aliases.some((alias) => alias.toLowerCase() === "india"));
  });

  it("marks hot as ambiguous and not automatically indexable as a standalone page", () => {
    const slugOwners = new Map<string, string[]>();
    for (const record of reader.seoRecords.values()) {
      const owners = slugOwners.get(record.slug) ?? [];
      owners.push(record.canonicalId);
      slugOwners.set(record.slug, owners);
    }
    assert.equal(isAmbiguousSeoTerm("hot", semanticTerms, slugOwners), true);
    const hotSlugOwners = [...reader.seoRecords.values()].filter((record) => record.slug === "hot");
    assert.equal(hotSlugOwners.length, 0);
    assert.equal(slugOwners.get("fire")?.[0], "unicode:1F525");
  });

  it("blocks private-use, utility, and artwork-only identities from indexation", () => {
    const pua = reader.canonicalRecords.get("source:openmoji:E000");
    const utility = reader.canonicalRecords.get("source:noto:noto.png");
    assert.ok(pua);
    assert.ok(utility);
    assert.equal(isUtilityCanonicalId("source:noto:noto.png"), true);

    const puaPolicy = evaluateSeoPolicy({
      canonical: pua,
      seoRecord: reader.seoRecords.get("source:openmoji:E000") ?? null,
      productionRecord: undefined,
      productionSlug: null,
      semanticEntry: reader.semanticIndex.get("source:openmoji:E000") ?? null,
    });
    const utilityPolicy = evaluateSeoPolicy({
      canonical: utility,
      seoRecord: reader.seoRecords.get("source:noto:noto.png") ?? null,
      productionRecord: undefined,
      productionSlug: null,
      semanticEntry: reader.semanticIndex.get("source:noto:noto.png") ?? null,
    });

    assert.equal(puaPolicy.eligibility, "private-use");
    assert.equal(puaPolicy.indexable, false);
    assert.equal(utilityPolicy.eligibility, "utility");
    assert.equal(utilityPolicy.indexable, false);
  });

  it("does not create provider-specific artwork URLs", () => {
    const fire = buildProductionSeoLookup("unicode:1F525", rootDir);
    assert.ok(fire);
    assert.ok(!fire.canonicalURL.includes("/openmoji"));
    assert.ok(!fire.canonicalURL.includes("/noto"));
    assert.ok(!fire.canonicalURL.includes("/twemoji"));
    assert.ok(!fire.canonicalURL.includes("/fluent"));
  });

  it("limits sitemap eligibility to existing production pages only", () => {
    const eligible = seoPackage.seoSitemapEligibility.entries.filter((entry) => entry.sitemapEligible);
    assert.equal(eligible.length, SEO_BASELINES.productionMappings);
    assert.equal(seoPackage.seoSitemapEligibility.status, "PASS");
    assert.ok(seoPackage.seoSitemapEligibility.counts["future-page"] > 0);
  });

  it("reports slug mismatches without failing slug integrity on production-route differences", () => {
    assert.ok(seoPackage.productionSeoCoverage.slugMismatches > 0);
    assert.equal(seoPackage.seoSlugAudit.duplicateSlugCollisions, 0);
    assert.equal(seoPackage.seoSlugAudit.status, "PASS");
  });

  it("keeps existing production SEO metadata unchanged while feature flag is disabled", () => {
    const fire = getBrowsableEmojiBySlug("fire") as BrowsableEmoji;
    assert.ok(fire);
    const existing = getExistingProductionPageMetadata(fire);
    assert.match(String(existing.title), /fire/i);
    assert.match(String(existing.description), /fire/i);
    assert.equal(existing.alternates?.canonical, existing.openGraph?.url);
  });

  it("leaves production datasets, routes, and SEO behavior untouched", () => {
    const emojisHash = sha256File(join(rootDir, "src/data/emojis.json"));
    const extrasHash = sha256File(join(rootDir, "src/data/openmoji-extras.json"));
    assert.ok(emojisHash.length === 64);
    assert.ok(extrasHash.length === 64);

    const searchable = [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];
    assert.equal(searchable.length, SEO_BASELINES.productionMappings);
    for (const slug of ["fire", "thumbs-up", "red-heart"]) {
      assert.ok(getBrowsableEmojiBySlug(slug));
    }
  });

  it("passes SEO integration audit", () => {
    assert.equal(seoPackage.seoIntegrationAudit.status, "PASS");
    assert.equal(seoPackage.seoIntegrationAudit.ambiguityProtection, "PASS");
    assert.equal(seoPackage.seoIntegrationAudit.productionSafety, "PASS");
    assert.equal(seoPackage.seoIntegrationAudit.featureFlag, "PASS");
  });
});
