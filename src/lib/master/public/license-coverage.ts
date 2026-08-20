import type { ArtworkMasterRecord, ArtworkProvider } from "@/lib/master/artwork/types";
import {
  canDownloadArtworkProvider,
  canPublicServeArtworkProvider,
} from "./asset-rights";

export const NOTO_SVG_LICENSE_EVIDENCE =
  "https://github.com/googlefonts/noto-emoji/blob/main/svg/LICENSE" as const;
export const NOTO_FONT_LICENSE_EVIDENCE =
  "https://github.com/googlefonts/noto-emoji/blob/main/fonts/LICENSE" as const;
export const FLUENT_LICENSE_EVIDENCE =
  "https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE" as const;

export type NotoAssetClass =
  | "svg-image"
  | "png-image"
  | "region-flags"
  | "brand-image"
  | "font"
  | "unknown";

export type FluentAssetClass = "fluent-assets" | "unknown";

export type CoverageDisposition = "verified" | "pending" | "restricted";

export interface AssetCoverageResult {
  readonly artworkId: string;
  readonly filePath: string;
  readonly disposition: CoverageDisposition;
  readonly publicEligible: boolean;
  readonly downloadEligible: boolean;
  readonly reason: string;
  readonly assetClass: string;
}

export interface ProviderCoverageReport {
  readonly provider: string;
  readonly totalAssets: number;
  readonly verifiedAssets: number;
  readonly publicAssets: number;
  readonly downloadableAssets: number;
  readonly pendingAssets: number;
  readonly restrictedAssets: number;
  readonly unknownAssets: number;
  readonly coveragePercentage: number;
  readonly evidence: readonly string[];
  readonly providerPublicGate: boolean;
  readonly providerDownloadGate: boolean;
  readonly classification: Readonly<Record<string, number>>;
  readonly unverifiedPaths: readonly string[];
}

export interface LicenseCoverageAuditReport {
  readonly generatedAt: string;
  readonly providers: readonly ProviderCoverageReport[];
  readonly emojinet: {
    readonly public: boolean;
    readonly downloadable: boolean;
    readonly verificationStatus: string;
  };
}

const APACHE_LICENSES = new Set(["Apache-2.0", "Apache License 2.0"]);

function isApacheRecord(record: ArtworkMasterRecord): boolean {
  return APACHE_LICENSES.has(record.license);
}

function isActiveIntegrity(record: ArtworkMasterRecord): boolean {
  return record.checksumVerified && record.status === "active";
}

export function classifyNotoAsset(record: ArtworkMasterRecord): {
  readonly class: NotoAssetClass;
  readonly disposition: CoverageDisposition;
  readonly publicEligible: boolean;
  readonly downloadEligible: boolean;
  readonly reason: string;
} {
  const path = record.filePath;

  if (/font/i.test(path) || /\.(ttf|otf|woff2?)$/i.test(path)) {
    const ok = isActiveIntegrity(record);
    return {
      class: "font",
      disposition: ok ? "verified" : "pending",
      publicEligible: ok,
      downloadEligible: ok,
      reason: ok
        ? "Official Noto Emoji font path — OFL 1.1 (fonts/LICENSE)"
        : "Noto font asset failed integrity or status checks",
    };
  }

  if (/^artwork\/noto\/svg\//.test(path)) {
    const ok = isApacheRecord(record) && isActiveIntegrity(record);
    return {
      class: "svg-image",
      disposition: ok ? "verified" : "pending",
      publicEligible: ok,
      downloadEligible: ok,
      reason: ok
        ? "Noto SVG emoji resource — Apache-2.0 (svg/LICENSE)"
        : "Noto SVG asset missing Apache license or integrity verification",
    };
  }

  if (/^artwork\/noto\/png\//.test(path)) {
    const ok = isApacheRecord(record) && isActiveIntegrity(record);
    return {
      class: "png-image",
      disposition: ok ? "verified" : "pending",
      publicEligible: ok,
      downloadEligible: ok,
      reason: ok
        ? "Noto PNG emoji resource — Apache-2.0 (svg/LICENSE)"
        : "Noto PNG asset missing Apache license or integrity verification",
    };
  }

  if (/third_party\/region-flags/.test(path)) {
    const ok = isApacheRecord(record) && record.checksumVerified;
    return {
      class: "region-flags",
      disposition: ok ? "verified" : "pending",
      publicEligible: ok,
      downloadEligible: ok,
      reason: ok
        ? "Noto third_party region flags — Apache-2.0 in official noto-emoji tree"
        : "Region-flag asset failed license or checksum verification",
    };
  }

  if (/^artwork\/noto\/images\//.test(path)) {
    return {
      class: "brand-image",
      disposition: "pending",
      publicEligible: false,
      downloadEligible: false,
      reason:
        "Utility/branding image (utility-support) — not part of verified public emoji glyph library",
    };
  }

  return {
    class: "unknown",
    disposition: "restricted",
    publicEligible: false,
    downloadEligible: false,
    reason: `Unrecognized Noto path: ${path}`,
  };
}

export function classifyFluentAsset(record: ArtworkMasterRecord): {
  readonly class: FluentAssetClass;
  readonly disposition: CoverageDisposition;
  readonly publicEligible: boolean;
  readonly downloadEligible: boolean;
  readonly reason: string;
} {
  const path = record.filePath;
  if (!/^artwork\/fluent\/assets\//.test(path)) {
    return {
      class: "unknown",
      disposition: "restricted",
      publicEligible: false,
      downloadEligible: false,
      reason: `Unrecognized Fluent path: ${path}`,
    };
  }

  const ok =
    record.license === "MIT" &&
    record.checksumVerified &&
    record.status === "active";

  return {
    class: "fluent-assets",
    disposition: ok ? "verified" : "pending",
    publicEligible: ok,
    downloadEligible: ok,
    reason: ok
      ? "Fluent Emoji asset under artwork/fluent/assets — MIT (repository LICENSE)"
      : "Fluent asset failed MIT license, integrity, or status checks",
  };
}

