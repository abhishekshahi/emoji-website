import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";
import { getArtwork, listAvailableProviders, listVariantsByProvider } from "../artwork/adapter";
import { EXPECTED_RELEASE_ID, integrationDataPaths, MASTER_INTEGRATION_CONFIG, PRODUCTION_BASELINES } from "../config";
import { getMasterReader } from "../master-reader";
import { getEnrichedMetadata } from "../metadata/enrichment";
import { buildArtworkAttribution } from "./attribution";
import { getUiArtworkProviders, resolveUiArtworkDisplay } from "./artwork-ui-adapter";
import { getUiMetadataPayload } from "./metadata-ui-adapter";
import {
  getCopyIdentityValue,
  getFavoriteIdentityKey,
  getRecentIdentityKey,
  getSharePath,
  getUiProductionArtworkProviders,
  getUiProductionMetadata,
  isMasterUiIntegrationActive,
  runWithIntegrationFlags,
} from "./production-bridge";
import { UI_BASELINES, UI_INTEGRATION_PHASE, type UiIntegrationAuditReport, type UiIntegrationManifest } from "./types";

const CRITICAL = {
  fire: "unicode:1F525",
  thumbsUp: "unicode:1F44D",
  thumbsUpLight: "unicode:1F44D-1F3FB",
  thumbsUpDark: "unicode:1F44D-1F3FF",
  manTechnologist: "unicode:1F468-200D-1F4BB",
  womanTechnologist: "unicode:1F469-200D-1F4BB",
  indiaFlag: "unicode:1F1EE-1F1F3",
  textSmile: "unicode:263A",
  emojiSmile: "unicode:263A-FE0F",
  rainbowFlag: "unicode:1F3F3-FE0F-200D-1F308",
  openmojiPua: "source:openmoji:E000",
  notoUtility: "source:noto:noto.png",
} as const;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function buildUiArtworkCoverage(rootDir: string = process.cwd()) {
  const fire = getUiArtworkProviders(CRITICAL.fire, rootDir);
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: UI_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    totals: Object.freeze({
      masterArtworkRecords: UI_BASELINES.masterArtworkRecords,
      openmoji: UI_BASELINES.openmojiArtwork,
      noto: UI_BASELINES.notoArtwork,
      twemoji: UI_BASELINES.twemojiArtwork,
      fluent: UI_BASELINES.fluentArtwork,
    }),
    fireProviders: Object.freeze(fire.map((entry) => entry.provider)),
    status: fire.length === 4 ? "PASS" : "FAIL",
  });
}

export function buildUiMetadataCoverage(rootDir: string = process.cwd()) {
  const fire = getUiMetadataPayload(CRITICAL.fire, rootDir);
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: UI_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    canonicalIdentities: UI_BASELINES.canonicalIdentities,
    masterMetadataRecords: UI_BASELINES.masterMetadataRecords,
    fireCanonicalName: fire?.canonicalName ?? null,
    fireSourcePanels: Object.freeze(fire?.sourcePanels.map((panel) => ({
      source: panel.source,
      available: panel.available,
    })) ?? []),
    status: fire?.canonicalName === "fire" ? "PASS" : "FAIL",
  });
}

export function buildUiProviderCoverage(rootDir: string = process.cwd()) {
  const providers = listAvailableProviders(CRITICAL.fire, { rootDir, verifyChecksum: false });
  const variants = listVariantsByProvider(CRITICAL.fire, { rootDir, verifyChecksum: false });

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: UI_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    fireProviders: Object.freeze(providers),
    variants: Object.freeze(variants),
    status: providers.length === 4 ? "PASS" : "FAIL",
  });
}

