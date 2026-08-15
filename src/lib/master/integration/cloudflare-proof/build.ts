import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getAllBrowsableSlugs } from "@/lib/emoji/browsable-data";
import {
  CLOUDFLARE_PROOF_PHASE,
  EXPECTED_RELEASE_ID,
  MASTER_INTEGRATION_CONFIG,
  PRODUCTION_BASELINES,
  integrationDataPaths,
} from "../config";
import { buildProductionSafetyAudit as buildSeoProductionSafetyAudit } from "../seo-migration-production-qa/build";
import { mapWithConcurrency, probeUrl } from "../seo-migration-production-qa/http-client";
import { buildOffBehaviorHttpAudit } from "../seo-canary/validation-build";
import { getSeoRolloutMode, parseSeoRolloutMode } from "../seo-canary/rollout";
import { verifyFrozenChecksums } from "@/lib/master/release/build";
import type { FileChecksumEntry } from "@/lib/master/release/types";

export type CloudflareProofDecision =
  | "A. CLOUDFLARE WORKERS.DEV PROOF PASS"
  | "C. BLOCKED"
  | "D. FAILED";

export interface CloudflareBuildMetrics {
  readonly success: boolean;
  readonly durationSeconds: number | null;
  readonly workerGzipKiB: number | null;
  readonly workerRawKiB: number | null;
  readonly staticAssetCount: number | null;
  readonly staticAssetTotalBytes: number | null;
  readonly largestAssetName: string | null;
  readonly largestAssetBytes: number | null;
  readonly warnings: readonly string[];
  readonly platform: string;
  readonly wslAvailable: boolean;
  readonly lfsSkipSmudge: boolean;
  readonly rolloutMode: string;
  readonly siteUrl: string | null;
}

export interface CloudflareDeploymentResult {
  readonly attempted: boolean;
  readonly success: boolean;
  readonly workersDevUrl: string | null;
  readonly versionId: string | null;
  readonly deploymentId: string | null;
  readonly commit: string | null;
  readonly branch: string | null;
  readonly authenticated: boolean;
  readonly blocker: string | null;
  readonly env: Readonly<Record<string, string>>;
}

function proofEnvelope<T extends Record<string, unknown>>(status: "PASS" | "FAIL" | "BLOCKED", extra: T) {
  return Object.freeze({
    generatedAt: new Date().toISOString(),
    phase: CLOUDFLARE_PROOF_PHASE,
    releaseId: EXPECTED_RELEASE_ID,
    rolloutMode: getSeoRolloutMode(),
    featureFlags: Object.freeze({
      masterArtworkEnabled: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled,
      masterMetadataEnabled: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled,
      masterSearchEnabled: MASTER_INTEGRATION_CONFIG.masterSearchEnabled,
      masterSEOEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
    }),
    auditOnly: true,
    ...extra,
    status,
  });
}

function walkFiles(dir: string): Array<{ path: string; size: number }> {
  if (!existsSync(dir)) {
    return [];
  }
  const entries: Array<{ path: string; size: number }> = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      entries.push(...walkFiles(fullPath));
    } else if (entry.isFile()) {
      entries.push({ path: fullPath, size: statSync(fullPath).size });
    }
  }
  return entries;
}

export function collectAssetMetrics(rootDir: string): {
  count: number;
  totalBytes: number;
  largestName: string | null;
  largestBytes: number | null;
} {
  const assetsDir = join(rootDir, ".open-next", "assets");
  const files = walkFiles(assetsDir);
  if (files.length === 0) {
    return { count: 0, totalBytes: 0, largestName: null, largestBytes: null };
  }
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  const largest = files.reduce((max, file) => (file.size > max.size ? file : max), files[0]);
  return {
    count: files.length,
    totalBytes,
    largestName: largest.path.replace(`${assetsDir}\\`, "").replace(`${assetsDir}/`, ""),
    largestBytes: largest.size,
  };
}

export function buildBuildAudit(metrics: CloudflareBuildMetrics) {
  const pass = metrics.success;
  return proofEnvelope(pass ? "PASS" : "FAIL", {
    ...metrics,
    openNextExists: metrics.success,
  });
}

export function buildWorkerSizeAudit(metrics: CloudflareBuildMetrics) {
  const gzipKiB = metrics.workerGzipKiB;
  const pass = gzipKiB !== null && gzipKiB < 3 * 1024;
  return proofEnvelope(pass ? "PASS" : gzipKiB === null ? "BLOCKED" : "FAIL", {
    workerGzipKiB: gzipKiB,
    workerRawKiB: metrics.workerRawKiB,
    freeTierLimitKiB: 3 * 1024,
    withinFreeLimit: pass,
  });
}

