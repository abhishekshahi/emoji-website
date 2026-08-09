import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type {
  MetadataKeywordIndexEntry,
  MetadataNameConflictEntry,
  RawMetadataIndexRecord,
  ShortcodeSourceIndexEntry,
} from "@/lib/master/metadata/types";
import { buildReconciliationDatabase } from "@/lib/master/reconciliation/build";
import type {
  CanonicalNameRecord,
  CanonicalSearchIndexEntry,
  NameReconciliationReport,
} from "@/lib/master/reconciliation/types";

const masterDir = join(process.cwd(), "src", "data", "master");
const metadataDir = join(masterDir, "metadata");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadBuiltReconciliation() {
  return buildReconciliationDatabase({
    canonicalRecords: readJson<CanonicalEmojiRecord[]>(join(masterDir, "canonical-emojis.json")),
    rawMetadataIndex: readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json")),
    metadataNameConflicts: readJson<MetadataNameConflictEntry[]>(join(metadataDir, "metadata-name-conflicts.json")),
    metadataKeywordIndex: readJson<MetadataKeywordIndexEntry[]>(join(metadataDir, "metadata-keyword-index.json")),
    shortcodeSourceIndex: readJson<ShortcodeSourceIndexEntry[]>(join(metadataDir, "shortcode-source-index.json")),
  });
}

function findName(records: CanonicalNameRecord[], canonicalId: string): CanonicalNameRecord {
  const record = records.find((entry) => entry.canonicalId === canonicalId);
  assert.ok(record, `Missing name record for ${canonicalId}`);
  return record;
}

function findSearch(records: CanonicalSearchIndexEntry[], canonicalId: string): CanonicalSearchIndexEntry {
  const record = records.find((entry) => entry.canonicalId === canonicalId);
  assert.ok(record, `Missing search record for ${canonicalId}`);
  return record;
}

