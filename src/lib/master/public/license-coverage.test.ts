import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import {
  auditArtworkRecord,
  buildLicenseCoverageAudit,
  classifyFluentAsset,
  classifyNotoAsset,
  FLUENT_LICENSE_EVIDENCE,
  isArtworkPathPublicEligible,
  NOTO_FONT_LICENSE_EVIDENCE,
  NOTO_SVG_LICENSE_EVIDENCE,
} from "@/lib/master/public/license-coverage";
import { buildPublicArtworkApiUrl } from "@/lib/master/public/artwork-api-url";
import { LICENSE_REGISTRY } from "@/lib/master/public/license-registry";
import {
  canDownloadArtworkProvider,
  canPublicServeArtworkProvider,
  isRestrictedMetadataSource,
  sanitizePublicProvenanceSource,
} from "@/lib/master/public/asset-rights";
import { parsePublicArtworkApiPath } from "@/lib/r2/artwork-binary-route";

function loadArtworkMasterIndex(): ArtworkMasterRecord[] {
  return JSON.parse(
    readFileSync(join(process.cwd(), "src/data/master/artwork/artwork-master-index.json"), "utf8"),
  ) as ArtworkMasterRecord[];
}

describe("license coverage audit", () => {
  const records = loadArtworkMasterIndex();
  const report = buildLicenseCoverageAudit(records);
  const notoReport = report.providers.find((p) => p.provider === "Noto")!;
  const fluentReport = report.providers.find((p) => p.provider === "Fluent")!;

  it("audits full Noto inventory with path-based classification", () => {
    assert.equal(notoReport.totalAssets, 19673);
    assert.equal(notoReport.verifiedAssets + notoReport.pendingAssets + notoReport.restrictedAssets, 19673);
    assert.ok(notoReport.evidence.includes(NOTO_SVG_LICENSE_EVIDENCE));
    assert.ok(notoReport.evidence.includes(NOTO_FONT_LICENSE_EVIDENCE));
    assert.equal(notoReport.classification.font ?? 0, 0);
    assert.equal(notoReport.publicAssets, 19672);
    assert.equal(notoReport.pendingAssets, 1);
    assert.equal(notoReport.restrictedAssets, 0);
    assert.equal(notoReport.unverifiedPaths.length, 1);
    assert.equal(notoReport.unverifiedPaths[0], "artwork/noto/images/noto.png");
  });

  it("audits full Fluent inventory under MIT repository policy", () => {
    assert.equal(fluentReport.totalAssets, 7885);
    assert.equal(fluentReport.verifiedAssets, 7885);
    assert.equal(fluentReport.publicAssets, 7885);
    assert.equal(fluentReport.downloadableAssets, 7885);
    assert.equal(fluentReport.pendingAssets, 0);
    assert.equal(fluentReport.restrictedAssets, 0);
    assert.ok(fluentReport.evidence.includes(FLUENT_LICENSE_EVIDENCE));
    assert.equal(fluentReport.classification.unknown ?? 0, 0);
  });

  it("classifies representative Noto SVG and PNG as verified Apache assets", () => {
    const svg = records.find((r) => r.provider === "noto" && r.filePath.includes("/svg/emoji_u"));
    const png = records.find((r) => r.provider === "noto" && r.filePath.includes("/png/32/"));
    assert.ok(svg && png);
    const svgC = classifyNotoAsset(svg);
    const pngC = classifyNotoAsset(png);
    assert.equal(svgC.class, "svg-image");
    assert.equal(svgC.disposition, "verified");
    assert.equal(pngC.class, "png-image");
    assert.equal(pngC.disposition, "verified");
  });

  it("classifies every public-eligible asset through auditArtworkRecord", () => {
    const noto = records.filter((r) => r.provider === "noto");
    const fluent = records.filter((r) => r.provider === "fluent");
    for (const record of noto) {
      const result = auditArtworkRecord(record);
      if (result.publicEligible) {
        assert.equal(result.disposition, "verified");
        assert.equal(result.downloadEligible, true);
      }
    }
    for (const record of fluent) {
      const result = auditArtworkRecord(record);
      assert.equal(result.disposition, "verified");
      assert.equal(result.publicEligible, true);
      assert.equal(classifyFluentAsset(record).class, "fluent-assets");
    }
  });

  it("keeps provider gates aligned with verified registry policy", () => {
    assert.equal(canPublicServeArtworkProvider("noto"), true);
    assert.equal(canDownloadArtworkProvider("noto"), true);
    assert.equal(canPublicServeArtworkProvider("fluent"), true);
    assert.equal(canDownloadArtworkProvider("fluent"), true);
    assert.equal(report.emojinet.public, false);
    assert.equal(report.emojinet.downloadable, false);
    const emojinet = LICENSE_REGISTRY.find((e) => e.provider === "EmojiNet");
    assert.equal(emojinet?.publicServingAllowed, false);
    assert.equal(emojinet?.verificationStatus, "restricted");
  });

  it("blocks EmojiNet from public enrichment and provenance", () => {
    for (const rel of ["src/data/emoji-enrichment.json", "src/data/emoji-search-enrichment.json"]) {
      const raw = readFileSync(join(process.cwd(), rel), "utf8");
      assert.equal(/emojinet/i.test(raw), false, `${rel} must not reference EmojiNet`);
    }
    assert.equal(isRestrictedMetadataSource("emojinet"), true);
    assert.equal(sanitizePublicProvenanceSource("emojinet"), "restricted-source");
  });

  it("blocks utility Noto brand image from per-path public eligibility", () => {
    assert.equal(isArtworkPathPublicEligible("noto", "artwork/noto/images/noto.png"), false);
    assert.equal(isArtworkPathPublicEligible("noto", "artwork/noto/png/32/emoji_u1f525.png"), true);
    assert.equal(isArtworkPathPublicEligible("fluent", "artwork/fluent/assets/Fire/Color/fire_color.svg"), true);
    assert.equal(isArtworkPathPublicEligible("fluent", "artwork/fluent/other/fire.svg"), false);
    assert.equal(isArtworkPathPublicEligible("openmoji", "artwork/openmoji/1F525.svg"), true);
    assert.equal(isArtworkPathPublicEligible("twemoji", "artwork/twemoji/assets/72x72/1f525.png"), true);
  });

  it("parses public artwork API paths with embedded file extensions", () => {
    const openmoji = parsePublicArtworkApiPath("openmoji", ["openmoji-artwork:1F525.svg"]);
    assert.equal(openmoji.sourceId, "openmoji-artwork:1F525");
    assert.equal(openmoji.format, "svg");

    const twemoji = parsePublicArtworkApiPath("twemoji", ["twemoji-artwork:1F525:1f525.png"]);
    assert.equal(twemoji.sourceId, "twemoji-artwork:1F525:1f525.png");
    assert.equal(twemoji.format, "png");

    const noto = parsePublicArtworkApiPath("noto", ["noto-artwork:1F525:emoji_u1f525.png"]);
    assert.equal(noto.sourceId, "noto-artwork:1F525:emoji_u1f525.png");
    assert.equal(noto.format, "png");

    const fluent = parsePublicArtworkApiPath("fluent", ["fluent-artwork:fire_color.svg:fire_color.svg"]);
    assert.equal(fluent.sourceId, "fluent-artwork:fire_color.svg:fire_color.svg");
    assert.equal(fluent.format, "svg");
  });

  it("builds artwork API URLs without duplicate extensions", () => {
    assert.equal(
      buildPublicArtworkApiUrl("twemoji", "twemoji-artwork:1F525:1f525.png"),
      "/api/artwork/twemoji/twemoji-artwork:1F525:1f525.png",
    );
    assert.equal(
      buildPublicArtworkApiUrl("openmoji", "openmoji-artwork:1F525", "svg"),
      "/api/artwork/openmoji/openmoji-artwork:1F525.svg",
    );
  });
});
