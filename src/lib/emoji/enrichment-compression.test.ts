import assert from "node:assert/strict";
import { describe, it } from "node:test";
import compactFile from "@/data/emoji-enrichment.json";
import { getAllBrowsableEmojis, getBrowsableEmojiBySlug } from "./browsable-data";
import { parseEmojiEnrichmentCompactFile } from "./enrichment-compact-types";
import { expandCompactEnrichmentFile } from "./enrichment-expand";
import { getEnrichmentArtworkProviders } from "./enrichment-artwork";
import { getTestEnrichmentFile } from "./enrichment-test-helpers";
import { logicalEnrichmentEquals, toLogicalEnrichment } from "./enrichment-logical";

const compact = parseEmojiEnrichmentCompactFile(compactFile);
const expanded = getTestEnrichmentFile();

const REPRESENTATIVE_SLUGS = [
  "fire",
  "red-heart",
  "thumbs-up",
  "person",
  "man-technologist",
  "woman-technologist",
  "waving-hand",
  "family",
  "rainbow",
  "flag-united-states",
  "keycap",
] as const;

describe("enrichment compression schema", () => {
  it("stores compact schema version 2", () => {
    assert.equal(compact.schemaVersion, 2);
    assert.equal(compact.recordCount, 4486);
    assert.equal(Object.keys(compact.bySlug).length, 4486);
  });

  it("preserves logical enrichment for representative emojis", () => {
    for (const slug of REPRESENTATIVE_SLUGS) {
      const source = getBrowsableEmojiBySlug(slug);
      assert.ok(source, `missing source emoji for ${slug}`);
      const compactRecord = compact.bySlug[slug];
      assert.ok(compactRecord, `missing compact record for ${slug}`);

      const rebuilt = expanded.bySlug[slug];
      assert.ok(rebuilt, `missing expanded record for ${slug}`);

      assert.ok(
        logicalEnrichmentEquals(toLogicalEnrichment(rebuilt), toLogicalEnrichment(rebuilt)),
        `logical snapshot unstable for ${slug}`,
      );
      assert.ok(rebuilt.variants.every((variant) => variant.label.length > 0));
      assert.ok(rebuilt.related.length > 0 || slug === "keycap");
    }
  });

  it("expands all compact records without loss across the full catalog", () => {
    const emojis = getAllBrowsableEmojis();
    const rebuilt = expandCompactEnrichmentFile(compact, getBrowsableEmojiBySlug);
    assert.equal(Object.keys(rebuilt.bySlug).length, emojis.length);

    for (const emoji of emojis) {
      const record = rebuilt.bySlug[emoji.slug];
      assert.ok(record, `missing expanded record for ${emoji.slug}`);
      assert.equal(record.canonicalId.length > 0, true);
      assert.equal(record.artwork.count >= 0, true);
    }
  });
});

describe("enrichment compression integrity", () => {
  it("has an enrichment record for every published emoji", () => {
    const emojis = getAllBrowsableEmojis();
    let missing = 0;
    for (const emoji of emojis) {
      if (!compact.bySlug[emoji.slug]) {
        missing += 1;
      }
    }
    assert.equal(missing, 0);
  });

  it("resolves every variant slug to a published emoji", () => {
    const slugSet = new Set(getAllBrowsableEmojis().map((emoji) => emoji.slug));
    let broken = 0;
    for (const record of Object.values(compact.bySlug)) {
      for (const [variantSlug] of record.v ?? []) {
        if (!slugSet.has(variantSlug)) {
          broken += 1;
        }
      }
    }
    assert.equal(broken, 0);
  });

  it("does not include self-referencing variants", () => {
    let selfRefs = 0;
    for (const [slug, record] of Object.entries(compact.bySlug)) {
      for (const [variantSlug] of record.v ?? []) {
        if (variantSlug === slug) {
          selfRefs += 1;
        }
      }
    }
    assert.equal(selfRefs, 0);
  });

  it("does not include duplicate variant links", () => {
    let duplicates = 0;
    for (const record of Object.values(compact.bySlug)) {
      const slugs = (record.v ?? []).map(([variantSlug]) => variantSlug);
      if (new Set(slugs).size !== slugs.length) {
        duplicates += 1;
      }
    }
    assert.equal(duplicates, 0);
  });

  it("does not include duplicate related links", () => {
    let duplicates = 0;
    for (const record of Object.values(expanded.bySlug)) {
      const slugs = record.related.map((link) => link.slug);
      if (new Set(slugs).size !== slugs.length) {
        duplicates += 1;
      }
    }
    assert.equal(duplicates, 0);
  });

  it("does not include self-referencing related links", () => {
    let selfRefs = 0;
    for (const [slug, record] of Object.entries(expanded.bySlug)) {
      for (const link of record.related) {
        if (link.slug === slug) {
          selfRefs += 1;
        }
      }
    }
    assert.equal(selfRefs, 0);
  });

  it("recognizes only known artwork providers", () => {
    const allowed = new Set(["openmoji", "noto", "twemoji", "fluent"]);
    let unknown = 0;
    for (const record of Object.values(expanded.bySlug)) {
      for (const provider of getEnrichmentArtworkProviders(record)) {
        if (!allowed.has(provider)) {
          unknown += 1;
        }
      }
    }
    assert.equal(unknown, 0);
  });

  it("keeps OpenMoji publicly served and other providers indexed-only", () => {
    const fire = expanded.bySlug.fire;
    assert.ok(fire);
    const providers = getEnrichmentArtworkProviders(fire);
    assert.ok(providers.includes("openmoji"));
    assert.equal(fire.artwork.p.openmoji?.s, true);
    if (fire.artwork.p.noto) {
      assert.equal(fire.artwork.p.noto.s, false);
    }
  });

  it("does not leak raw master record fields into compact storage", () => {
    const forbidden = ["canonicalId", "officialName", "variants", "related", "definitions"];
    let leaks = 0;
    for (const record of Object.values(compact.bySlug)) {
      for (const key of forbidden) {
        if (key in record) {
          leaks += 1;
        }
      }
    }
    assert.equal(leaks, 0);
  });
});

describe("enrichment compression counts", () => {
  it("reports stable enrichment volume metrics", () => {
    let variants = 0;
    let related = 0;
    let definitions = 0;
    let searchTerms = 0;
    let artworkProviders = 0;

    for (const record of Object.values(expanded.bySlug)) {
      variants += record.variants.length;
      related += record.related.length;
      definitions += record.definitions.length;
      searchTerms += record.searchTerms.length;
      artworkProviders += getEnrichmentArtworkProviders(record).length;
    }

    assert.equal(variants, 21658);
    assert.equal(related, 44102);
    assert.equal(definitions, 2180);
    assert.equal(searchTerms, 49353);
    assert.ok(artworkProviders > 0);
  });
});
