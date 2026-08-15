import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildStagingBlockedPackage,
  buildStagingCanaryPackage,
  validateStagingEnvironment,
} from "../../src/lib/master/integration/seo-canary-staging/build";
import {
  buildCanaryHttpAuditPackage,
  buildOffBehaviorHttpAudit,
  buildRollbackHttpAudit,
} from "../../src/lib/master/integration/seo-canary/validation-build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const stagingDir = join(rootDir, "src", "data", "master", "integration", "seo-canary-staging");
const BASE_URL = process.env.SEO_QA_BASE_URL?.trim();
const OFF_BASE_URL = process.env.SEO_QA_OFF_BASE_URL?.trim();
const ROLLBACK_BASE_URL = process.env.SEO_QA_ROLLBACK_BASE_URL?.trim();
const CANARY_ENVIRONMENT = process.env.SEO_CANARY_ENVIRONMENT?.trim();

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeStagingPackage(pkg: ReturnType<typeof buildStagingBlockedPackage> | Awaited<ReturnType<typeof buildStagingCanaryPackage>>): void {
  writeJson(join(stagingDir, "staging-deployment-audit.json"), pkg.deploymentAudit);
  writeJson(join(stagingDir, "http-redirect-audit.json"), pkg.httpRedirectAudit);
  writeJson(join(stagingDir, "preserved-url-audit.json"), pkg.preservedUrlAudit);
  writeJson(join(stagingDir, "excluded-url-audit.json"), pkg.excludedUrlAudit);
  writeJson(join(stagingDir, "canonical-audit.json"), pkg.canonicalAudit);
  writeJson(join(stagingDir, "sitemap-audit.json"), pkg.sitemapAudit);
  writeJson(join(stagingDir, "emoji-matrix-audit.json"), pkg.emojiMatrixAudit);
  writeJson(join(stagingDir, "security-audit.json"), pkg.securityAudit);
  writeJson(join(stagingDir, "performance-audit.json"), pkg.performanceAudit);
  writeJson(join(stagingDir, "rollback-audit.json"), pkg.rollbackAudit);
  writeJson(join(stagingDir, "production-safety-audit.json"), pkg.productionSafetyAudit);
  writeJson(join(stagingDir, "staging-manifest.json"), pkg.stagingManifest);
}

async function main(): Promise<void> {
  const preflight = validateStagingEnvironment(BASE_URL, CANARY_ENVIRONMENT, OFF_BASE_URL, ROLLBACK_BASE_URL);
  if (!preflight.valid) {
    const blocked = buildStagingBlockedPackage(
      rootDir,
      preflight.errors.join("; "),
      BASE_URL,
      CANARY_ENVIRONMENT,
    );
    writeStagingPackage(blocked);
    console.error("Phase 8.12G staging validation blocked:");
    for (const error of preflight.errors) {
      console.error(`- ${error}`);
    }
    console.error(`Decision: ${blocked.decision}`);
    process.exitCode = 1;
    return;
  }

  const baseUrl = BASE_URL!;
  const offBaseUrl = OFF_BASE_URL!;
  const rollbackBaseUrl = ROLLBACK_BASE_URL!;
  console.log(`Phase 8.12G — staging HTTP validation`);
  console.log(`  CANARY base: ${baseUrl}`);
  console.log(`  OFF base: ${offBaseUrl}`);
  console.log(`  Rollback base: ${rollbackBaseUrl}`);

  const offAudit = await buildOffBehaviorHttpAudit(offBaseUrl, rootDir);
  console.log(`OFF baseline audit: ${offAudit.status}`);

  const canaryHttp = await buildCanaryHttpAuditPackage(baseUrl, rootDir);
  console.log(`CANARY HTTP audit: ${canaryHttp.status}`);

  const rollbackAudit = await buildRollbackHttpAudit(rollbackBaseUrl);
  console.log(`Rollback audit: ${rollbackAudit.status}`);

  const defaultOffAudit = await buildOffBehaviorHttpAudit(rollbackBaseUrl, rootDir);
  console.log(`Default OFF audit: ${defaultOffAudit.status}`);

  const stagingPackage = await buildStagingCanaryPackage({
    baseUrl,
    offBaseUrl,
    rollbackBaseUrl,
    rootDir,
    environment: CANARY_ENVIRONMENT!,
    offAudit,
    defaultOffAudit,
    canaryHttp,
    rollbackAudit,
  });

  writeStagingPackage(stagingPackage);
  console.log(`Decision: ${stagingPackage.decision}`);
  if (stagingPackage.decision.startsWith("C")) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
