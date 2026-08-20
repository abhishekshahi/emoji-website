import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLimitedProductionBlockedPackage,
  type LimitedProductionInfrastructureAudit,
} from "../../src/lib/master/integration/seo-canary-limited-production/build";
import { PRODUCTION_SITE_URL } from "../../src/lib/site/config";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const outputDir = join(rootDir, "src", "data", "master", "integration", "seo-canary-limited-production");

const STABLE_PRODUCTION_URL =
  process.env.SEO_QA_STABLE_PRODUCTION_URL?.trim() ?? PRODUCTION_SITE_URL;
const REQUESTED_TRAFFIC_PERCENTAGE = Number(process.env.SEO_CANARY_TRAFFIC_PERCENTAGE ?? "1");
const LIMITED_PRODUCTION_BLOCKER =
  "LIMITED-PRODUCTION CANARY BLOCKED - TRAFFIC SPLITTING NOT AVAILABLE: Cloudflare Workers does not expose automated 1% production traffic routing in this repo. Configure canary routing manually via wrangler versions or Cloudflare dashboard.";

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveCommitSha(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: rootDir, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function main(): void {
  const commitSha = resolveCommitSha();
  const infrastructure: LimitedProductionInfrastructureAudit = Object.freeze({
    hostingProvider: "cloudflare",
    projectId: process.env.CLOUDFLARE_ACCOUNT_ID?.trim() ?? null,
    projectName: process.env.CLOUDFLARE_WORKER_NAME?.trim() ?? "emoji-website",
    planSupportsRollingReleases: false,
    rollingReleaseConfigured: false,
    customProductionDomain: PRODUCTION_SITE_URL,
    stableProductionUrl: STABLE_PRODUCTION_URL,
    canaryDeploymentCreated: false,
    requestedTrafficPercentage: REQUESTED_TRAFFIC_PERCENTAGE,
    trafficSplitEnforced: false,
    blocker: LIMITED_PRODUCTION_BLOCKER,
  });

  console.log("Phase 8.12H - limited-production SEO canary preflight");
  console.log(`  Commit: ${commitSha}`);
  console.log(`  Stable production: ${STABLE_PRODUCTION_URL}`);
  console.log(`  Requested traffic: ${REQUESTED_TRAFFIC_PERCENTAGE}%`);
  console.log(`  Hosting provider: cloudflare`);

  const blocked = buildLimitedProductionBlockedPackage(rootDir, infrastructure, {
    commitSha,
    stableProductionUrl: STABLE_PRODUCTION_URL,
  });
  writeJson(join(outputDir, "deployment-audit.json"), blocked.deploymentAudit);
  writeJson(join(outputDir, "traffic-split-audit.json"), blocked.trafficSplitAudit);
  writeJson(join(outputDir, "http-redirect-audit.json"), blocked.httpRedirectAudit);
  writeJson(join(outputDir, "preserved-url-audit.json"), blocked.preservedUrlAudit);
  writeJson(join(outputDir, "excluded-url-audit.json"), blocked.excludedUrlAudit);
  writeJson(join(outputDir, "canonical-audit.json"), blocked.canonicalAudit);
  writeJson(join(outputDir, "sitemap-audit.json"), blocked.sitemapAudit);
  writeJson(join(outputDir, "emoji-matrix-audit.json"), blocked.emojiMatrixAudit);
  writeJson(join(outputDir, "security-audit.json"), blocked.securityAudit);
  writeJson(join(outputDir, "performance-audit.json"), blocked.performanceAudit);
  writeJson(join(outputDir, "production-safety-audit.json"), blocked.productionSafetyAudit);
  writeJson(join(outputDir, "rollback-audit.json"), blocked.rollbackAudit);
  writeJson(join(outputDir, "monitoring-comparison.json"), blocked.monitoringComparison);
  writeJson(join(outputDir, "final-canary-manifest.json"), blocked.finalCanaryManifest);
  console.error(infrastructure.blocker);
  console.error(`Decision: ${blocked.decision}`);
  process.exitCode = 1;
}

main();
