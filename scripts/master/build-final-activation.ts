import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFinalActivationPackage } from "../../src/lib/master/integration/final-activation/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const finalDir = join(rootDir, "src", "data", "master", "integration", "final-activation");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const finalPackage = buildFinalActivationPackage(rootDir);

writeJson(join(finalDir, "final-activation-audit.json"), finalPackage.finalActivationAudit);
writeJson(join(finalDir, "combined-activation-audit.json"), finalPackage.combinedActivationAudit);
writeJson(join(finalDir, "production-safety-audit.json"), finalPackage.productionSafetyAudit);
writeJson(join(finalDir, "regression-audit.json"), finalPackage.regressionAudit);
writeJson(join(finalDir, "artwork-final-audit.json"), finalPackage.artworkFinalAudit);
writeJson(join(finalDir, "metadata-final-audit.json"), finalPackage.metadataFinalAudit);
writeJson(join(finalDir, "search-final-audit.json"), finalPackage.searchFinalAudit);
writeJson(join(finalDir, "semantic-final-audit.json"), finalPackage.semanticFinalAudit);
writeJson(join(finalDir, "seo-final-audit.json"), finalPackage.seoFinalAudit);
writeJson(join(finalDir, "ui-final-audit.json"), finalPackage.uiFinalAudit);
writeJson(join(finalDir, "performance-final-audit.json"), finalPackage.performanceFinalAudit);
writeJson(join(finalDir, "failure-safety-audit.json"), finalPackage.failureSafetyAudit);
writeJson(join(finalDir, "flag-rollback-audit.json"), finalPackage.flagRollbackAudit);
writeJson(join(finalDir, "final-activation-manifest.json"), finalPackage.finalActivationManifest);

console.log("Phase 8.11I final activation package built.");
console.log(`Final activation audit: ${finalPackage.finalActivationAudit.status}`);

if (finalPackage.finalActivationAudit.status !== "PASS") {
  process.exitCode = 1;
}
