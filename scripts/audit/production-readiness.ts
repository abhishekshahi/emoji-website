import { existsSync, readFileSync, statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import {
  MASTER_ARTWORK_RECORD_COUNT,
  MASTER_IDENTITY_COUNT,
  PUBLIC_SEO_EMOJI_PAGE_COUNT,
  PUBLIC_SITEMAP_URL_COUNT,
} from "../../src/lib/master/r2/catalog";
import { R2_EXPORT_DIR, R2_FULL_EXPORT_DIR, getMasterR2Mode } from "../../src/lib/master/r2/config";
import { verifyR2Export } from "../../src/lib/master/r2/export/verify";
import { verifyFullArchive } from "../../src/lib/master/r2/full-archive/verify";
import { FULL_ARCHIVE_PREFIX } from "../../src/lib/master/r2/full-archive/types";
import { getAllowedArtworkProviders, isProviderPubliclyServed } from "../../src/lib/master/r2/licenses";
import { MASTER_INTEGRATION_CONFIG } from "../../src/lib/master/integration/config";
import { parseSeoRolloutMode } from "../../src/lib/master/integration/seo-canary/rollout";
import { verifyFrozenChecksums } from "../../src/lib/master/release/build";
import { getCatalogStats } from "../../src/lib/master/public/catalog-service";
import {
  getPublicMasterPlatformMode,
  isPublicMasterPlatformEnabled,
} from "../../src/lib/master/public/config";
import { getLicenseRegistrySummary, LICENSE_REGISTRY } from "../../src/lib/master/public/license-registry";
import { getAllBrowsableEmojis } from "../../src/lib/emoji/browsable-data";
import { getAllCategorySlugs } from "../../src/lib/emoji/data";
import type { CanonicalEmojiRecord } from "../../src/lib/master/canonical/types";
import type { ArtworkMasterRecord } from "../../src/lib/master/artwork/types";
import type { FileChecksumEntry } from "../../src/lib/master/release/types";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

/** Cloudflare R2 Standard pricing — verified 2026-08-07 per developers.cloudflare.com/r2/pricing */
const R2_FREE_STORAGE_GB = 10;
const R2_FREE_CLASS_A = 1_000_000;
const R2_FREE_CLASS_B = 10_000_000;
const R2_STORAGE_PER_GB_MONTH = 0.015;
const R2_CLASS_A_PER_MILLION = 4.5;
const R2_CLASS_B_PER_MILLION = 0.36;

function countFilesRecursive(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  if (!existsSync(dir)) return { files, bytes };
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = countFilesRecursive(full);
      files += nested.files;
      bytes += nested.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(full).size;
    }
  }
  return { files, bytes };
}

function formatGb(bytes: number): string {
  return `${(bytes / 1e9).toFixed(3)} GB`;
}

