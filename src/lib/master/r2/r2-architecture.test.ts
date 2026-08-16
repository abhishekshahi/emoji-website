import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { HUB_PAGE_COUNT } from "@/lib/hub/hub-routes";
import {
  MASTER_ARTWORK_RECORD_COUNT,
  MASTER_IDENTITY_COUNT,
  PRODUCTION_BROWSABLE_EMOJI_COUNT,
  PUBLIC_INDEXABLE_IDENTITY_COUNT,
  PUBLIC_SEO_EMOJI_PAGE_COUNT,
  PUBLIC_SITEMAP_URL_COUNT,
} from "@/lib/master/r2/catalog";
import { getAllIdentitySlugs, getIndexableEmojiPageSlugs } from "@/lib/master/public/identity-slug-map";
import { parseMasterR2Mode } from "@/lib/master/r2/config";
import {
  buildArtworkStorageKey,
  parseArtworkApiPath,
  R2KeyValidationError,
  assertSafeR2Key,
} from "@/lib/master/r2/keys";
import {
  getAllowedArtworkProviders,
  isProviderPubliclyServed,
} from "@/lib/master/r2/licenses";
import { MASTER_INTEGRATION_CONFIG } from "@/lib/master/integration/config";
import { parseSeoRolloutMode } from "@/lib/master/integration/seo-canary/rollout";
import { getAllBrowsableEmojis } from "@/lib/emoji/browsable-data";
import { getAllCategorySlugs } from "@/lib/emoji/data";
import type { CanonicalEmojiRecord } from "@/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import { verifyR2Export } from "@/lib/master/r2/export/verify";
import { verifyFullArchive } from "@/lib/master/r2/full-archive/verify";
import {
  FULL_ARCHIVE_PREFIX,
  FULL_ARCHIVE_SCHEMA_VERSION,
} from "@/lib/master/r2/full-archive/types";
import { R2_FULL_EXPORT_DIR } from "@/lib/master/r2/config";
import {
  assertSafeFullArchiveKey,
  buildFullArchiveMasterKey,
  parseFullArchiveArtworkPath,
  FullArchiveKeyValidationError,
} from "@/lib/master/r2/full-archive/keys";

const rootDir = process.cwd();

describe("master R2 catalog invariants", () => {
  it("measures canonical identity counts from master data", () => {
    const records = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/canonical-emojis.json"), "utf8"),
    ) as CanonicalEmojiRecord[];

    assert.equal(records.length, MASTER_IDENTITY_COUNT);

    let unicode = 0;
    let sourceSpecific = 0;
    let privateUse = 0;
    const ids = new Set<string>();

    for (const record of records) {
      assert.ok(!ids.has(record.canonicalId), `duplicate canonical ID ${record.canonicalId}`);
      ids.add(record.canonicalId);
      if (record.identityType === "unicode") unicode += 1;
      if (record.identityType === "source-specific") sourceSpecific += 1;
      if (record.identityType === "private-use") privateUse += 1;
    }

    assert.equal(unicode, 5540);
    assert.equal(sourceSpecific, 1050);
    assert.equal(privateUse, 365);
  });

  it("measures artwork record count from master index", () => {
    const records = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/artwork/artwork-master-index.json"), "utf8"),
    ) as ArtworkMasterRecord[];
    assert.equal(records.length, MASTER_ARTWORK_RECORD_COUNT);
  });

  it("keeps production emoji page count separate from master identities", () => {
    const emojis = getAllBrowsableEmojis();
    assert.equal(emojis.length, PRODUCTION_BROWSABLE_EMOJI_COUNT);
    assert.equal(getAllIdentitySlugs().length, PUBLIC_SEO_EMOJI_PAGE_COUNT);
    assert.ok(PUBLIC_SEO_EMOJI_PAGE_COUNT === MASTER_IDENTITY_COUNT);
  });

  it("keeps sitemap URL count stable", () => {
    assert.equal(getIndexableEmojiPageSlugs().length, PUBLIC_INDEXABLE_IDENTITY_COUNT);
    const sitemapCount = 7 + getAllCategorySlugs().length + getIndexableEmojiPageSlugs().length + HUB_PAGE_COUNT;
    assert.equal(sitemapCount, PUBLIC_SITEMAP_URL_COUNT);
  });
});

