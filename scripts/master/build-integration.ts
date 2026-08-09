import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildIntegrationPackage } from "../../src/lib/master/integration/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const integrationDir = join(rootDir, "src", "data", "master", "integration");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const result = buildIntegrationPackage(rootDir);

writeJson(join(integrationDir, "production-to-master-map.json"), result.productionToMasterMap);
writeJson(join(integrationDir, "integration-audit-report.json"), result.integrationAuditReport);
writeJson(join(integrationDir, "integration-manifest.json"), result.integrationManifest);

console.log(`Phase 8.11A integration package built.`);
console.log(`Release: ${result.integrationManifest.releaseId}`);
console.log(`Production mappings: ${result.productionToMasterMap.totalMapped}/${result.productionToMasterMap.totalExpected}`);
console.log(`Audit status: ${result.integrationAuditReport.status}`);

if (result.integrationAuditReport.status !== "PASS") {
  process.exitCode = 1;
}