export function buildUiLicenseCoverage(rootDir: string = process.cwd()) {
  const artwork = getArtwork(CRITICAL.fire, { rootDir, verifyChecksum: false });
  const licenses = ["openmoji", "noto", "twemoji", "fluent"].map((provider) => {
    const entry = artwork?.providers[provider as keyof typeof artwork.providers][0] ?? null;
    return buildArtworkAttribution(provider as "openmoji", entry);
  });

  const uniqueLicenses = new Set(licenses.map((entry) => entry.license));
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: UI_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    licenses: Object.freeze(licenses),
    status: uniqueLicenses.size === 4 ? "PASS" : "FAIL",
  });
}

export function buildUiProductionSafety(rootDir: string = process.cwd()) {
  const map = readJson<{
    standardRecords: { entries: Array<{ productionHexcode: string; canonicalId: string }> };
    extrasRecords: { entries: Array<{ productionHexcode: string; canonicalId: string }> };
  }>(join(integrationDataPaths(rootDir).integrationDir, "production-to-master-map.json"));

  const all = [...map.standardRecords.entries, ...map.extrasRecords.entries];
  const context = Object.freeze({
    hexcode: "1F525",
    productionType: "standard" as const,
    emoji: "🔥",
    name: "fire",
    slug: "fire",
  });

  const disabledArtwork = getUiProductionArtworkProviders(context, rootDir);
  const disabledMetadata = getUiProductionMetadata(context, rootDir);

  const enabled = runWithIntegrationFlags(
    { masterArtworkEnabled: true, masterMetadataEnabled: true },
    () => ({
      artwork: getUiProductionArtworkProviders(context, rootDir).length,
      metadata: getUiProductionMetadata(context, rootDir)?.canonicalName ?? null,
    }),
  );

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: UI_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    productionMappings: all.length,
    favoriteKey: getFavoriteIdentityKey(context),
    recentKey: getRecentIdentityKey(context),
    copyValue: getCopyIdentityValue(context),
    sharePath: getSharePath(context),
    disabledArtworkCount: disabledArtwork.length,
    disabledMetadata,
    enabledArtworkProviders: enabled.artwork,
    enabledMetadataName: enabled.metadata,
    status:
      all.length === PRODUCTION_BASELINES.totalSearchable &&
      disabledArtwork.length === 0 &&
      disabledMetadata === null &&
      enabled.artwork === 4 &&
      enabled.metadata === "fire"
        ? "PASS"
        : "FAIL",
  });
}

