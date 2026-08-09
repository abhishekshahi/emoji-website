import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import emojis from "@/data/emojis.json";
import extras from "@/data/openmoji-extras.json";
import { searchEmojis } from "@/lib/emoji/search";
import type { BrowsableEmoji } from "@/lib/emoji/types";
import { createEmojiPageMetadata } from "@/lib/seo/metadata";
import { getOpenMojiArtworkPath } from "@/lib/artwork/openmoji";
import {
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  isMasterSearchIntegrationEnabled,
  isMasterSeoIntegrationEnabled,
  runWithIntegrationFlags,
  searchMasterIntegrated,
  searchProductionEmojis,
} from "@/lib/master/integration";
import { FINAL_ACTIVATION_PHASE } from "@/lib/master/integration/config";
import { buildFinalActivationPackage } from "@/lib/master/integration/final-activation/build";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

const rootDir = process.cwd();
const searchable = [...(emojis as BrowsableEmoji[]), ...(extras as BrowsableEmoji[])];
const ALL_FLAGS = {
  masterArtworkEnabled: true,
  masterMetadataEnabled: true,
  masterSearchEnabled: true,
  masterSEOEnabled: true,
} as const;

function getEmoji(hexcode: string): BrowsableEmoji {
  const emoji =
    (emojis as BrowsableEmoji[]).find((entry) => entry.hexcode === hexcode) ??
    (extras as BrowsableEmoji[]).find((entry) => entry.hexcode === hexcode);
  assert.ok(emoji, `Missing emoji ${hexcode}`);
  return emoji;
}

describe("phase 8.11I final combined activation audit", () => {
  const finalPackage = buildFinalActivationPackage(rootDir);

  it("keeps all feature flags disabled by default after final QA rollback", () => {
    assert.equal(MASTER_INTEGRATION_CONFIG.masterArtworkEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterMetadataEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSearchEnabled, false);
    assert.equal(MASTER_INTEGRATION_CONFIG.masterSEOEnabled, false);
    assert.equal(isMasterSearchIntegrationEnabled(), false);
    assert.equal(isMasterSeoIntegrationEnabled(), false);
  });

  describe("frozen release integrity", () => {
    it("verifies frozen release master-8.10-20260809", () => {
      const manifest = JSON.parse(
        readFileSync(join(rootDir, "src/data/master/release/8.10/master-release-manifest.json"), "utf8"),
      );
      assert.equal(manifest.releaseId, "master-8.10-20260809");
      assert.equal(finalPackage.finalActivationAudit.sections.frozenReleaseIntegrity.status, "PASS");
    });

    it("verifies frozen checksums remain byte-identical", () => {
      const checksums = JSON.parse(
        readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
      ) as FileChecksumEntry[];
      const result = verifyFrozenChecksums(rootDir, checksums);
      assert.equal(result.status, "PASS");
      assert.equal(result.mismatches.length, 0);
    });
  });

  describe("production data safety", () => {
    it("preserves production record counts", () => {
      assert.equal((emojis as BrowsableEmoji[]).length, PRODUCTION_BASELINES.standardRecords);
      assert.equal((extras as BrowsableEmoji[]).length, PRODUCTION_BASELINES.extrasRecords);
      assert.equal(finalPackage.productionSafetyAudit.status, "PASS");
    });

    it("keeps production search available with flags disabled", () => {
      const results = searchEmojis(searchable, "fire", 5);
      assert.ok(results.length > 0);
      const fire = getEmoji("1F525");
      const seo = createEmojiPageMetadata({
        name: fire.name,
        emoji: fire.emoji,
        slug: fire.slug,
        keywords: fire.keywords,
        codePointString: fire.codePointString,
        artworkPath: getOpenMojiArtworkPath(fire.hexcode),
      });
      assert.ok(typeof seo.title === "string" && seo.title.length > 0);
    });
  });

  describe("combined activation QA", () => {
    it("activates artwork, metadata, search, and SEO together", () => {
      assert.equal(finalPackage.combinedActivationAudit.status, "PASS");
      runWithIntegrationFlags(ALL_FLAGS, () => {
        const search = searchMasterIntegrated("fire", rootDir, 5);
        assert.equal(search.results[0]?.canonicalId, "unicode:1F525");
      });
    });
  });

  describe("core emoji matrix", () => {
    it("passes the critical emoji matrix audit", () => {
      assert.equal(finalPackage.finalActivationAudit.sections.coreEmojiMatrix.status, "PASS");
    });
  });

  describe("artwork, metadata, search, semantic, and SEO", () => {
    it("passes artwork final audit", () => {
      assert.equal(finalPackage.artworkFinalAudit.status, "PASS");
    });

    it("passes metadata final audit", () => {
      assert.equal(finalPackage.metadataFinalAudit.status, "PASS");
    });

    it("passes search final audit", () => {
      assert.equal(finalPackage.searchFinalAudit.status, "PASS");
    });

    it("keeps hot ambiguous under combined activation", () => {
      const hot = runWithIntegrationFlags(ALL_FLAGS, () => searchMasterIntegrated("hot", rootDir, 20));
      assert.ok(hot.results.length > 1);
      assert.notEqual(hot.results[0]?.canonicalId, "unicode:1F525");
    });

    it("passes semantic final audit", () => {
      assert.equal(finalPackage.semanticFinalAudit.status, "PASS");
    });

    it("passes SEO final audit without auto-fixing slug mismatches", () => {
      assert.equal(finalPackage.seoFinalAudit.status, "PASS");
      assert.ok((finalPackage.seoFinalAudit.counts as { slugMismatches: number }).slugMismatches >= 2000);
    });
  });

  describe("UI, server/client boundary, and performance", () => {
    it("passes UI final audit", () => {
      assert.equal(finalPackage.uiFinalAudit.status, "PASS");
    });

    it("passes server/client boundary audit", () => {
      assert.equal(finalPackage.finalActivationAudit.sections.serverClientBoundary.status, "PASS");
    });

    it("passes performance final audit", () => {
      assert.equal(finalPackage.performanceFinalAudit.status, "PASS");
    });
  });

  describe("failure safety and rollback", () => {
    it("passes failure safety audit", () => {
      assert.equal(finalPackage.failureSafetyAudit.status, "PASS");
    });

    it("restores production behavior after flag rollback", () => {
      assert.equal(finalPackage.flagRollbackAudit.status, "PASS");
      const productionSearch = searchEmojis(searchable, "fire", 5);
      const bridgedSearch = searchProductionEmojis(searchable, "fire", 5);
      assert.deepEqual(
        productionSearch.map((entry) => entry.emoji.hexcode),
        bridgedSearch.map((entry) => entry.emoji.hexcode),
      );
    });
  });

  describe("regression and final verdict", () => {
    it("passes regression audit across prior integration phases", () => {
      assert.equal(finalPackage.regressionAudit.status, "PASS");
    });

    it("passes the final activation audit package", () => {
      assert.equal(finalPackage.finalActivationAudit.phase, FINAL_ACTIVATION_PHASE);
      assert.equal(finalPackage.finalActivationAudit.releaseId, "master-8.10-20260809");
      assert.equal(finalPackage.finalActivationAudit.status, "PASS");
    });
  });
});
