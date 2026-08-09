import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  buildCanonicalEmojiRecords,
  canonicalIdSet,
  productionCanonicalIdForExtra,
  productionCanonicalIdForStandard,
  type ArtworkIdentityMapping,
  type CanonicalSourceRef,
  type MetadataIdentityMapping,
  type RawToCanonicalMapping,
} from "@/lib/master/canonical/build";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";

const masterDir = join(process.cwd(), "src", "data", "master");
const identityDir = join(masterDir, "identity");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function loadCanonicalDatabase(): CanonicalEmojiRecord[] {
  return readJson<CanonicalEmojiRecord[]>(join(masterDir, "canonical-emojis.json"));
}

function buildFromIndexes(): CanonicalEmojiRecord[] {
  const rawSourceRecords = readJson<Array<{ source: string; sourceId: string; rawEmoji: string | null; recordType: string }>>(
    join(masterDir, "raw", "raw-source-records.json"),
  );
  const emojiBySourceKey = new Map(
    rawSourceRecords.map((record) => [`${record.source}:${record.sourceId}`, record.rawEmoji]),
  );
  const semanticSourceIds = new Set(
    rawSourceRecords.filter((record) => record.recordType === "semantic").map((record) => record.sourceId),
  );

  return buildCanonicalEmojiRecords({
    canonicalToSource: readJson<Record<string, CanonicalSourceRef[]>>(join(identityDir, "canonical-to-source-index.json")),
    rawToCanonical: readJson<RawToCanonicalMapping[]>(join(identityDir, "raw-to-canonical-index.json")),
    artworkIndex: readJson<ArtworkIdentityMapping[]>(join(identityDir, "artwork-identity-index.json")),
    metadataIndex: readJson<MetadataIdentityMapping[]>(join(identityDir, "metadata-identity-index.json")),
    emojiBySourceKey,
    semanticSourceIds,
  });
}

function findCanonical(records: CanonicalEmojiRecord[], canonicalId: string): CanonicalEmojiRecord {
  const record = records.find((entry) => entry.canonicalId === canonicalId);
  assert.ok(record, `Missing canonical record ${canonicalId}`);
  return record;
}

