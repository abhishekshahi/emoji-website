import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtworkIntegrationPackage } from "../../src/lib/master/integration/artwork/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const artworkDir = join(rootDir, "src", "data", "master", "integration", "artwork");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const result = buildArtworkIntegrationPackage(rootDir);

writeJson(join(artworkDir, "artwork-production-coverage.json"), result.artworkProductionCoverage);
writeJson(join(artworkDir, "artwork-provider-coverage.json"), result.artworkProviderCoverage);
writeJson(join(artworkDir, "artwork-integration-audit.json"), result.artworkIntegrationAudit);
writeJson(join(artworkDir, "artwork-integration-manifest.json"), result.artworkIntegrationManifest);

console.log("Phase 8.11B artwork integration package built.");
console.log(`Release: ${result.artworkIntegrationManifest.releaseId}`);
console.log(
  `Production coverage: ${result.artworkProductionCoverage.mappedRecords}/${result.artworkProductionCoverage.totalProductionRecords}`,
);
console.log(`Provider coverage: ${result.artworkProviderCoverage.status}`);
console.log(`Audit status: ${result.artworkIntegrationAudit.status}`);

if (result.artworkIntegrationAudit.status !== "PASS") {
  process.exitCode = 1;
}
