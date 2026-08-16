import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import {
  buildArtworkDatabase,
  getFireArtworkRecords,
  type ArtworkProvider,
  type ProviderLicenseInfo,
} from "@/lib/master/artwork/build";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import { isUtilityArtwork, normalizeArtworkVariant } from "@/lib/master/artwork/variants";

const masterDir = join(process.cwd(), "src", "data", "master");
const rawDir = join(masterDir, "raw");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const providerLicenses: Record<ArtworkProvider, ProviderLicenseInfo> = {
  openmoji: {
    license: "CC BY-SA 4.0",
    licenseURL: "https://creativecommons.org/licenses/by-sa/4.0/",
    attribution: "OpenMoji",
    sourceURL: "https://openmoji.org/",
    copyright: "OpenMoji Contributors",
    sourceVersion: "17.0.0",
  },
  noto: {
    license: "Apache-2.0",
    licenseURL: "https://www.apache.org/licenses/LICENSE-2.0",
    attribution: "Google Noto Emoji project",
    sourceURL: "https://github.com/googlefonts/noto-emoji",
    copyright: "Google LLC",
    sourceVersion: "2.051",
  },
  twemoji: {
    license: "CC BY 4.0",
    licenseURL: "https://creativecommons.org/licenses/by/4.0/",
    attribution: "Twitter, Inc and contributors",
    sourceURL: "https://github.com/jdecked/twemoji",
    copyright: "Twitter, Inc and contributors",
    sourceVersion: "17.0.3",
  },
  fluent: {
    license: "MIT",
    licenseURL: "https://opensource.org/licenses/MIT",
    attribution: "Microsoft Corporation",
    sourceURL: "https://github.com/microsoft/fluentui-emoji",
    copyright: "Microsoft Corporation",
    sourceVersion: "UNRESOLVED",
  },
};

function loadBuiltDatabase() {
  const canonicalIds = readJson<Array<{ canonicalId: string }>>(join(masterDir, "canonical-emojis.json")).map(
    (record) => record.canonicalId,
  );

  return buildArtworkDatabase({
    rawArtworkRecords: readJson(join(rawDir, "raw-artwork-records.json")),
    artworkIdentityIndex: readJson(join(masterDir, "identity", "artwork-identity-index.json")),
    canonicalIds,
    rawArtworkRoot: rawDir,
    providerLicenses,
  });
}

function findByCanonical(records: ArtworkMasterRecord[], canonicalId: string): ArtworkMasterRecord[] {
  return records.filter((record) => record.canonicalId === canonicalId);
}