export function auditArtworkRecord(record: ArtworkMasterRecord): AssetCoverageResult {
  if (record.provider === "noto") {
    const c = classifyNotoAsset(record);
    return Object.freeze({
      artworkId: record.artworkId,
      filePath: record.filePath,
      disposition: c.disposition,
      publicEligible: c.publicEligible,
      downloadEligible: c.downloadEligible,
      reason: c.reason,
      assetClass: c.class,
    });
  }

  if (record.provider === "fluent") {
    const c = classifyFluentAsset(record);
    return Object.freeze({
      artworkId: record.artworkId,
      filePath: record.filePath,
      disposition: c.disposition,
      publicEligible: c.publicEligible,
      downloadEligible: c.downloadEligible,
      reason: c.reason,
      assetClass: c.class,
    });
  }

  return Object.freeze({
    artworkId: record.artworkId,
    filePath: record.filePath,
    disposition: "restricted",
    publicEligible: false,
    downloadEligible: false,
    reason: "Provider not covered by this audit",
    assetClass: "other",
  });
}

function buildProviderReport(
  provider: ArtworkProvider,
  records: readonly ArtworkMasterRecord[],
  evidence: readonly string[],
  classify: (r: ArtworkMasterRecord) => AssetCoverageResult,
): ProviderCoverageReport {
  const classification: Record<string, number> = {};
  let verified = 0;
  let publicAssets = 0;
  let downloadable = 0;
  let pending = 0;
  let restricted = 0;
  let unknown = 0;
  const unverifiedPaths: string[] = [];

  for (const record of records) {
    const result = classify(record);
    classification[result.assetClass] = (classification[result.assetClass] ?? 0) + 1;

    if (result.disposition === "verified") verified += 1;
    if (result.disposition === "pending") pending += 1;
    if (result.disposition === "restricted") restricted += 1;
    if (result.assetClass === "unknown") unknown += 1;
    if (result.publicEligible) publicAssets += 1;
    if (result.downloadEligible) downloadable += 1;
    if (!result.publicEligible) unverifiedPaths.push(record.filePath);
  }

  const total = records.length;
  const coveragePercentage = total === 0 ? 0 : Math.round((verified / total) * 10000) / 100;

  return Object.freeze({
    provider: provider === "noto" ? "Noto" : "Fluent",
    totalAssets: total,
    verifiedAssets: verified,
    publicAssets,
    downloadableAssets: downloadable,
    pendingAssets: pending,
    restrictedAssets: restricted,
    unknownAssets: unknown,
    coveragePercentage,
    evidence,
    providerPublicGate: canPublicServeArtworkProvider(provider),
    providerDownloadGate: canDownloadArtworkProvider(provider),
    classification: Object.freeze({ ...classification }),
    unverifiedPaths: Object.freeze(unverifiedPaths),
  });
}

export function buildLicenseCoverageAudit(
  records: readonly ArtworkMasterRecord[],
): LicenseCoverageAuditReport {
  const notoRecords = records.filter((r) => r.provider === "noto");
  const fluentRecords = records.filter((r) => r.provider === "fluent");

  return Object.freeze({
    generatedAt: new Date().toISOString(),
    providers: Object.freeze([
      buildProviderReport("noto", notoRecords, [NOTO_SVG_LICENSE_EVIDENCE, NOTO_FONT_LICENSE_EVIDENCE], auditArtworkRecord),
      buildProviderReport("fluent", fluentRecords, [FLUENT_LICENSE_EVIDENCE], auditArtworkRecord),
    ]),
    emojinet: Object.freeze({
      public: false,
      downloadable: false,
      verificationStatus: "RESTRICTED",
    }),
  });
}

/** Per-asset public gate for artwork binary routes (no provider-name-only bypass). */
export function isArtworkPathPublicEligible(provider: ArtworkProvider, filePath: string): boolean {
  if (provider === "noto") {
    const disposition = classifyNotoAsset({
      artworkId: "",
      provider: "noto",
      sourceVersion: "",
      sourceId: "",
      canonicalId: "",
      filePath,
      publicPath: "",
      format: "png",
      checksum: "",
      checksumVerified: true,
      license: "Apache-2.0",
      licenseURL: "",
      attribution: null,
      artworkVariant: "",
      isUnicode: true,
      status: filePath.includes("/images/") ? "utility-support" : "active",
      duplicateBinary: false,
      duplicateBinaryGroupId: null,
      rawRecordRef: "",
    });
    return disposition.publicEligible;
  }

  if (provider === "fluent") {
    const disposition = classifyFluentAsset({
      artworkId: "",
      provider: "fluent",
      sourceVersion: "",
      sourceId: "",
      canonicalId: "",
      filePath,
      publicPath: "",
      format: "svg",
      checksum: "",
      checksumVerified: true,
      license: "MIT",
      licenseURL: "",
      attribution: null,
      artworkVariant: "color",
      isUnicode: true,
      status: "active",
      duplicateBinary: false,
      duplicateBinaryGroupId: null,
      rawRecordRef: "",
    });
    return disposition.publicEligible;
  }

  return canPublicServeArtworkProvider(provider);
}
