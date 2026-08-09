import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSeoIntegrationPackage } from "../../src/lib/master/integration/seo/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const seoDir = join(rootDir, "src", "data", "master", "integration", "seo");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const seo = buildSeoIntegrationPackage(rootDir);

writeJson(join(seoDir, "production-seo-coverage.json"), seo.productionSeoCoverage);
writeJson(join(seoDir, "seo-canonical-audit.json"), seo.seoCanonicalAudit);
writeJson(join(seoDir, "seo-slug-audit.json"), seo.seoSlugAudit);
writeJson(join(seoDir, "seo-indexability-audit.json"), seo.seoIndexabilityAudit);
writeJson(join(seoDir, "seo-sitemap-eligibility.json"), seo.seoSitemapEligibility);
writeJson(join(seoDir, "seo-content-quality-audit.json"), seo.seoContentQualityAudit);
writeJson(join(seoDir, "seo-integration-audit.json"), seo.seoIntegrationAudit);
writeJson(join(seoDir, "seo-integration-manifest.json"), seo.seoIntegrationManifest);

console.log("Phase 8.11D SEO integration package built.");
console.log(`SEO audit: ${seo.seoIntegrationAudit.status}`);
console.log(`Indexable: ${seo.seoIndexabilityAudit.indexable}`);
console.log(`Not indexable: ${seo.seoIndexabilityAudit.notIndexable}`);
console.log(`Slug mismatches (reported): ${seo.productionSeoCoverage.slugMismatches}`);

if (seo.seoIntegrationAudit.status !== "PASS") {
  process.exitCode = 1;
}
