import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  buildMetadataDatabase,
  getFireMetadataRecords,
  getMetadataRecordsBySource,
  getMetadataRecordsForCanonical,
  type EmojibaseShortcodePacks,
} from "@/lib/master/metadata/build";
import type { RawMetadataInput } from "@/lib/master/metadata/extract";
import type {
  MetadataAuditReport,
  RawMetadataIndexRecord,
} from "@/lib/master/metadata/types";

const masterDir = join(process.cwd(), "src", "data", "master");
const rawDir = join(masterDir, "raw");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadBuiltDatabase() {
  const rawMetadataManifest = readJson<RawMetadataInput[]>(join(rawDir, "raw-metadata-records.json"));
  const rawSourceRecords = readJson<RawMetadataInput[]>(join(rawDir, "raw-source-records.json"));
  const manifestUnicodeEmojiDataIds = new Set(
    rawMetadataManifest
      .filter((record) => record.source === "unicode-emoji-data")
      .map((record) => record.sourceId),
  );
  const unicodeEmojiDataRecords = rawSourceRecords.filter(
    (record) => record.source === "unicode-emoji-data" && !manifestUnicodeEmojiDataIds.has(record.sourceId),
  );

  const canonicalIds = readJson<Array<{ canonicalId: string }>>(join(masterDir, "canonical-emojis.json")).map(
    (record) => record.canonicalId,
  );

  return buildMetadataDatabase({
    rawMetadataRecords: rawMetadataManifest,
    unicodeEmojiDataRecords,
    metadataIdentityIndex: readJson(join(masterDir, "identity", "metadata-identity-index.json")),
    rawToCanonicalIndex: readJson(join(masterDir, "identity", "raw-to-canonical-index.json")),
    canonicalIds,
    emojibaseShortcodes: readJson<EmojibaseShortcodePacks>(join(rawDir, "emojibase", "shortcodes")),
    providerLicenses: Object.fromEntries(
      readJson<{ sources: Array<{ source: string; license: string; licenseURL: string; attribution: string | null; version: string }> }>(
        join(process.cwd(), "src", "data", "master-source-lock.json"),
      ).sources.map((entry) => [
        entry.source,
        {
          license: entry.license,
          licenseURL: entry.licenseURL,
          attribution: entry.attribution,
          version: entry.version,
        },
      ]),
    ),
  });
}

function sourcesForCanonical(records: RawMetadataIndexRecord[], canonicalId: string): Set<string> {
  return new Set(getMetadataRecordsForCanonical(records, canonicalId).map((record) => record.source));
}