describe("artwork master database", () => {
  const built = loadBuiltDatabase();
  const persisted = readJson<ArtworkMasterRecord[]>(join(masterDir, "artwork", "artwork-master-index.json"));
  const integrity = readJson<{
    totals: { rawArtworkRecords: number; artworkMasterRecords: number; missingFiles: number; checksumFailures: number };
    providerCounts: Record<string, number>;
  }>(join(masterDir, "artwork", "artwork-integrity-report.json"));

  it("represents all raw artwork records in the master index", () => {
    assert.equal(built.artworkMasterIndex.length, 40071);
    assert.equal(persisted.length, 40071);
    assert.equal(integrity.totals.rawArtworkRecords, 40071);
    assert.equal(integrity.totals.artworkMasterRecords, 40071);
  });

  it("verifies all artwork files and checksums", () => {
    assert.equal(integrity.totals.missingFiles, 0);
    assert.equal(integrity.totals.checksumFailures, 0);
    assert.ok(built.artworkChecksums.every((entry) => entry.checksumVerified));
  });

  it("keeps fire artwork from every provider as separate records linked to unicode:1F525", () => {
    const fire = getFireArtworkRecords(built.artworkMasterIndex);
    const providers = new Set(fire.map((record) => record.provider));
    assert.ok(providers.has("openmoji"));
    assert.ok(providers.has("noto"));
    assert.ok(providers.has("twemoji"));
    assert.ok(providers.has("fluent"));
    assert.ok(fire.every((record) => record.canonicalId === "unicode:1F525"));
    assert.ok(fire.length >= 4);

    const canonicalFire = built.canonicalArtworkIndex.find(
      (entry) => entry.canonicalId === "unicode:1F525",
    );
    assert.ok(canonicalFire);
    assert.ok(canonicalFire.artwork.openmoji.length > 0);
    assert.ok(canonicalFire.artwork.noto.length > 0);
    assert.ok(canonicalFire.artwork.twemoji.length > 0);
    assert.ok(canonicalFire.artwork.fluent.length > 0);
  });

  it("keeps thumbs-up skin-tone artwork on distinct canonical identities", () => {
    const base = findByCanonical(built.artworkMasterIndex, "unicode:1F44D");
    const light = findByCanonical(built.artworkMasterIndex, "unicode:1F44D-1F3FB");
    const dark = findByCanonical(built.artworkMasterIndex, "unicode:1F44D-1F3FF");
    assert.ok(base.length > 0);
    assert.ok(light.length > 0);
    assert.ok(dark.length > 0);
    assert.notDeepEqual(
      base.map((record) => record.artworkId),
      light.map((record) => record.artworkId),
    );
  });

  it("preserves ZWJ and flag artwork without merging identities", () => {
    const technologist = findByCanonical(built.artworkMasterIndex, "unicode:1F468-200D-1F4BB");
    const india = findByCanonical(built.artworkMasterIndex, "unicode:1F1EE-1F1F3");
    assert.ok(technologist.length > 0);
    assert.ok(india.length > 0);
  });

  it("preserves OpenMoji private-use artwork as source-specific", () => {
    const pua = built.artworkMasterIndex.filter((record) => record.canonicalId === "source:openmoji:E000");
    assert.ok(pua.length > 0);
    assert.ok(pua.every((record) => record.status === "source-specific"));
    assert.equal(pua[0]?.isUnicode, false);
  });

  it("preserves Noto source-specific artwork-only records", () => {
    const regionFlag = built.artworkMasterIndex.find((record) =>
      record.canonicalId.startsWith("source:noto:GB-ENG.png"),
    );
    assert.ok(regionFlag);
    assert.equal(regionFlag.status, "source-specific");
    assert.equal(regionFlag.isUnicode, false);
  });

  it("keeps Twemoji SVG and PNG as separate artwork assets", () => {
    const twemojiFire = getFireArtworkRecords(built.artworkMasterIndex).filter(
      (record) => record.provider === "twemoji",
    );
    const formats = new Set(twemojiFire.map((record) => record.artworkVariant));
    assert.ok(formats.has("svg"));
    assert.ok(formats.has("png"));
    assert.ok(twemojiFire.length >= 2);
  });

  it("keeps Fluent color, flat, and high-contrast variants separate", () => {
    const fluentFire = getFireArtworkRecords(built.artworkMasterIndex).filter(
      (record) => record.provider === "fluent",
    );
    const variants = new Set(fluentFire.map((record) => record.artworkVariant));
    assert.ok(variants.has("color"));
    assert.ok(variants.has("flat"));
    assert.ok(variants.has("high-contrast"));
    assert.equal(fluentFire.length, 3);
  });

  it("excludes noto.png utility asset from canonical emoji artwork", () => {
    const utility = built.artworkMasterIndex.find((record) => isUtilityArtwork(record.sourceId, record.filePath));
    assert.ok(utility);
    assert.equal(utility.status, "utility-support");
    assert.equal(utility.canonicalId, "source:noto:noto.png");

    const canonicalUtility = built.canonicalArtworkIndex.find(
      (entry) => entry.canonicalId === utility.canonicalId,
    );
    assert.equal(
      (canonicalUtility?.artwork.noto.length ?? 0) +
        (canonicalUtility?.artwork.openmoji.length ?? 0) +
        (canonicalUtility?.artwork.twemoji.length ?? 0) +
        (canonicalUtility?.artwork.fluent.length ?? 0),
      0,
    );
  });

  it("preserves provider-specific licenses and attribution", () => {
    for (const provider of ["openmoji", "noto", "twemoji", "fluent"] as const) {
      const licenseEntry = built.artworkLicenseIndex.find((entry) => entry.provider === provider);
      const attributionEntry = built.artworkAttributionIndex.find((entry) => entry.provider === provider);
      assert.ok(licenseEntry);
      assert.ok(attributionEntry);
      assert.equal(licenseEntry.license, providerLicenses[provider].license);
      assert.equal(attributionEntry.license, providerLicenses[provider].license);
    }
  });

  it("marks byte-identical files without deleting them", () => {
    const duplicateRecords = built.artworkMasterIndex.filter((record) => record.duplicateBinary);
    assert.ok(duplicateRecords.length > 0);
    for (const record of duplicateRecords) {
      assert.ok(record.duplicateBinaryGroupId);
    }
  });

  it("keeps production emoji data unchanged", () => {
    assert.equal(emojis.length, 3944);
    assert.equal(extras.length, 542);
  });

  it("normalizes artwork variants from actual staged assets only", () => {
    assert.equal(normalizeArtworkVariant("openmoji", "svg", "color", "artwork/openmoji/1F525.svg"), "svg");
    assert.equal(
      normalizeArtworkVariant("twemoji", "png", "72x72", "artwork/twemoji/assets/72x72/1f525.png"),
      "png",
    );
    assert.equal(
      normalizeArtworkVariant(
        "fluent",
        "svg",
        "color",
        "artwork/fluent/assets/Fire/Color/fire_color.svg",
      ),
      "color",
    );
  });
});

describe("Phase 8.62-B resolvePreferredArtwork", () => {
  it("prefers Noto then falls back to public OpenMoji", async () => {
    const { resolvePreferredArtwork, resolvePublicPreferredArtwork } = await import(
      "@/lib/artwork/resolve-preferred-artwork"
    );
    const identity = {
      canonicalId: "unicode:1F525",
      artwork: {
        noto: [{ sourceId: "1f525", path: "noto/1f525.svg", format: "svg" }],
        openmoji: [{ sourceId: "1F525", path: "openmoji/1F525.svg", format: "svg" }],
      },
    };
    const preferred = resolvePreferredArtwork(identity);
    assert.ok(preferred);
    assert.equal(preferred.provider, "noto");
    assert.equal(preferred.fallbackRank, 1);
    const pub = resolvePublicPreferredArtwork(identity);
    assert.ok(pub);
    assert.equal(pub.publiclyServed, true);
    assert.equal(pub.provider, "noto");
  });
});

describe("Phase 8.62-C provider architecture", () => {
  it("preserves license gates for Noto/Fluent", async () => {
    const { getProviderArchitecture, isPublicArtworkProvider } = await import(
      "@/lib/artwork/provider-architecture"
    );
    assert.equal(isPublicArtworkProvider("openmoji"), true);
    assert.equal(isPublicArtworkProvider("twemoji"), true);
    assert.equal(isPublicArtworkProvider("noto"), true);
    assert.equal(isPublicArtworkProvider("fluent"), true);
    assert.equal(getProviderArchitecture().length, 4);
  });
});
