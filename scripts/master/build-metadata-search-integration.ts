import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMetadataIntegrationPackage } from "../../src/lib/master/integration/metadata/build";
import { buildSearchIntegrationPackage } from "../../src/lib/master/integration/search/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const metadataDir = join(rootDir, "src", "data", "master", "integration", "metadata");
const searchDir = join(rootDir, "src", "data", "master", "integration", "search");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const metadata = buildMetadataIntegrationPackage(rootDir);
const search = buildSearchIntegrationPackage(rootDir);

writeJson(join(metadataDir, "metadata-production-coverage.json"), metadata.metadataProductionCoverage);
writeJson(join(metadataDir, "metadata-provider-coverage.json"), metadata.metadataProviderCoverage);
writeJson(join(metadataDir, "metadata-integration-audit.json"), metadata.metadataIntegrationAudit);
writeJson(join(metadataDir, "metadata-integration-manifest.json"), metadata.metadataIntegrationManifest);

writeJson(join(searchDir, "search-production-coverage.json"), search.searchProductionCoverage);
writeJson(join(searchDir, "search-ranking-audit.json"), search.searchRankingAudit);
writeJson(join(searchDir, "search-integration-audit.json"), search.searchIntegrationAudit);
writeJson(join(searchDir, "search-integration-manifest.json"), search.searchIntegrationManifest);

console.log("Phase 8.11C metadata/search integration package built.");
console.log(`Metadata audit: ${metadata.metadataIntegrationAudit.status}`);
console.log(`Search audit: ${search.searchIntegrationAudit.status}`);

if (metadata.metadataIntegrationAudit.status !== "PASS" || search.searchIntegrationAudit.status !== "PASS") {
  process.exitCode = 1;
}
