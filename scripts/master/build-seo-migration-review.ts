import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeoMigrationReviewPackage } from "../../src/lib/master/integration/seo-migration-review/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const reviewDir = join(rootDir, "src", "data", "master", "integration", "seo-migration-review");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const reviewPackage = buildSeoMigrationReviewPackage(rootDir);

writeJson(join(reviewDir, "manual-review-decisions.json"), reviewPackage.manualReviewDecisions);
writeJson(join(reviewDir, "extras-migration-decisions.json"), reviewPackage.extrasMigrationDecisions);
writeJson(join(reviewDir, "source-specific-decisions.json"), reviewPackage.sourceSpecificDecisions);
writeJson(join(reviewDir, "final-migration-matrix.json"), reviewPackage.finalMigrationMatrix);
writeJson(join(reviewDir, "redirect-approval-candidates.json"), reviewPackage.redirectApprovalCandidates);
writeJson(join(reviewDir, "redirect-exclusions.json"), reviewPackage.redirectExclusions);
writeJson(join(reviewDir, "canonical-policy.json"), reviewPackage.canonicalPolicy);
writeJson(join(reviewDir, "seo-review-audit.json"), reviewPackage.seoReviewAudit);
writeJson(join(reviewDir, "seo-review-recommendation.json"), reviewPackage.seoReviewRecommendation);
writeJson(join(reviewDir, "seo-review-manifest.json"), reviewPackage.seoReviewManifest);

console.log("Phase 8.12B SEO migration review package built.");
console.log(`SEO review recommendation: ${reviewPackage.seoReviewRecommendation.conclusion}`);

if (reviewPackage.seoReviewAudit.status !== "PASS") {
  process.exitCode = 1;
}
