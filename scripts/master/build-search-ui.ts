import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSearchUiPackage } from "../../src/lib/master/integration/search-ui/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const searchUiDir = join(rootDir, "src", "data", "master", "integration", "search-ui");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const uiPackage = buildSearchUiPackage(rootDir);

writeJson(join(searchUiDir, "search-ui-audit.json"), uiPackage.searchUiAudit);
writeJson(join(searchUiDir, "search-input-audit.json"), uiPackage.searchInputAudit);
writeJson(join(searchUiDir, "search-ranking-ui-audit.json"), uiPackage.searchRankingUiAudit);
writeJson(join(searchUiDir, "search-accessibility-audit.json"), uiPackage.searchAccessibilityAudit);
writeJson(join(searchUiDir, "search-mobile-audit.json"), uiPackage.searchMobileAudit);
writeJson(join(searchUiDir, "search-desktop-audit.json"), uiPackage.searchDesktopAudit);
writeJson(join(searchUiDir, "search-theme-audit.json"), uiPackage.searchThemeAudit);
writeJson(join(searchUiDir, "search-performance-audit.json"), uiPackage.searchPerformanceAudit);
writeJson(join(searchUiDir, "search-bundle-audit.json"), uiPackage.searchBundleAudit);
writeJson(join(searchUiDir, "search-network-audit.json"), uiPackage.searchNetworkAudit);
writeJson(join(searchUiDir, "search-error-handling-audit.json"), uiPackage.searchErrorHandlingAudit);
writeJson(join(searchUiDir, "search-fallback-audit.json"), uiPackage.searchFallbackAudit);
writeJson(join(searchUiDir, "search-flag-isolation-audit.json"), uiPackage.searchFlagIsolationAudit);
writeJson(join(searchUiDir, "search-production-compatibility.json"), uiPackage.searchProductionCompatibility);
writeJson(join(searchUiDir, "search-release-integrity.json"), uiPackage.searchReleaseIntegrity);
writeJson(join(searchUiDir, "search-ui-manifest.json"), uiPackage.searchUiManifest);

console.log("Phase 8.11H search UI package built.");
console.log(`Search UI audit: ${uiPackage.searchUiAudit.status}`);

if (uiPackage.searchUiAudit.status !== "PASS") {
  process.exitCode = 1;
}