describe("master R2 security", () => {
  it("allows only approved artwork providers", () => {
    assert.deepEqual(getAllowedArtworkProviders(), ["openmoji", "noto", "twemoji", "fluent"]);
    assert.throws(() => parseArtworkApiPath("evil", ["../secret.svg"]), R2KeyValidationError);
    assert.throws(() => parseArtworkApiPath("openmoji", ["..", "secret.svg"]), R2KeyValidationError);
    assert.throws(() => parseArtworkApiPath("openmoji", ["%2e%2e", "secret.svg"]), R2KeyValidationError);
    assert.throws(() => parseArtworkApiPath("unknown", ["file.svg"]), R2KeyValidationError);
  });

  it("builds deterministic artwork storage keys", () => {
    const key = buildArtworkStorageKey("openmoji", "1F525.svg");
    assert.equal(key, "emojiquick/artwork/openmoji/1F525.svg");
    assert.doesNotThrow(() => assertSafeR2Key(key));
    assert.throws(() => assertSafeR2Key("other-prefix/artwork/openmoji/1F525.svg"), R2KeyValidationError);
  });

  it("keeps verified artwork providers publicly served", () => {
    assert.equal(isProviderPubliclyServed("openmoji"), true);
    assert.equal(isProviderPubliclyServed("twemoji"), true);
    assert.equal(isProviderPubliclyServed("noto"), true);
    assert.equal(isProviderPubliclyServed("fluent"), true);
  });
});

describe("master R2 feature flags and SEO safety", () => {
  it("defaults master R2 mode to OFF", () => {
    assert.equal(parseMasterR2Mode(undefined), "OFF");
    assert.equal(parseMasterR2Mode("ENABLED"), "ENABLED");
  });

  it("keeps master integration SEO disabled while runtime flags enabled", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, true);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, true);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, true);
    assert.equal(parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE), "OFF");
  });
});

describe("master R2 export verification", () => {
  it("verifies local export when present", () => {
    const exportDir = join(rootDir, ".r2-export", "emojiquick");
    if (!existsSync(join(exportDir, "manifests", "r2-manifest.json"))) {
      return;
    }
    let result = verifyR2Export(exportDir);
    if (result.status !== "PASS") {
      result = verifyR2Export(exportDir);
    }
    assert.equal(result.status, "PASS", result.errors.join("; "));
    assert.equal(result.manifest.totals.identities, MASTER_IDENTITY_COUNT);
    assert.equal(result.manifest.totals.artworkRecords, MASTER_ARTWORK_RECORD_COUNT);
  });
});

describe("master R2 full archive", () => {
  it("distinguishes full archive prefix from optimized export prefix", () => {
    assert.equal(FULL_ARCHIVE_PREFIX, "emojiquick-master");
    assert.equal(FULL_ARCHIVE_SCHEMA_VERSION, "master-full-archive-v1");
    assert.notEqual(FULL_ARCHIVE_PREFIX, "emojiquick");
  });

  it("validates full archive R2 keys and artwork paths", () => {
    const key = buildFullArchiveMasterKey("raw/artwork/openmoji/1F525.svg");
    assert.equal(key, "emojiquick-master/master/raw/artwork/openmoji/1F525.svg");
    assert.doesNotThrow(() => assertSafeFullArchiveKey(key));
    assert.throws(() => assertSafeFullArchiveKey("emojiquick-master/evil/secret"), FullArchiveKeyValidationError);
    assert.throws(() => parseFullArchiveArtworkPath("noto", ["..", "secret.png"]), FullArchiveKeyValidationError);
  });

  it("verifies full archive export when present", async () => {
    const exportDir = join(rootDir, R2_FULL_EXPORT_DIR, FULL_ARCHIVE_PREFIX);
    if (!existsSync(join(exportDir, "manifests", "master-manifest.json"))) {
      return;
    }
    const canonicalRecords = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/canonical-emojis.json"), "utf8"),
    ) as CanonicalEmojiRecord[];
    const artworkRecords = JSON.parse(
      readFileSync(join(rootDir, "src/data/master/artwork/artwork-master-index.json"), "utf8"),
    ) as ArtworkMasterRecord[];

    const result = await verifyFullArchive({
      projectRoot: rootDir,
      sourceRoot: join(rootDir, "src/data/master"),
      exportRootDir: exportDir,
      canonicalRecords,
      artworkRecords,
      deep: false,
    });

    assert.equal(result.status, "PASS", result.errors.join("; "));
    assert.equal(result.manifest.archiveType, "FULL_MASTER_ARCHIVE");
    assert.equal(result.manifest.deduplicationPolicy, "PRESERVE_ALL");
    assert.equal(result.manifest.totals.canonicalIdentities, MASTER_IDENTITY_COUNT);
    assert.equal(result.manifest.totals.artworkRecords, MASTER_ARTWORK_RECORD_COUNT);
    assert.equal(result.measured.exportFiles, result.manifest.totals.files);
    assert.equal(result.measured.exportBytes, result.manifest.totals.bytes);
  });
});

describe("worker bundle safety", () => {
  it("does not bundle the R2 export tree or full artwork binaries into open-next output", () => {
    const handlerPath = join(rootDir, ".open-next/server-functions/default/handler.mjs");
    if (!existsSync(handlerPath)) {
      return;
    }
    const handler = readFileSync(handlerPath, "utf8");
    assert.ok(!handler.includes(".r2-export"));
    assert.ok(!handler.includes(".r2-export-full"));
    assert.ok(!handler.includes("raw/artwork/openmoji"));
    assert.ok(handler.length < 50_000_000);
  });
});