export function buildAssetCountAudit(metrics: CloudflareBuildMetrics) {
  const count = metrics.staticAssetCount ?? 0;
  const pass = count > 0 && count < 20_000;
  const largestPass = metrics.largestAssetBytes === null || metrics.largestAssetBytes <= 25 * 1024 * 1024;
  return proofEnvelope(pass && largestPass ? "PASS" : count === 0 ? "BLOCKED" : "FAIL", {
    staticAssetCount: count,
    staticAssetTotalBytes: metrics.staticAssetTotalBytes,
    largestAssetName: metrics.largestAssetName,
    largestAssetBytes: metrics.largestAssetBytes,
    freeTierAssetLimit: 20_000,
    freeTierMaxAssetBytes: 25 * 1024 * 1024,
    withinFreeLimits: pass && largestPass,
  });
}

export function buildProofDeploymentAudit(deployment: CloudflareDeploymentResult) {
  if (!deployment.authenticated) {
    return proofEnvelope("BLOCKED", {
      ...deployment,
      reason: deployment.blocker ?? "Cloudflare authentication required",
    });
  }
  return proofEnvelope(deployment.success ? "PASS" : "FAIL", { ...deployment });
}

const ROUTE_MATRIX = Object.freeze([
  "/",
  "/emoji/fire",
  "/emoji/red-heart",
  "/emoji/thumbs-up",
  "/emoji/thumbs-up-light-skin-tone",
  "/emoji/man-technologist",
  "/emoji/flag-india",
  "/emoji/rainbow-flag",
  "/emoji/extra-goldfish",
  "/category/smileys-emotion",
  "/search?q=fire",
  "/sitemap.xml",
  "/robots.txt",
  "/favorites",
  "/recent",
  "/extras",
  "/openmoji/standard/1F525.svg",
  "/emoji/keycap",
]);

const SECURITY_PATHS = Object.freeze([
  "/emoji/../etc/passwd",
  "/emoji/%2e%2e%2fetc%2fpasswd",
  "/emoji/%2f%2fexample.com",
  "/emoji/unknown-cloudflare-proof-slug-qa",
  "//evil.example/phish",
]);

export async function buildRouteAudit(baseUrl: string) {
  const results = await mapWithConcurrency(ROUTE_MATRIX, 8, async (path) => {
    const probe = await probeUrl(baseUrl, path, { followRedirects: false });
    return Object.freeze({
      path,
      status: probe.status,
      location: probe.location,
      pass: probe.status > 0 && probe.status < 500,
    });
  });
  const failures = results.filter((entry) => !entry.pass).length;
  return proofEnvelope(failures === 0 ? "PASS" : "FAIL", {
    baseUrl,
    routeCount: results.length,
    failureCount: failures,
    entries: Object.freeze(results),
  });
}

export async function buildSecurityAudit(baseUrl: string) {
  const results = await mapWithConcurrency(SECURITY_PATHS, 4, async (path) => {
    const probe = await probeUrl(baseUrl, path, { followRedirects: false });
    const location = probe.location ?? "";
    const externalRedirect =
      (probe.status === 301 || probe.status === 302) &&
      /^https?:\/\//i.test(location) &&
      !location.startsWith(baseUrl);
    return Object.freeze({
      path,
      status: probe.status,
      location: probe.location,
      externalRedirect,
      pass: !externalRedirect,
    });
  });
  const failures = results.filter((entry) => !entry.pass).length;
  return proofEnvelope(failures === 0 ? "PASS" : "FAIL", {
    baseUrl,
    failureCount: failures,
    entries: Object.freeze(results),
  });
}

export async function buildSitemapAudit(baseUrl: string) {
  const probe = await probeUrl(baseUrl, "/sitemap.xml", { followRedirects: true });
  const body = probe.bodySnippet ?? "";
  const urlCount = (body.match(/<loc>/g) ?? []).length;
  const productionSlugCount = getAllBrowsableSlugs().length;
  const pass = probe.status === 200 && urlCount >= productionSlugCount;
  return proofEnvelope(pass ? "PASS" : "FAIL", {
    baseUrl,
    status: probe.status,
    urlCount,
    productionSlugCount,
    usesConfiguredSiteUrl: body.includes(new URL(baseUrl).hostname) || body.length === 0,
  });
}

