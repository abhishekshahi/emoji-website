import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSearchActivationPackage } from "../../src/lib/master/integration/search-activation/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const searchActivationDir = join(rootDir, "src", "data", "master", "integration", "search-activation");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const activation = buildSearchActivationPackage(rootDir);

writeJson(join(searchActivationDir, "search-activation-audit.json"), activation.searchActivationAudit);
writeJson(join(searchActivationDir, "search-ranking-audit.json"), activation.searchRankingAudit);
writeJson(join(searchActivationDir, "search-safety-audit.json"), activation.searchSafetyAudit);
writeJson(join(searchActivationDir, "search-ambiguity-audit.json"), activation.searchAmbiguityAudit);
writeJson(join(searchActivationDir, "search-provenance-audit.json"), activation.searchProvenanceAudit);
writeJson(join(searchActivationDir, "search-performance-audit.json"), activation.searchPerformanceAudit);
writeJson(join(searchActivationDir, "search-fallback-audit.json"), activation.searchFallbackAudit);
writeJson(join(searchActivationDir, "search-production-compatibility.json"), activation.searchProductionCompatibility);
writeJson(join(searchActivationDir, "search-feature-flag-audit.json"), activation.searchFeatureFlagAudit);
writeJson(join(searchActivationDir, "search-activation-manifest.json"), activation.searchActivationManifest);

console.log("Phase 8.11G search activation package built.");
console.log(`Search activation audit: ${activation.searchActivationAudit.status}`);

if (activation.searchActivationAudit.status !== "PASS") {
  process.exitCode = 1;
}
