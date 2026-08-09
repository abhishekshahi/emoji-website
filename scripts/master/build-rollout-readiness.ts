import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRolloutReadinessPackage } from "../../src/lib/master/integration/rollout-readiness/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const rolloutDir = join(rootDir, "src", "data", "master", "integration", "rollout-readiness");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const rolloutPackage = buildRolloutReadinessPackage(rootDir);

writeJson(join(rolloutDir, "rollout-readiness-audit.json"), rolloutPackage.rolloutReadinessAudit);
writeJson(join(rolloutDir, "production-mapping-audit.json"), rolloutPackage.productionMappingAudit);
writeJson(join(rolloutDir, "artwork-rollout-audit.json"), rolloutPackage.artworkRolloutAudit);
writeJson(join(rolloutDir, "metadata-rollout-audit.json"), rolloutPackage.metadataRolloutAudit);
writeJson(join(rolloutDir, "search-rollout-audit.json"), rolloutPackage.searchRolloutAudit);
writeJson(join(rolloutDir, "seo-migration-audit.json"), rolloutPackage.seoMigrationAudit);
writeJson(join(rolloutDir, "sitemap-audit.json"), rolloutPackage.sitemapAudit);
writeJson(join(rolloutDir, "indexation-safety-audit.json"), rolloutPackage.indexationSafetyAudit);
writeJson(join(rolloutDir, "performance-rollout-audit.json"), rolloutPackage.performanceRolloutAudit);
writeJson(join(rolloutDir, "rollback-audit.json"), rolloutPackage.rollbackAudit);
writeJson(join(rolloutDir, "risk-register.json"), rolloutPackage.riskRegister);
writeJson(join(rolloutDir, "slug-mismatch-classification.json"), rolloutPackage.slugMismatchClassification);
writeJson(join(rolloutDir, "rollout-recommendation.json"), rolloutPackage.rolloutRecommendation);
writeJson(join(rolloutDir, "rollout-manifest.json"), rolloutPackage.rolloutManifest);

console.log("Phase 8.12 rollout readiness package built.");
console.log(`Rollout readiness audit: ${rolloutPackage.rolloutReadinessAudit.status}`);
console.log(`Recommendation: ${rolloutPackage.rolloutRecommendation.conclusion}`);

if (rolloutPackage.rolloutReadinessAudit.status !== "PASS") {
  process.exitCode = 1;
}