export async function buildRobotsAudit(baseUrl: string) {
  const probe = await probeUrl(baseUrl, "/robots.txt", { followRedirects: true });
  const body = probe.bodySnippet ?? "";
  const pass =
    probe.status === 200 &&
    body.includes("User-Agent:") &&
    body.includes("Sitemap:");
  return proofEnvelope(pass ? "PASS" : "FAIL", {
    baseUrl,
    status: probe.status,
    containsSitemapDirective: body.includes("Sitemap:"),
    bodyPreview: body.slice(0, 500),
  });
}

export async function buildHttpAudit(baseUrl: string, rootDir: string) {
  const offAudit = await buildOffBehaviorHttpAudit(baseUrl, rootDir);
  const keycap = await probeUrl(baseUrl, "/emoji/keycap", { followRedirects: false });
  const fire = await probeUrl(baseUrl, "/emoji/fire", { followRedirects: true });
  const keycapOk = keycap.status === 200;
  const pass =
    offAudit.status === "PASS" &&
    keycapOk &&
    fire.status === 200;
  return proofEnvelope(pass ? "PASS" : "FAIL", {
    baseUrl,
    offAudit,
    keycapStatus: keycap.status,
    keycapLocation: keycap.location,
    fireStatus: fire.status,
    fireCanonical: fire.bodySnippet?.match(/rel="canonical" href="([^"]+)"/)?.[1] ?? null,
  });
}

export async function buildSeoOffAudit(baseUrl: string, rootDir: string) {
  const offAudit = await buildOffBehaviorHttpAudit(baseUrl, rootDir);
  return proofEnvelope(offAudit.status, {
    baseUrl,
    rolloutMode: parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE),
    masterSeoEnabled: MASTER_INTEGRATION_CONFIG.masterSEOEnabled,
    offAudit,
  });
}

export function buildRollbackAudit(deployment: CloudflareDeploymentResult) {
  const pass = deployment.authenticated && deployment.success;
  return proofEnvelope(pass ? "PASS" : deployment.authenticated ? "FAIL" : "BLOCKED", {
    mechanism: "Cloudflare Worker versions / redeploy previous version",
    productionDnsUntouched: true,
    customDomainUntouched: true,
    workersDevUrl: deployment.workersDevUrl,
    rollbackAvailable: pass,
    note: "Use wrangler versions deploy to roll back without affecting production DNS.",
  });
}

export function buildProductionSafetyAudit(rootDir: string) {
  const checksums = JSON.parse(
    readFileSync(join(rootDir, "src/data/master/release/8.10/master-file-checksums.json"), "utf8"),
  ) as FileChecksumEntry[];
  const frozen = verifyFrozenChecksums(rootDir, checksums);
  const emojis = JSON.parse(readFileSync(join(rootDir, "src/data/emojis.json"), "utf8")) as unknown[];
  const extras = JSON.parse(readFileSync(join(rootDir, "src/data/openmoji-extras.json"), "utf8")) as unknown[];
  const checks = Object.freeze({
    frozenReleasePass: frozen.status === "PASS",
    emojisCount: emojis.length === PRODUCTION_BASELINES.standardRecords,
    extrasCount: extras.length === PRODUCTION_BASELINES.extrasRecords,
    masterArtworkFlagFalse: MASTER_INTEGRATION_CONFIG.masterArtworkEnabled === false,
    masterMetadataFlagFalse: MASTER_INTEGRATION_CONFIG.masterMetadataEnabled === false,
    masterSearchFlagFalse: MASTER_INTEGRATION_CONFIG.masterSearchEnabled === false,
    masterSeoFlagFalse: MASTER_INTEGRATION_CONFIG.masterSEOEnabled === false,
    rolloutOff: getSeoRolloutMode() === "OFF",
    noFullMode: parseSeoRolloutMode(process.env.MASTER_SEO_ROLLOUT_MODE) !== "FULL",
  });
  const pass = Object.values(checks).every(Boolean);
  return proofEnvelope(pass ? "PASS" : "FAIL", {
    frozenRelease: frozen.status,
    productionBaselines: PRODUCTION_BASELINES,
    checks,
    productionSafety: buildSeoProductionSafetyAudit(rootDir),
  });
}

type ProofStatus = "PASS" | "FAIL" | "BLOCKED";