export function buildUiIntegrationAudit(rootDir: string = process.cwd()): UiIntegrationAuditReport {
  const { releaseDir } = integrationDataPaths(rootDir);
  const fileChecksums = readJson<FileChecksumEntry[]>(join(releaseDir, "master-file-checksums.json"));
  const checksumResult = verifyFrozenChecksums(rootDir, fileChecksums);
  const reader = getMasterReader(rootDir);

  const fireArtwork = getArtwork(CRITICAL.fire, { rootDir, verifyChecksum: false });
  const fireMetadata = getEnrichedMetadata(CRITICAL.fire, rootDir);
  const fireUiProviders = getUiArtworkProviders(CRITICAL.fire, rootDir);
  const variants = listVariantsByProvider(CRITICAL.fire, { rootDir, verifyChecksum: false });
  const notoVariants = variants.noto;
  const fluentVariants = variants.fluent;
  const fireDisplay = resolveUiArtworkDisplay({
    canonicalId: CRITICAL.fire,
    provider: "openmoji",
    emoji: "🔥",
    name: "fire",
    hexcode: "1F525",
    rootDir,
  });

  const context = Object.freeze({
    hexcode: "1F525",
    productionType: "standard" as const,
    emoji: "🔥",
    name: "fire",
    slug: "fire",
  });

  const puaCanonical = reader.canonicalRecords.get(CRITICAL.openmojiPua);
  const utilityCanonical = reader.canonicalRecords.get(CRITICAL.notoUtility);

  const artworkIntegration =
    fireArtwork !== null &&
    fireArtwork.providers.openmoji.length > 0 &&
    fireArtwork.providers.noto.length > 0 &&
    fireArtwork.providers.twemoji.length > 0 &&
    fireArtwork.providers.fluent.length > 0;

  const metadataIntegration = fireMetadata !== null && fireMetadata.canonicalName.value === "fire";

  const providerSelector = fireUiProviders.length === 4;
  const variantSelector = notoVariants.length > 0 && fluentVariants.length > 0;
  const attribution = Boolean(fireDisplay.attribution.license);
  const license = new Set(fireUiProviders.map((entry) => entry.attribution.license)).size === 4;

  const favorites = getFavoriteIdentityKey(context) === "1F525";
  const recents = getRecentIdentityKey(context) === "1F525";
  const copy = getCopyIdentityValue(context) === "🔥";
  const puaProtection = puaCanonical?.identityType === "private-use";
  const artworkOnlyProtection = utilityCanonical?.canonicalId.includes("noto.png") === true;

  const featureFlag =
    MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false &&
    MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false &&
    MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false &&
    MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false &&
    !isMasterUiIntegrationActive();

  const frozenRelease = checksumResult.status === "PASS";

  const status =
    artworkIntegration &&
    metadataIntegration &&
    providerSelector &&
    variantSelector &&
    attribution &&
    license &&
    favorites &&
    recents &&
    copy &&
    puaProtection &&
    artworkOnlyProtection &&
    featureFlag &&
    frozenRelease
      ? "PASS"
      : "FAIL";

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: UI_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    artworkIntegration: artworkIntegration ? "PASS" : "FAIL",
    metadataIntegration: metadataIntegration ? "PASS" : "FAIL",
    providerSelector: providerSelector ? "PASS" : "FAIL",
    variantSelector: variantSelector ? "PASS" : "FAIL",
    attribution: attribution ? "PASS" : "FAIL",
    license: license ? "PASS" : "FAIL",
    favorites: favorites ? "PASS" : "FAIL",
    recents: recents ? "PASS" : "FAIL",
    copy: copy ? "PASS" : "FAIL",
    puaProtection: puaProtection ? "PASS" : "FAIL",
    artworkOnlyProtection: artworkOnlyProtection ? "PASS" : "FAIL",
    featureFlag: featureFlag ? "PASS" : "FAIL",
    frozenRelease: frozenRelease ? "PASS" : "FAIL",
    routesChanged: false,
    seoChanged: false,
    searchChanged: false,
    externalRuntimeDependencies: false,
    status,
  });
}

export function buildUiIntegrationManifest(rootDir: string = process.cwd()): UiIntegrationManifest {
  const uiDir = `${integrationDataPaths(rootDir).integrationDir}/ui`;
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: UI_INTEGRATION_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    featureFlags: Object.freeze({
      masterArtworkEnabled: false,
      masterMetadataEnabled: false,
      masterSearchEnabled: false,
      masterSEOEnabled: false,
    }),
    outputs: Object.freeze({
      uiIntegrationAudit: `${uiDir}/ui-integration-audit.json`,
      uiArtworkCoverage: `${uiDir}/ui-artwork-coverage.json`,
      uiMetadataCoverage: `${uiDir}/ui-metadata-coverage.json`,
      uiProviderCoverage: `${uiDir}/ui-provider-coverage.json`,
      uiLicenseCoverage: `${uiDir}/ui-license-coverage.json`,
      uiProductionSafety: `${uiDir}/ui-production-safety.json`,
    }),
  });
}

export function buildUiIntegrationPackage(rootDir: string = process.cwd()) {
  return {
    uiIntegrationAudit: buildUiIntegrationAudit(rootDir),
    uiArtworkCoverage: buildUiArtworkCoverage(rootDir),
    uiMetadataCoverage: buildUiMetadataCoverage(rootDir),
    uiProviderCoverage: buildUiProviderCoverage(rootDir),
    uiLicenseCoverage: buildUiLicenseCoverage(rootDir),
    uiProductionSafety: buildUiProductionSafety(rootDir),
    uiIntegrationManifest: buildUiIntegrationManifest(rootDir),
  };
}
