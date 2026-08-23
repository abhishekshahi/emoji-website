import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase21Pipeline } from "@/lib/kaomoji/processing/phase21/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  const remote = process.argv.includes("--remote");
  console.log("Phase 21 - production QA + launch readiness");
  const { manifest } = runPhase21Pipeline(rootDir, { remote, typecheckPassed: true, buildPassed: true });
  console.log("Routes:", manifest.routes_audited.join(", "));
  console.log("Locales:", manifest.locales.length);
  console.log("Gates:", manifest.gates);
  if (manifest.errors.length) {
    console.error("Errors:", manifest.errors);
    process.exitCode = 1;
  }
}

main();