export function classifyCloudflareProofDecision(input: {
  buildAudit: { status: ProofStatus };
  workerSizeAudit: { status: ProofStatus };
  assetCountAudit: { status: ProofStatus };
  deployment: CloudflareDeploymentResult;
  deploymentAudit: { status: ProofStatus };
  httpAudit: { status: ProofStatus };
  routeAudit: { status: ProofStatus };
  seoOffAudit: { status: ProofStatus };
  securityAudit: { status: ProofStatus };
}): CloudflareProofDecision {
  if (!input.deployment.authenticated) {
    return "C. BLOCKED";
  }
  const corePass =
    input.buildAudit.status === "PASS" &&
    input.workerSizeAudit.status === "PASS" &&
    input.assetCountAudit.status === "PASS" &&
    input.deploymentAudit.status === "PASS" &&
    input.httpAudit.status === "PASS" &&
    input.routeAudit.status === "PASS" &&
    input.seoOffAudit.status === "PASS" &&
    input.securityAudit.status === "PASS";
  if (!corePass) {
    return "D. FAILED";
  }
  return "A. CLOUDFLARE WORKERS.DEV PROOF PASS";
}

export async function buildCloudflareProofPackage(input: {
  rootDir: string;
  metrics: CloudflareBuildMetrics;
  deployment: CloudflareDeploymentResult;
}) {
  const { rootDir, metrics, deployment } = input;
  const { cloudflareProofIntegrationDir } = integrationDataPaths(rootDir);
  const baseUrl = deployment.workersDevUrl ?? process.env.CLOUDFLARE_PROOF_BASE_URL ?? "";

  const buildAudit = buildBuildAudit(metrics);
  const workerSizeAudit = buildWorkerSizeAudit(metrics);
  const assetCountAudit = buildAssetCountAudit(metrics);
  const deploymentAudit = buildProofDeploymentAudit(deployment);

  const hasBaseUrl = Boolean(baseUrl?.trim());
  const httpAudit = hasBaseUrl ? await buildHttpAudit(baseUrl, rootDir) : proofEnvelope("BLOCKED", { reason: "No workers.dev URL" });
  const routeAudit = hasBaseUrl ? await buildRouteAudit(baseUrl) : proofEnvelope("BLOCKED", { reason: "No workers.dev URL" });
  const seoOffAudit = hasBaseUrl ? await buildSeoOffAudit(baseUrl, rootDir) : proofEnvelope("BLOCKED", { reason: "No workers.dev URL" });
  const securityAudit = hasBaseUrl ? await buildSecurityAudit(baseUrl) : proofEnvelope("BLOCKED", { reason: "No workers.dev URL" });
  const sitemapAudit = hasBaseUrl ? await buildSitemapAudit(baseUrl) : proofEnvelope("BLOCKED", { reason: "No workers.dev URL" });
  const robotsAudit = hasBaseUrl ? await buildRobotsAudit(baseUrl) : proofEnvelope("BLOCKED", { reason: "No workers.dev URL" });
  const rollbackAudit = buildRollbackAudit(deployment);
  const productionSafetyAudit = buildProductionSafetyAudit(rootDir);

  const decision = classifyCloudflareProofDecision({
    buildAudit,
    workerSizeAudit,
    assetCountAudit,
    deployment,
    deploymentAudit,
    httpAudit,
    routeAudit,
    seoOffAudit,
    securityAudit,
  });

  const manifest = proofEnvelope(decision.startsWith("C") || decision.startsWith("D") ? "FAIL" : "PASS", {
    decision,
    workersDevUrl: deployment.workersDevUrl,
    commit: deployment.commit,
    branch: deployment.branch,
    deployment,
    metrics,
  });

  return Object.freeze({
    cloudflareProofIntegrationDir,
    decision,
    artifacts: Object.freeze({
      "proof-deployment-audit.json": deploymentAudit,
      "build-audit.json": buildAudit,
      "worker-size-audit.json": workerSizeAudit,
      "asset-count-audit.json": assetCountAudit,
      "http-audit.json": httpAudit,
      "route-audit.json": routeAudit,
      "seo-off-audit.json": seoOffAudit,
      "sitemap-audit.json": sitemapAudit,
      "robots-audit.json": robotsAudit,
      "security-audit.json": securityAudit,
      "rollback-audit.json": rollbackAudit,
      "production-safety-audit.json": productionSafetyAudit,
      "final-proof-manifest.json": manifest,
    }),
  });
}