describe("metadata master database", () => {
  const built = loadBuiltDatabase();
  const persisted = readJson<RawMetadataIndexRecord[]>(join(masterDir, "metadata", "raw-metadata-index.json"));
  const audit = readJson<MetadataAuditReport>(join(masterDir, "metadata", "metadata-audit-report.json"));
  const providerAvailability = readJson<
    Array<{ provider: string; metadataAvailable: boolean; recordCount: number }>
  >(join(masterDir, "metadata", "metadata-provider-availability.json"));

  it("represents all raw metadata records in the master index", () => {
    assert.equal(built.rawMetadataIndex.length, 42910);
    assert.equal(persisted.length, 42910);
    assert.equal(audit.baselines.rawMetadataManifest, 34784);
    assert.equal(audit.baselines.rawSemanticRecords, 15183);
    assert.equal(audit.baselines.unicodeEmojiDataSourceRecords, 8126);
    assert.equal(audit.baselines.totalMetadataMasterRecords, 42910);
  });

  it("preserves every manifest metadata record without rewriting raw values", () => {
    const manifest = readJson<RawMetadataIndexRecord[]>(join(rawDir, "raw-metadata-records.json"));
    for (const original of manifest) {
      const builtRecord = getMetadataRecordsBySource(built.rawMetadataIndex, original.source, original.sourceId);
      assert.ok(builtRecord, `Missing built metadata record for ${original.source}:${original.sourceId}`);
      assert.deepEqual(builtRecord.rawMetadata, original.rawMetadata);
      assert.equal(builtRecord.rawName, original.rawName);
      assert.equal(builtRecord.rawEmoji, original.rawEmoji);
      assert.equal(builtRecord.recordType, original.recordType);
    }
  });

  it("keeps all 15,183 EmojiNet semantic records intact", () => {
    const semantic = built.rawMetadataIndex.filter((record) => record.recordType === "semantic");
    assert.equal(semantic.length, 15183);
    assert.equal(semantic.every((record) => record.source === "emojinet"), true);
    assert.ok(semantic.every((record) => record.fields.definition || record.rawMetadata.definitions));
  });

  it("keeps fire metadata from every metadata source separately linked to unicode:1F525", () => {
    const fire = getFireMetadataRecords(built.rawMetadataIndex);
    const sources = sourcesForCanonical(built.rawMetadataIndex, "unicode:1F525");
    assert.ok(sources.has("openmoji"));
    assert.ok(sources.has("unicode"));
    assert.ok(sources.has("emojibase"));
    assert.ok(sources.has("emojilib"));
    assert.ok(sources.has("emojinet"));
    assert.ok(sources.has("fluent"));
    assert.ok(fire.some((record) => record.source === "unicode-emoji-data"));
    assert.ok(fire.length >= 10);
  });

  it("preserves thumbs up metadata across sources", () => {
    const canonicalId = "unicode:1F44D";
    const sources = sourcesForCanonical(built.rawMetadataIndex, canonicalId);
    assert.ok(sources.has("openmoji"));
    assert.ok(sources.has("unicode"));
    assert.ok(sources.has("emojibase"));
    assert.ok(sources.has("emojilib"));
    assert.ok(sources.has("emojinet"));
    const emojinetSenses = getMetadataRecordsForCanonical(built.rawMetadataIndex, canonicalId).filter(
      (record) => record.source === "emojinet" && record.recordType === "semantic",
    );
    assert.ok(emojinetSenses.length >= 2);
  });

  it("preserves skin tone metadata for thumbs up light skin tone", () => {
    const records = getMetadataRecordsForCanonical(built.rawMetadataIndex, "unicode:1F44D-1F3FB");
    assert.ok(records.some((record) => record.source === "openmoji"));
    assert.ok(records.some((record) => record.source === "emojibase"));
    const emojibase = records.find((record) => record.source === "emojibase");
    assert.ok(emojibase?.fields.skinTone);
  });

  it("preserves ZWJ man technologist metadata", () => {
    const records = getMetadataRecordsForCanonical(built.rawMetadataIndex, "unicode:1F468-200D-1F4BB");
    assert.ok(records.some((record) => record.source === "openmoji"));
    assert.ok(records.some((record) => record.source === "unicode"));
    assert.ok(records.some((record) => record.source === "emojibase"));
  });

  it("preserves India flag metadata", () => {
    const records = getMetadataRecordsForCanonical(built.rawMetadataIndex, "unicode:1F1EE-1F1F3");
    assert.ok(records.some((record) => record.source === "openmoji"));
    assert.ok(records.some((record) => record.source === "unicode"));
    assert.ok(records.some((record) => record.source === "emojilib"));
  });

  it("preserves OpenMoji private-use metadata as source-specific", () => {
    const records = getMetadataRecordsForCanonical(built.rawMetadataIndex, "source:openmoji:E000");
    assert.ok(records.some((record) => record.source === "openmoji" && record.sourceId === "openmoji:E000"));
    assert.equal(records[0]?.canonicalId, "source:openmoji:E000");
  });

  it("preserves EmojiNet fire metadata and multiple senses separately", () => {
    const fire = getMetadataRecordsForCanonical(built.rawMetadataIndex, "unicode:1F525").filter(
      (record) => record.source === "emojinet",
    );
    const metadata = fire.filter((record) => record.recordType === "metadata");
    const senses = fire.filter((record) => record.recordType === "semantic");
    assert.equal(metadata.length, 1);
    assert.ok(senses.length >= 2);
    assert.ok(senses.every((record) => record.rawMetadata.babelNetId));
  });

  it("preserves Emojibase shortcode packs with provenance", () => {
    const shortcodes = readJson<Array<{ canonicalId: string; shortcodes: Record<string, string[]> }>>(
      join(masterDir, "metadata", "shortcode-source-index.json"),
    );
    const fire = shortcodes.find((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fire);
    assert.ok(fire.shortcodes.emojibase || fire.shortcodes.github || fire.shortcodes.cldr || fire.shortcodes.iamcal);
  });

  it("preserves Emojilib keywords without merging", () => {
    const keywords = readJson<Array<{ canonicalId: string; keywords: Record<string, string[]> }>>(
      join(masterDir, "metadata", "metadata-keyword-index.json"),
    );
    const fire = keywords.find((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fire?.keywords.emojilib);
    assert.ok(fire.keywords.emojilib.length > 0);
    assert.notEqual(fire.keywords.emojilib, fire.keywords.cldr);
  });

  it("preserves Unicode emoji data properties separately from CLDR", () => {
    const fireUnicodeData = getMetadataRecordsForCanonical(built.rawMetadataIndex, "unicode:1F525").filter(
      (record) => record.source === "unicode-emoji-data",
    );
    const fireCldr = getMetadataRecordsBySource(built.rawMetadataIndex, "unicode", "unicode-cldr:1F525");
    assert.ok(fireUnicodeData.length > 0);
    assert.ok(fireCldr);
    assert.notEqual(fireUnicodeData[0]?.rawMetadata.status, fireCldr.rawMetadata.label);
  });

  it("preserves CLDR annotation fields separately", () => {
    const cldr = getMetadataRecordsBySource(built.rawMetadataIndex, "unicode", "unicode-cldr:1F525");
    assert.ok(cldr);
    assert.equal(cldr.fields.label, "fire");
    assert.ok(cldr.fields.keywords.length > 0);
    assert.equal(cldr.fields.locale, "en");
  });

  it("preserves Fluent metadata using corrected unicode identity fields", () => {
    const fluent = getMetadataRecordsForCanonical(built.rawMetadataIndex, "unicode:1F525").filter(
      (record) => record.source === "fluent",
    );
    assert.ok(fluent.length > 0);
    const fireFluent = fluent.find(
      (record) =>
        String(record.rawMetadata.unicode).toLowerCase() === "1f525" ||
        record.sourceId === "fluent-metadata:Fire",
    );
    assert.ok(fireFluent);
    assert.equal(fireFluent.fields.sourceSpecificIds.unicode, "1f525");
    assert.ok(fireFluent.fields.name);
  });

  it("preserves all 24 Emoji Time clock mappings", () => {
    const clockRecords = built.rawMetadataIndex.filter((record) => record.source === "emoji-time");
    assert.equal(clockRecords.length, 24);
    const noon = getMetadataRecordsBySource(built.rawMetadataIndex, "emoji-time", "emoji-time:clock-0:0");
    assert.ok(noon);
    assert.equal(noon.canonicalId, "unicode:1F550");
    assert.equal(noon.rawSequence, "1F550");
  });

  it("records Noto and Twemoji metadata absence explicitly", () => {
    const noto = providerAvailability.find((entry) => entry.provider === "noto");
    const twemoji = providerAvailability.find((entry) => entry.provider === "twemoji");
    assert.equal(noto?.metadataAvailable, false);
    assert.equal(twemoji?.metadataAvailable, false);
    assert.equal(noto?.recordCount, 0);
    assert.equal(twemoji?.recordCount, 0);
  });

  it("maps canonical metadata references without choosing winners", () => {
    const canonical = readJson<Array<{ canonicalId: string; sources: Record<string, string[]> }>>(
      join(masterDir, "metadata", "canonical-metadata-index.json"),
    );
    const fire = canonical.find((entry) => entry.canonicalId === "unicode:1F525");
    assert.ok(fire);
    assert.ok(fire.sources.openmoji.length > 0);
    assert.ok(fire.sources.cldr.length > 0);
    assert.ok(fire.sources.emojibase.length > 0);
    assert.ok(fire.sources.emojilib.length > 0);
    assert.ok(fire.sources.emojinet.length > 0);
    assert.ok(fire.sources.fluent.length > 0);
    assert.ok(fire.sources.unicode.length > 0);
  });

  it("does not modify production EmojiFind data files", () => {
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
  });

  it("validates every metadata record has source and canonicalId", () => {
    assert.ok(built.rawMetadataIndex.every((record) => record.source && record.canonicalId && record.metadataRecordId));
    assert.ok(
      built.metadataSourceIndex.every(
        (record) => record.source && record.sourceId && record.canonicalId && record.metadataRecordId,
      ),
    );
  });
});
