import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeoMigrationPackage } from "../../src/lib/master/integration/seo-migration/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const migrationDir = join(rootDir, "src", "data", "master", "integration", "seo-migration");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const migrationPackage = buildSeoMigrationPackage(rootDir);

writeJson(join(migrationDir, "redirect-inventory.json"), migrationPackage.redirectInventory);
writeJson(join(migrationDir, "safe-redirects.json"), migrationPackage.safeRedirects);
writeJson(join(migrationDir, "manual-review.json"), migrationPackage.manualReview);
writeJson(join(migrationDir, "extras-compatibility.json"), migrationPackage.extrasCompatibility);
writeJson(join(migrationDir, "source-specific-review.json"), migrationPackage.sourceSpecificReview);
writeJson(join(migrationDir, "redirect-safety-audit.json"), migrationPackage.redirectSafetyAudit);
writeJson(join(migrationDir, "redirect-target-audit.json"), migrationPackage.redirectTargetAudit);
writeJson(join(migrationDir, "canonical-preservation-audit.json"), migrationPackage.canonicalPreservationAudit);
writeJson(join(migrationDir, "backward-compatibility-audit.json"), migrationPackage.backwardCompatibilityAudit);
writeJson(join(migrationDir, "seo-migration-recommendation.json"), migrationPackage.seoMigrationRecommendation);
writeJson(join(migrationDir, "seo-migration-manifest.json"), migrationPackage.seoMigrationManifest);

console.log("Phase 8.12A SEO migration package built.");
console.log(`SEO migration recommendation: ${migrationPackage.seoMigrationRecommendation.conclusion}`);

if (migrationPackage.seoMigrationRecommendation.conclusion === "UNSAFE") {
  process.exitCode = 1;
}