describe("canonical master identity database", () => {
  const builtRecords = buildFromIndexes();
  const persistedRecords = loadCanonicalDatabase();
  const builtIds = canonicalIdSet(builtRecords);
  const persistedIds = canonicalIdSet(persistedRecords);

  it("builds a persisted canonical database", () => {
    assert.ok(persistedRecords.length > 0);
    assert.equal(persistedIds.size, persistedRecords.length);
  });

  it("maps fire Unicode sequence to one canonical identity", () => {
    const fire = findCanonical(builtRecords, "unicode:1F525");
    assert.equal(fire.isUnicode, true);
    assert.equal(fire.identityType, "unicode");
    assert.equal(fire.unicodeSequence, "1F525");
    assert.equal(fire.emoji, "🔥");
    assert.ok(fire.sourceRecords.length > 1);
    assert.ok(fire.metadataSources.includes("emojibase"));
    assert.ok(fire.semanticSources.includes("emojinet"));
    assert.ok(fire.artwork.openmoji.length > 0);
    assert.ok(fire.artwork.noto.length > 0);
    assert.ok(fire.artwork.twemoji.length > 0);
    assert.ok(fire.artwork.fluent.length > 0);
  });

  it("keeps thumbs up skin-tone variants as distinct canonical identities", () => {
    const base = findCanonical(builtRecords, "unicode:1F44D");
    const light = findCanonical(builtRecords, "unicode:1F44D-1F3FB");
    const dark = findCanonical(builtRecords, "unicode:1F44D-1F3FF");

    assert.notEqual(base.canonicalId, light.canonicalId);
    assert.notEqual(light.canonicalId, dark.canonicalId);
    assert.ok(base.emoji?.startsWith("👍"));
    assert.ok(light.emoji?.includes("👍"));
    assert.ok(dark.emoji?.includes("👍"));
  });

  it("keeps technologist gender sequences separate", () => {
    const man = findCanonical(builtRecords, "unicode:1F468-200D-1F4BB");
    const woman = findCanonical(builtRecords, "unicode:1F469-200D-1F4BB");
    assert.notEqual(man.canonicalId, woman.canonicalId);
    assert.equal(man.emoji, "👨‍💻");
    assert.equal(woman.emoji, "👩‍💻");
  });

  it("preserves India flag sequence", () => {
    const india = findCanonical(builtRecords, "unicode:1F1EE-1F1F3");
    assert.equal(india.emoji, "🇮🇳");
  });

  it("keeps U+263A and U+263A-FE0F as separate canonical identities", () => {
    const text = findCanonical(builtRecords, "unicode:263A");
    const emojiQualified = findCanonical(builtRecords, "unicode:263A-FE0F");
    assert.notEqual(text.canonicalId, emojiQualified.canonicalId);
    assert.equal(text.unicodeSequence, "263A");
    assert.equal(emojiQualified.unicodeSequence, "263A-FE0F");
  });

  it("preserves OpenMoji private-use identity", () => {
    const pua = findCanonical(builtRecords, "source:openmoji:E000");
    assert.equal(pua.isUnicode, false);
    assert.equal(pua.identityType, "private-use");
    assert.equal(pua.unicodeSequence, null);
    assert.ok(pua.sourceRecords.some((record) => record.sourceId.includes("E000")));
  });

  it("preserves Twemoji PUA as source-specific identity", () => {
    const twemojiPua = builtRecords.find((record) => record.canonicalId === "source:twemoji:E50A");
    assert.ok(twemojiPua);
    assert.equal(twemojiPua.isUnicode, false);
    assert.equal(twemojiPua.identityType, "source-specific");
  });

  it("links EmojiNet semantic references without duplicating raw data", () => {
    const fire = findCanonical(builtRecords, "unicode:1F525");
    assert.ok(fire.semanticRefs.length > 0);
    assert.ok(fire.semanticRefs.every((ref) => ref.rawRecordRef.includes("raw-source-records.json#")));
  });

  it("links Emoji Time clock identity", () => {
    const clock = findCanonical(builtRecords, "unicode:1F550");
    assert.ok(clock.sourceRecords.some((record) => record.source === "emoji-time"));
  });

  it("keeps Noto non-Unicode assets as source-specific identities", () => {
    const regionFlag = builtRecords.find((record) =>
      record.canonicalId.startsWith("source:noto:GB-ENG.png"),
    );
    assert.ok(regionFlag);
    assert.equal(regionFlag.isUnicode, false);
    assert.equal(regionFlag.identityType, "source-specific");
  });

  it("keeps Noto logo utility asset out of Unicode identities", () => {
    const logo = builtRecords.find((record) => record.canonicalId === "source:noto:noto.png:noto.png");
    assert.ok(logo);
    assert.equal(logo.isUnicode, false);
    assert.equal(logo.identityType, "source-specific");
  });

  it("maps Fluent corrected fire artwork to unicode:1F525", () => {
    const fire = findCanonical(builtRecords, "unicode:1F525");
    assert.ok(fire.artwork.fluent.length > 0);
    assert.ok(
      fire.sourceRecords.some(
        (record) => record.source === "fluent" && record.rawRecordRef.includes("fire_color.svg"),
      ) || fire.artwork.fluent.some((ref) => ref.path.toLowerCase().includes("fire")),
    );
  });

  it("maps same Unicode sequence from multiple sources to one canonical identity", () => {
    const fromOpenmoji = builtRecords.find((record) =>
      record.sourceRecords.some(
        (ref) => ref.source === "openmoji" && ref.sourceId === "openmoji:1F525",
      ),
    );
    const fromEmojibase = builtRecords.find((record) =>
      record.sourceRecords.some(
        (ref) => ref.source === "emojibase" && ref.sourceId === "emojibase:1F525",
      ),
    );
    assert.equal(fromOpenmoji?.canonicalId, "unicode:1F525");
    assert.equal(fromEmojibase?.canonicalId, "unicode:1F525");
  });

  it("maps all existing EmojiFind standard records to canonical identities", () => {
    for (const record of emojis) {
      assert.ok(
        builtIds.has(productionCanonicalIdForStandard(record.hexcode)),
        `Missing canonical identity for standard record ${record.hexcode}`,
      );
    }
  });

  it("maps all existing EmojiFind extras to canonical identities", () => {
    for (const record of extras) {
      assert.ok(
        builtIds.has(productionCanonicalIdForExtra(record.hexcode)),
        `Missing canonical identity for extra ${record.hexcode}`,
      );
    }
  });

  it("matches persisted canonical database output", () => {
    assert.equal(persistedRecords.length, builtRecords.length);
    assert.deepEqual([...persistedIds].sort(), [...builtIds].sort());
  });
});
