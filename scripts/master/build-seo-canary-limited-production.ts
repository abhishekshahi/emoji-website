import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildLimitedProductionBlockedPackage,
  type LimitedProductionInfrastructureAudit,
} from "../../src/lib/master/integration/seo-canary-limited-production/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const outputDir = join(rootDir, "src", "data", "master", "integration", "seo-canary-limited-production");

const STABLE_PRODUCTION_URL =
  process.env.SEO_QA_STABLE_PRODUCTION_URL?.trim() ??
  "https://emoji-website-iiw154g0g-abhishekshahi4598-6592s-projects.vercel.app";
const PROJECT_ID = process.env.VERCEL_PROJECT_ID?.trim() ?? "prj_Vp1SazV5jNIIDVqFsCnuTpb5zT47";
const PROJECT_NAME = process.env.VERCEL_PROJECT_NAME?.trim() ?? "emoji-website";
const REQUESTED_TRAFFIC_PERCENTAGE = Number(process.env.SEO_CANARY_TRAFFIC_PERCENTAGE ?? "1");

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

function probeRollingReleaseSupport(): { supported: boolean; blocker: string } {
  try {
    execSync(
      "npx vercel rolling-release configure --enable --advancement-type=manual-approval --stage=1 --project=emoji-website",
      { cwd: rootDir, encoding: "utf8", stdio: "pipe" },
    );
    return { supported: true, blocker: "" };
  } catch (error) {
    const stderr =
      typeof error === "object" && error !== null && "stderr" in error
        ? String((error as { stderr?: string }).stderr ?? "")
        : "";
    const message = `${error instanceof Error ? error.message : String(error)} ${stderr}`;
    if (message.includes("does not support rolling releases")) {
      return {
        supported: false,
        blocker:
          "LIMITED-PRODUCTION CANARY BLOCKED - TRAFFIC SPLITTING NOT AVAILABLE: Vercel Hobby plan does not support Rolling Releases (403). Cannot guarantee 1% production traffic routing.",
      };
    }
    return {
      supported: false,
      blocker: `LIMITED-PRODUCTION CANARY BLOCKED - TRAFFIC SPLITTING NOT AVAILABLE: ${message.trim()}`,
    };
  }
}

function main(): void {
  const commitSha = resolveCommitSha();
  const rollingRelease = probeRollingReleaseSupport();
  const infrastructure: LimitedProductionInfrastructureAudit = Object.freeze({
    hostingProvider: "vercel",
    projectId: PROJECT_ID,
    projectName: PROJECT_NAME,
    planSupportsRollingReleases: rollingRelease.supported,
    rollingReleaseConfigured: false,
    customProductionDomain: null,
    stableProductionUrl: STABLE_PRODUCTION_URL,
    canaryDeploymentCreated: false,
    requestedTrafficPercentage: REQUESTED_TRAFFIC_PERCENTAGE,
    trafficSplitEnforced: rollingRelease.supported,
    blocker: rollingRelease.blocker,
  });

  console.log("Phase 8.12H - limited-production SEO canary preflight");
  console.log(`  Commit: ${commitSha}`);
  console.log(`  Stable production: ${STABLE_PRODUCTION_URL}`);
  console.log(`  Requested traffic: ${REQUESTED_TRAFFIC_PERCENTAGE}%`);
  console.log(`  Rolling releases supported: ${rollingRelease.supported}`);

  if (!rollingRelease.supported) {
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
    return;
  }

  console.error("Rolling release support detected but automated limited-production flow is not implemented.");
  process.exitCode = 1;
}

main();