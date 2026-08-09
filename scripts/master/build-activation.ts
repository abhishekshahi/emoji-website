import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildActivationPackage } from "../../src/lib/master/integration/activation/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const activationDir = join(rootDir, "src", "data", "master", "integration", "activation");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

const activation = buildActivationPackage(rootDir);

writeJson(join(activationDir, "activation-audit.json"), activation.activationAudit);
writeJson(join(activationDir, "artwork-activation-audit.json"), activation.artworkActivationAudit);
writeJson(join(activationDir, "metadata-activation-audit.json"), activation.metadataActivationAudit);
writeJson(join(activationDir, "provider-qa-report.json"), activation.providerQaReport);
writeJson(join(activationDir, "responsive-qa-report.json"), activation.responsiveQaReport);
writeJson(join(activationDir, "accessibility-qa-report.json"), activation.accessibilityQaReport);
writeJson(join(activationDir, "feature-flag-audit.json"), activation.featureFlagAudit);
writeJson(join(activationDir, "activation-manifest.json"), activation.activationManifest);

console.log("Phase 8.11F activation package built.");
console.log(`Activation audit: ${activation.activationAudit.status}`);

if (activation.activationAudit.status !== "PASS") {
  process.exitCode = 1;
}