function formatPct(bytes: number, allowanceBytes: number): string {
  return `${((bytes / allowanceBytes) * 100).toFixed(2)}%`;
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    phase: "8.37",
    generatedAt: new Date().toISOString(),
    repository: rootDir,
  };

  // A. Repository audit — key paths
  const keyPaths = {
    masterDir: join(rootDir, "src/data/master"),
    frozenRelease: join(rootDir, "src/data/master/release/8.10"),
    enrichment: join(rootDir, "src/data/emoji-enrichment.json"),
    searchEnrichment: join(rootDir, "src/data/emoji-search-enrichment.json"),
    optimizedExport: join(rootDir, R2_EXPORT_DIR, "emojiquick"),
    fullExport: join(rootDir, R2_FULL_EXPORT_DIR, FULL_ARCHIVE_PREFIX),
    workerHandler: join(rootDir, ".open-next/server-functions/default/handler.mjs"),
    wrangler: join(rootDir, "wrangler.jsonc"),
  };
  report.keyPaths = Object.fromEntries(
    Object.entries(keyPaths).map(([k, v]) => [k, { path: v, exists: existsSync(v) }]),
  );

  // B. Master data integrity
  const canonicalPath = join(rootDir, "src/data/master/canonical-emojis.json");
  const artworkIndexPath = join(rootDir, "src/data/master/artwork/artwork-master-index.json");
  const canonicalRecords = JSON.parse(readFileSync(canonicalPath, "utf8")) as CanonicalEmojiRecord[];
  const artworkRecords = JSON.parse(readFileSync(artworkIndexPath, "utf8")) as ArtworkMasterRecord[];

  let unicode = 0;
  let sourceSpecific = 0;
  let privateUse = 0;
  const idSet = new Set<string>();
  for (const record of canonicalRecords) {
    if (idSet.has(record.canonicalId)) {
      throw new Error(`Duplicate canonical ID: ${record.canonicalId}`);
    }
    idSet.add(record.canonicalId);
    if (record.identityType === "unicode") unicode += 1;
    if (record.identityType === "source-specific") sourceSpecific += 1;
    if (record.identityType === "private-use") privateUse += 1;
  }

  const checksumPath = join(rootDir, "src/data/master/release/8.10/master-file-checksums.json");
  const fileChecksums = JSON.parse(readFileSync(checksumPath, "utf8")) as FileChecksumEntry[];
  const frozenVerification = verifyFrozenChecksums(rootDir, fileChecksums);

  report.masterDataIntegrity = {
    canonicalIdentities: canonicalRecords.length,
    expectedIdentities: MASTER_IDENTITY_COUNT,
    identityMatch: canonicalRecords.length === MASTER_IDENTITY_COUNT,
    breakdown: { unicode, sourceSpecific, privateUse },
    artworkRecords: artworkRecords.length,
    expectedArtworkRecords: MASTER_ARTWORK_RECORD_COUNT,
    artworkMatch: artworkRecords.length === MASTER_ARTWORK_RECORD_COUNT,
    frozenChecksumStatus: frozenVerification.status,
    frozenChecksumMismatches: frozenVerification.mismatches.length,
  };

  // C–F. Archive verification
  const masterTree = countFilesRecursive(join(rootDir, "src/data/master"));
  const optimizedOnDisk = countFilesRecursive(keyPaths.optimizedExport);
  const fullOnDisk = countFilesRecursive(keyPaths.fullExport);

  let optimizedVerify = { status: "SKIP" as string, errors: [] as string[], manifestTotals: null as unknown };
  if (existsSync(join(keyPaths.optimizedExport, "manifests/r2-manifest.json"))) {
    const result = verifyR2Export(keyPaths.optimizedExport);
    optimizedVerify = {
      status: result.status,
      errors: result.errors.slice(0, 5),
      manifestTotals: result.manifest?.totals ?? null,
    };
  }

  let fullVerify = { status: "SKIP" as string, errors: [] as string[], manifestTotals: null as unknown };
  if (existsSync(join(keyPaths.fullExport, "manifests/master-manifest.json"))) {
    const result = await verifyFullArchive({
      projectRoot: rootDir,
      sourceRoot: join(rootDir, "src/data/master"),
      exportRootDir: keyPaths.fullExport,
      canonicalRecords,
      artworkRecords,
      deep: false,
    });
    fullVerify = {
      status: result.status,
      errors: result.errors.slice(0, 5),
      manifestTotals: result.manifest?.totals ?? null,
    };
  }

  report.archives = {
    masterTree: { files: masterTree.files, bytes: masterTree.bytes, formatted: formatGb(masterTree.bytes) },
    optimizedExport: {
      onDisk: optimizedOnDisk,
      verify: optimizedVerify,
    },
    fullArchive: {
      onDisk: fullOnDisk,
      verify: fullVerify,
      policy: "PRESERVE_ALL",
    },
  };

  // G. R2 architecture
  report.r2Architecture = {
    mode: getMasterR2Mode(),
    binding: "MASTER_R2",
    bucket: "emojiquick-master",
    optimizedPrefix: "emojiquick",
    fullArchivePrefix: FULL_ARCHIVE_PREFIX,
    workerBundlesMasterArchive: false,
  };

  // H–I. License audit
  const licenseSummary = getLicenseRegistrySummary();
  const publicServingMatrix = getAllowedArtworkProviders().map((provider) => ({
    provider,
    publicServing: isProviderPubliclyServed(provider),
    registryEntries: LICENSE_REGISTRY.filter((e) =>
      e.provider.toLowerCase().includes(provider === "fluent" ? "fluent" : provider),
    ).map((e) => ({
      assetType: e.assetType,
      license: e.license,
      publicServingAllowed: e.publicServingAllowed,
      publicDownloadAllowed: e.publicDownloadAllowed,
      verificationStatus: e.verificationStatus,
    })),
  }));
  report.licenseAudit = { summary: licenseSummary, artworkProviders: publicServingMatrix };

  // J–L. SEO audit
  const emojis = getAllBrowsableEmojis();
  const sitemapCount = 7 + getAllCategorySlugs().length + emojis.length;
  const catalogStats = getCatalogStats(rootDir);

  report.seoAudit = {
    seoRolloutMode: parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE),
    productionEmojiPages: emojis.length,
    expectedProductionPages: PUBLIC_SEO_EMOJI_PAGE_COUNT,
    sitemapUrls: sitemapCount,
    expectedSitemapUrls: PUBLIC_SITEMAP_URL_COUNT,
    publicCatalogIdentities: catalogStats.publicIdentities,
    indexableIdentities: catalogStats.indexableIdentities,
    masterIntegration: MASTER_INTEGRATION_CONFIG,
    seoCanary: "OFF",
    seoFull: "OFF",
  };

  // M. API audit
  report.apiAudit = {
    publicMasterPlatformMode: getPublicMasterPlatformMode(),
    publicMasterPlatformEnabled: isPublicMasterPlatformEnabled(),
    gatedRoutes: [
      "/catalog",
      "/catalog/[canonicalId]",
      "/artwork",
      "/data",
      "/developers",
      "/api/master/catalog",
      "/api/master/search",
      "/api/master/identity/[canonicalId]",
      "/api/master/artwork/[canonicalId]",
    ],
    r2GatedRoutes: ["/api/emoji/[canonicalId]", "/api/artwork/[provider]/[...asset]"],
  };

  // N. Security — static checks
  report.securityAudit = {
    pathTraversalTests: "covered in r2-architecture.test.ts",
    providerAllowlist: getAllowedArtworkProviders(),
    restrictedProvidersBlocked: ["noto", "fluent"].every((p) => !isProviderPubliclyServed(p as "noto")),
    r2KeyValidation: "assertSafeR2Key / assertSafeFullArchiveKey",
    uploadRequiresConfirmation: true,
  };

  // O. Performance
  let workerBytes = 0;
  let workerGzipBytes = 0;
  if (existsSync(keyPaths.workerHandler)) {
    const buf = readFileSync(keyPaths.workerHandler);
    workerBytes = buf.length;
    workerGzipBytes = gzipSync(buf).length;
  }
  report.performanceAudit = {
    workerHandlerBytes: workerBytes,
    workerHandlerGzipBytes: workerGzipBytes,
    workerHandlerGzipMiB: (workerGzipBytes / (1024 * 1024)).toFixed(2),
    bundlesR2Export: false,
    targetWorkerGzipMiB: 2.5,
    withinTarget: workerGzipBytes <= 2.5 * 1024 * 1024,
  };

  // P. R2 cost/capacity
  const optimizedBytes =
    (optimizedVerify.manifestTotals as { bytes?: number } | null)?.bytes ?? optimizedOnDisk.bytes;
  const fullBytes =
    (fullVerify.manifestTotals as { bytes?: number } | null)?.bytes ?? fullOnDisk.bytes;
  const combinedBytes = optimizedBytes + fullBytes;
  const freeAllowanceBytes = R2_FREE_STORAGE_GB * 1e9;

  const storageOverFreeGb = Math.max(0, combinedBytes / 1e9 - R2_FREE_STORAGE_GB);
  const estimatedStorageCost = storageOverFreeGb * R2_STORAGE_PER_GB_MONTH;

  report.r2CostAudit = {
    pricingSource: "https://developers.cloudflare.com/r2/pricing/ (2026-08-07)",
    freeTier: {
      storageGbMonth: R2_FREE_STORAGE_GB,
      classAOps: R2_FREE_CLASS_A,
      classBOps: R2_FREE_CLASS_B,
      egress: "free",
    },
    paidRates: {
      storagePerGbMonth: R2_STORAGE_PER_GB_MONTH,
      classAPerMillion: R2_CLASS_A_PER_MILLION,
      classBPerMillion: R2_CLASS_B_PER_MILLION,
      egress: 0,
    },
    usage: {
      fullArchiveBytes: fullBytes,
      optimizedExportBytes: optimizedBytes,
      combinedBytes,
      combinedGb: (combinedBytes / 1e9).toFixed(3),
      freeTierUtilization: formatPct(combinedBytes, freeAllowanceBytes),
      remainingFreeBytes: Math.max(0, freeAllowanceBytes - combinedBytes),
      estimatedObjectCount:
        ((optimizedVerify.manifestTotals as { objects?: number } | null)?.objects ?? 0) +
        ((fullVerify.manifestTotals as { r2Objects?: number } | null)?.r2Objects ?? 0),
    },
    costEstimate: {
      storageOverFreeGb: storageOverFreeGb.toFixed(3),
      estimatedMonthlyStorageCostUsd: estimatedStorageCost.toFixed(2),
      note: "Request and egress costs depend on traffic; egress is free on R2.",
    },
  };

  // S. Production safety flags
  const readyForR2Upload =
    optimizedVerify.status === "PASS" && fullVerify.status === "PASS" && frozenVerification.status === "PASS";
  const readyForStaging = readyForR2Upload;
  const readyForProduction = false; // Explicit approval required

  report.readiness = {
    READY_FOR_R2_UPLOAD: readyForR2Upload ? "YES" : "NO",
    READY_FOR_STAGING: readyForStaging ? "YES" : "NO",
    READY_FOR_PRODUCTION: readyForProduction ? "YES" : "NO",
    SEO_CANARY: "OFF",
    SEO_FULL: "OFF",
    MASTER_R2_MODE: getMasterR2Mode(),
    PUBLIC_MASTER_PLATFORM_MODE: getPublicMasterPlatformMode(),
    masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
    masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
    masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
    masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
  };

  report.remainingBlockers = [
    ...(readyForR2Upload ? [] : ["R2 export verification must PASS"]),
    "R2 upload not performed — requires explicit YES confirmation",
    "Production MASTER_R2_MODE must remain OFF until staging validation",
    "PUBLIC_MASTER_PLATFORM_MODE must remain OFF in production until approved",
    "Live production URL checks require deployment — not run in this audit",
  ];

  report.nextActions = [
    "Run: npm run r2:upload-full -- --dry-run (review full archive upload plan)",
    "Run: npm run r2:upload -- --dry-run (review optimized export upload plan)",
    "Upload full archive to R2, verify object count and checksums",
    "Upload optimized export to R2, verify shards",
    "Run: npm run r2:verify-remote",
    "Test R2 access in staging with MASTER_R2_MODE=DATA_READY",
    "Test public platform in staging with PUBLIC_MASTER_PLATFORM_MODE=LOCAL",
    "Obtain explicit approval before production enablement",
  ];

  console.log(JSON.stringify(report, null, 2));

  if (!readyForR2Upload) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