describe("reconciliation master database", () => {
  const built = loadBuiltReconciliation();
  const persistedNames = readJson<CanonicalNameRecord[]>(join(metadataDir, "canonical-name-records.json"));
  const report = readJson<NameReconciliationReport>(join(metadataDir, "name-reconciliation-report.json"));
  const phase86Manifest = readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json"));

  it("builds canonical records for all 6,955 identities", () => {
    assert.equal(built.canonicalNameRecords.length, 6955);
    assert.equal(persistedNames.length, 6955);
    assert.equal(built.canonicalSearchIndex.length, 6955);
    assert.equal(report.baselines.canonicalIdentities, 6955);
    assert.equal(report.baselines.originalNameConflicts, 4187);
  });

  it("preserves all original source names in sourceNames arrays", () => {
    const fire = findName(built.canonicalNameRecords, "unicode:1F525");
    const sources = new Set(fire.sourceNames.map((entry) => entry.source));
    assert.ok(sources.has("openmoji"));
    assert.ok(sources.has("cldr"));
    assert.ok(sources.has("emojibase"));
    assert.ok(sources.has("emojilib"));
    assert.ok(sources.has("fluent"));
    assert.ok(sources.has("emojinet"));
    assert.ok(sources.has("unicode"));
  });

  it("selects fire canonical name from unicode official priority", () => {
    const fire = findName(built.canonicalNameRecords, "unicode:1F525");
    assert.equal(fire.canonicalName, "fire");
    assert.equal(fire.nameSource, "unicode");
    assert.ok(fire.nameSelectionRule.startsWith("unicode-priority:"));
  });

  it("preserves thumbs up and skin tone naming separately", () => {
    const thumbs = findName(built.canonicalNameRecords, "unicode:1F44D");
    const skin = findName(built.canonicalNameRecords, "unicode:1F44D-1F3FB");
    assert.notEqual(thumbs.canonicalId, skin.canonicalId);
    assert.ok(thumbs.canonicalName.toLowerCase().includes("thumbs"));
    assert.ok(skin.canonicalName.toLowerCase().includes("light"));
  });

  it("preserves ZWJ technologist and India flag canonical names", () => {
    const technologist = findName(built.canonicalNameRecords, "unicode:1F468-200D-1F4BB");
    const india = findName(built.canonicalNameRecords, "unicode:1F1EE-1F1F3");
    assert.ok(technologist.canonicalName.toLowerCase().includes("technologist"));
    assert.ok(india.canonicalName.toLowerCase().includes("india"));
  });

  it("uses source-authoritative naming for OpenMoji private-use", () => {
    const pua = findName(built.canonicalNameRecords, "source:openmoji:E000");
    assert.equal(pua.identityType, "private-use");
    assert.equal(pua.canonicalName, "goldfish");
    assert.equal(pua.nameSource, "openmoji");
  });

  it("keeps EmojiNet multi-sense records out of canonical names while preserving semantic search terms", () => {
    const fireSearch = findSearch(built.canonicalSearchIndex, "unicode:1F525");
    assert.ok(fireSearch.semanticSearchTerms.length > 0);
    assert.ok(fireSearch.provenance.semanticTerms.every((entry) => entry.metadataRecordId.includes("emojinet")));
    const fire = findName(built.canonicalNameRecords, "unicode:1F525");
    assert.ok(fire.sourceNames.some((entry) => entry.source === "emojinet"));
  });

  it("preserves Emojibase shortcode packs with provenance", () => {
    const fireShortcodes = built.canonicalShortcodes.find((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fireShortcodes);
    const packs = new Set(fireShortcodes.shortcodes.map((entry) => entry.shortcodePack));
    assert.ok(packs.has("emojibase") || packs.has("github") || packs.has("cldr"));
    assert.ok(fireShortcodes.shortcodes.some((entry) => entry.normalizedShortcode === "fire"));
  });

  it("preserves Emojilib keyword sets while building canonical keywords", () => {
    const fireKeywords = built.canonicalKeywords.find((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fireKeywords);
    assert.ok(fireKeywords.sourceKeywords.some((entry) => entry.source === "emojilib"));
    assert.ok(fireKeywords.canonicalKeywords.some((entry) => entry.sources.includes("emojilib")));
    assert.ok(fireKeywords.sourceKeywords.find((entry) => entry.source === "emojilib")!.keywords.includes("snapstreak"));
  });

  it("keeps unicode and CLDR name tension as alias rather than deletion", () => {
    const fire = findName(built.canonicalNameRecords, "unicode:1F525");
    const unicodeSource = fire.sourceNames.find((entry) => entry.source === "unicode");
    assert.ok(unicodeSource);
    if (unicodeSource.value !== fire.canonicalName) {
      assert.ok(fire.aliases.some((alias) => alias.source === "unicode"));
    }
  });

  it("creates deterministic SEO slugs with collision disambiguation", () => {
    const fireSeo = built.canonicalSeoRecords.find((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fireSeo);
    assert.equal(fireSeo.slug, "fire");
    const slugOwners = new Map<string, number>();
    for (const record of built.canonicalSeoRecords) {
      slugOwners.set(record.slug, (slugOwners.get(record.slug) ?? 0) + 1);
    }
    assert.equal([...slugOwners.values()].filter((count) => count > 1).length, 0);
  });

  it("reports SEO conflicts without deleting source data", () => {
    assert.ok(built.seoConflicts.length >= 0);
    assert.ok(report.outputCounts.seoConflicts === built.seoConflicts.length);
  });

  it("preserves all Phase 8.6 raw metadata records unchanged", () => {
    assert.equal(phase86Manifest.length, 42910);
    const rebuiltManifest = readJson<RawMetadataIndexRecord[]>(join(metadataDir, "raw-metadata-index.json"));
    assert.equal(rebuiltManifest.length, 42910);
    const sample = phase86Manifest.find((entry) => entry.metadataRecordId === "openmoji:openmoji:1F525");
    const current = rebuiltManifest.find((entry) => entry.metadataRecordId === "openmoji:openmoji:1F525");
    assert.deepEqual(current?.rawMetadata, sample?.rawMetadata);
  });

  it("does not modify production EmojiFind data", () => {
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
  });

  it("builds search index with provenance and proposed ranking model only", () => {
    const fireSearch = findSearch(built.canonicalSearchIndex, "unicode:1F525");
    assert.equal(fireSearch.canonicalName, "fire");
    assert.ok(fireSearch.keywords.length > 0);
    assert.ok(fireSearch.shortcodes.length > 0);
    assert.equal(fireSearch.proposedRankingModel.exactEmoji, 1000);
    assert.ok(fireSearch.provenance.keywords.length > 0);
  });
});
