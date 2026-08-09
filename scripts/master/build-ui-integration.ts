import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildUiIntegrationPackage } from "../../src/lib/master/integration/ui/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const uiDir = join(rootDir, "src", "data", "master", "integration", "ui");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const ui = buildUiIntegrationPackage(rootDir);

writeJson(join(uiDir, "ui-integration-audit.json"), ui.uiIntegrationAudit);
writeJson(join(uiDir, "ui-artwork-coverage.json"), ui.uiArtworkCoverage);
writeJson(join(uiDir, "ui-metadata-coverage.json"), ui.uiMetadataCoverage);
writeJson(join(uiDir, "ui-provider-coverage.json"), ui.uiProviderCoverage);
writeJson(join(uiDir, "ui-license-coverage.json"), ui.uiLicenseCoverage);
writeJson(join(uiDir, "ui-production-safety.json"), ui.uiProductionSafety);
writeJson(join(uiDir, "ui-integration-manifest.json"), ui.uiIntegrationManifest);

console.log("Phase 8.11E UI integration package built.");
console.log(`UI audit: ${ui.uiIntegrationAudit.status}`);

if (ui.uiIntegrationAudit.status !== "PASS") {
  process.exitCode = 1;
}
