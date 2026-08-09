import assert from "node:assert/strict";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  buildVariationSelectorAudit,
  detectVariationSelectorCase,
  emojiToSequence,
  extractBareSourceId,
  isPrivateUseSequence,
  isVariationSelectorPair,
  normalizeHexSequence,
  resolveRawRecordIdentity,
  toUnicodeCanonicalIdentity,
} from "@/lib/master/identity";
import { buildFluentMetadataIndex, resolveArtworkIdentity } from "@/lib/master/identity/resolve";
import { classifyUnmatchedRecord } from "@/lib/master/identity/unmatched";

const fluentMetadataIndex = buildFluentMetadataIndex([
  {
    sourceId: "fluent-metadata:Fire",
    rawName: "fire",
    rawMetadata: { unicode: "1f525", glyph: "🔥" },
  },
  {
    sourceId: "fluent-metadata:1st place medal",
    rawName: "1st place medal",
    rawMetadata: { unicode: "1f947", glyph: "🥇" },
  },
]);

describe("identity normalization", () => {
  it("normalizes fire emoji character to unicode:1F525", () => {
    assert.equal(emojiToSequence("🔥"), "1F525");
    assert.equal(toUnicodeCanonicalIdentity("1F525"), "unicode:1F525");
  });

  it("normalizes U+1F525 query form", () => {
    assert.equal(normalizeHexSequence("U+1F525"), "1F525");
    assert.equal(toUnicodeCanonicalIdentity("U+1F525"), "unicode:1F525");
  });

  it("normalizes bare hex 1F525", () => {
    assert.equal(normalizeHexSequence("1f525"), "1F525");
    assert.equal(normalizeHexSequence("1F525"), "1F525");
  });

  it("keeps thumbs up distinct from skin-tone variants", () => {
    const base = resolveRawRecordIdentity({
      source: "unicode-emoji-data",
      sourceId: "unicode:1F44D",
      rawEmoji: "👍",
      rawCodepoints: ["1F44D"],
      rawSequence: "1F44D",
      recordType: "emoji",
    });
    const light = resolveRawRecordIdentity({
      source: "unicode-emoji-data",
      sourceId: "unicode:1F44D-1F3FB",
      rawEmoji: "👍🏻",
      rawCodepoints: ["1F44D", "1F3FB"],
      rawSequence: "1F44D-1F3FB",
      recordType: "emoji",
    });
    const dark = resolveRawRecordIdentity({
      source: "unicode-emoji-data",
      sourceId: "unicode:1F44D-1F3FF",
      rawEmoji: "👍🏿",
      rawCodepoints: ["1F44D", "1F3FF"],
      rawSequence: "1F44D-1F3FF",
      recordType: "emoji",
    });

    assert.equal(base.resolution.canonicalIdentity, "unicode:1F44D");
    assert.equal(light.resolution.canonicalIdentity, "unicode:1F44D-1F3FB");
    assert.equal(dark.resolution.canonicalIdentity, "unicode:1F44D-1F3FF");
    assert.notEqual(base.resolution.canonicalIdentity, light.resolution.canonicalIdentity);
    assert.notEqual(light.resolution.canonicalIdentity, dark.resolution.canonicalIdentity);
  });

  it("keeps man technologist distinct from woman technologist", () => {
    const man = resolveRawRecordIdentity({
      source: "emojibase",
      sourceId: "emojibase:1F468-200D-1F4BB",
      rawEmoji: "👨‍💻",
      rawCodepoints: ["1F468", "200D", "1F4BB"],
      rawSequence: "1F468-200D-1F4BB",
      recordType: "metadata",
    });
    const woman = resolveRawRecordIdentity({
      source: "emojibase",
      sourceId: "emojibase:1F469-200D-1F4BB",
      rawEmoji: "👩‍💻",
      rawCodepoints: ["1F469", "200D", "1F4BB"],
      rawSequence: "1F469-200D-1F4BB",
      recordType: "metadata",
    });

    assert.equal(man.resolution.canonicalIdentity, "unicode:1F468-200D-1F4BB");
    assert.equal(woman.resolution.canonicalIdentity, "unicode:1F469-200D-1F4BB");
    assert.notEqual(man.resolution.canonicalIdentity, woman.resolution.canonicalIdentity);
  });

  it("normalizes India flag regional-indicator sequence", () => {
    const india = resolveRawRecordIdentity({
      source: "twemoji",
      sourceId: "twemoji:1F1EE-1F1F3",
      rawEmoji: "🇮🇳",
      rawCodepoints: ["1F1EE", "1F1F3"],
      rawSequence: "1F1EE-1F1F3",
      recordType: "artwork-only",
    });

    assert.equal(india.resolution.canonicalIdentity, "unicode:1F1EE-1F1F3");
    assert.equal(india.resolution.normalizedSequence, "1F1EE-1F1F3");
  });

  it("preserves keycap emoji sequence", () => {
    const keycap = resolveRawRecordIdentity({
      source: "openmoji",
      sourceId: "openmoji:0023-FE0F-20E3",
      rawEmoji: "#️⃣",
      rawCodepoints: ["0023", "FE0F", "20E3"],
      rawSequence: "0023-FE0F-20E3",
      recordType: "emoji",
    });

    assert.equal(keycap.resolution.canonicalIdentity, "unicode:0023-FE0F-20E3");
    assert.equal(keycap.resolution.identityCategory, "unicode-sequence");
  });

  it("preserves variation-selector sequence", () => {
    const heart = resolveRawRecordIdentity({
      source: "unicode-emoji-data",
      sourceId: "unicode:2764-FE0F",
      rawEmoji: "❤️",
      rawCodepoints: ["2764", "FE0F"],
      rawSequence: "2764-FE0F",
      recordType: "sequence",
    });

    assert.equal(heart.resolution.canonicalIdentity, "unicode:2764-FE0F");
  });

  it("audits U+263A vs U+263A-FE0F without merging", () => {
    assert.equal(isVariationSelectorPair("263A", "263A-FE0F"), true);

    const audited = detectVariationSelectorCase({
      source: "openmoji",
      sourceId: "openmoji:263A",
      rawSequence: "263A",
      rawCodepoints: ["263A"],
      rawEmoji: "☺️",
      rawMetadata: { hexcode: "263A-FE0F" },
    });

    assert.ok(audited);
    assert.equal(audited.recommendedCanonicalIdentity, "unicode:263A");
    assert.notEqual(audited.recommendedCanonicalIdentity, "unicode:263A-FE0F");
    assert.equal(audited.relation, "text-default-vs-emoji-qualified");
  });

  it("maps OpenMoji private-use record to source identity", () => {
    const extra = resolveRawRecordIdentity({
      source: "openmoji",
      sourceId: "openmoji-extra:E000",
      rawEmoji: "\uE000",
      rawCodepoints: ["E000"],
      rawSequence: "E000",
      rawMetadata: { hexcode: "E000", unicode: "" },
      recordType: "emoji",
    });

    assert.equal(extra.resolution.canonicalIdentity, "source:openmoji:E000");
    assert.equal(extra.resolution.identityCategory, "private-use");
    assert.equal(isPrivateUseSequence("E000"), true);
    assert.equal(extractBareSourceId("openmoji", "openmoji-extra:E000"), "E000");
  });

  it("maps EmojiNet record to unicode identity", () => {
    const emojinet = resolveRawRecordIdentity({
      source: "emojinet",
      sourceId: "emojinet:1F525:sense:nouns:bn:000:0",
      rawEmoji: "🔥",
      rawCodepoints: ["1F525"],
      rawSequence: "1F525",
      rawMetadata: {
        unicode: "U+1F525",
        name: "fire",
      },
      recordType: "semantic",
    });

    assert.equal(emojinet.resolution.canonicalIdentity, "unicode:1F525");
    assert.equal(emojinet.resolution.identityCategory, "semantic-only");
    assert.equal(emojinet.conflicts.length, 0);
  });

  it("maps Emoji Time clock record to unicode identity", () => {
    const clock = resolveRawRecordIdentity({
      source: "emoji-time",
      sourceId: "emoji-time:clock-0:0",
      rawEmoji: "🕐",
      rawCodepoints: ["1F550"],
      rawSequence: "1F550",
      rawMetadata: { hour: 0, halfHour: false, hexcode: "1F550", emoji: "🕐" },
      recordType: "utility",
    });

    assert.equal(clock.resolution.canonicalIdentity, "unicode:1F550");
  });

  it("uses Fluent metadata.unicode instead of ASCII rawCodepoints", () => {
    const fire = resolveRawRecordIdentity(
      {
        source: "fluent",
        sourceId: "fluent-metadata:Fire",
        rawEmoji: "1f525",
        rawCodepoints: ["0031", "0066", "0035", "0032", "0035"],
        rawSequence: "0031-0066-0035-0032-0035",
        rawMetadata: {
          unicode: "1f525",
          glyph: "🔥",
        },
        recordType: "metadata",
      },
      fluentMetadataIndex,
    );

    assert.equal(fire.resolution.canonicalIdentity, "unicode:1F525");
    assert.equal(fire.resolution.mappingMethod, "fluent.metadata.unicode");
    assert.equal(fire.conflicts.length, 0);
  });

  it("maps Fluent artwork via metadata index without placeholder rawEmoji", () => {
    const artwork = resolveRawRecordIdentity(
      {
        source: "fluent",
        sourceId: "fluent:fire_color.svg:fire_color.svg",
        rawEmoji: "\u0001",
        rawCodepoints: ["fire_color.svg"],
        rawSequence: "fire_color.svg",
        rawArtworkReference: "artwork/fluent/assets/Fire/Color/fire_color.svg",
        rawMetadata: { fileName: "fire_color.svg" },
        recordType: "artwork-only",
      },
      fluentMetadataIndex,
    );

    assert.equal(artwork.resolution.canonicalIdentity, "unicode:1F525");
    assert.equal(artwork.conflicts.length, 0);
  });

  it("classifies Noto region-flag assets as artwork variants", () => {
    const classified = classifyUnmatchedRecord({
      source: "noto",
      sourceId: "noto:GB-ENG.png:GB-ENG.png",
      recordType: "artwork-only",
      rawSequence: "GB-ENG.png",
      rawCodepoints: ["GB-ENG.png"],
      rawArtworkReference: "artwork/noto/third_party/region-flags/png/GB-ENG.png",
    });

    assert.equal(classified.classification, "artwork-variant-asset");
    assert.equal(classified.canonicalIdentity, "source:noto:GB-ENG.png:GB-ENG.png");
  });

  it("maps artwork providers to unicode identities", () => {
    const openmoji = resolveArtworkIdentity(
      {
        source: "openmoji",
        sourceId: "openmoji-artwork:1F525",
        sourceVersion: "17.0.0",
        stagedPath: "artwork/openmoji/1F525.svg",
        originalPath: "1F525.svg",
        rawLicense: "CC BY-SA 4.0",
        checksum: "abc",
      },
      new Map(),
    );
    const noto = resolveArtworkIdentity(
      {
        source: "noto",
        sourceId: "noto-artwork:1F525:emoji_u1f525.png",
        sourceVersion: "2.051",
        stagedPath: "artwork/noto/png/128/emoji_u1f525.png",
        originalPath: "emoji_u1f525.png",
        rawLicense: "Apache-2.0",
        checksum: "abc",
      },
      new Map(),
    );
    const twemoji = resolveArtworkIdentity(
      {
        source: "twemoji",
        sourceId: "twemoji-artwork:1F525:1f525.png",
        sourceVersion: "17.0.3",
        stagedPath: "artwork/twemoji/assets/72x72/1f525.png",
        originalPath: "1f525.png",
        rawLicense: "CC BY 4.0",
        checksum: "abc",
      },
      new Map(),
    );

    assert.equal(openmoji.canonicalIdentity, "unicode:1F525");
    assert.equal(noto.canonicalIdentity, "unicode:1F525");
    assert.equal(twemoji.canonicalIdentity, "unicode:1F525");
  });

  it("keeps production emoji counts intact", () => {
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
  });

  it("builds variation-selector audit entries", () => {
    const audit = buildVariationSelectorAudit([
      {
        source: "openmoji",
        sourceId: "openmoji:263A",
        rawSequence: "263A",
        rawCodepoints: ["263A"],
        rawEmoji: "☺️",
        rawMetadata: { hexcode: "263A-FE0F" },
      },
    ]);

    assert.equal(audit.totalCases, 1);
    assert.equal(audit.cases[0]?.recommendedCanonicalIdentity, "unicode:263A");
  });
});
