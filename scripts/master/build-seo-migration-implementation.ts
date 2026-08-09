import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildMigrationImplementationPackage } from "../../src/lib/master/integration/seo-migration-implementation/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const reviewDir = join(rootDir, "src", "data", "master", "integration", "seo-migration-review");
const implementationDir = join(rootDir, "src", "data", "master", "integration", "seo-migration-implementation");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const implementationPackage = buildMigrationImplementationPackage(rootDir);

writeJson(join(reviewDir, "approved-redirects.json"), implementationPackage.approvedRedirects);
writeJson(join(implementationDir, "approved-redirects.json"), implementationPackage.approvedRedirects);
writeJson(
  join(implementationDir, "redirect-resolution-audit.json"),
  implementationPackage.redirectResolutionAudit,
);
writeJson(join(implementationDir, "redirect-loop-audit.json"), implementationPackage.redirectLoopAudit);
writeJson(join(implementationDir, "redirect-chain-audit.json"), implementationPackage.redirectChainAudit);
writeJson(join(implementationDir, "preserved-url-audit.json"), implementationPackage.preservedUrlAudit);
writeJson(join(implementationDir, "canonical-audit.json"), implementationPackage.canonicalAudit);
writeJson(join(implementationDir, "sitemap-audit.json"), implementationPackage.sitemapAudit);
writeJson(join(implementationDir, "seo-safety-audit.json"), implementationPackage.seoSafetyAudit);
writeJson(
  join(implementationDir, "migration-implementation-audit.json"),
  implementationPackage.migrationImplementationAudit,
);
writeJson(
  join(implementationDir, "migration-implementation-manifest.json"),
  implementationPackage.migrationImplementationManifest,
);

console.log("Phase 8.12C SEO migration implementation package built.");
console.log(`Approved redirects: ${implementationPackage.approvedRedirects.count}`);
console.log(`Implementation audit: ${implementationPackage.migrationImplementationAudit.status}`);

if (implementationPackage.migrationImplementationAudit.status !== "PASS") {
  process.exitCode = 1;
}
