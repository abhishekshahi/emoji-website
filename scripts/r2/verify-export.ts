import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { R2_EXPORT_DIR } from "../../src/lib/master/r2/config";
import { verifyR2Export } from "../../src/lib/master/r2/export/verify";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportRootDir = join(rootDir, R2_EXPORT_DIR, "emojiquick");

function main(): void {
  const result = verifyR2Export(exportRootDir);

  console.log(`R2 verify: ${result.status}`);
  if (result.manifest) {
    console.log(`  Dataset: ${result.manifest.datasetVersion}`);
    console.log(`  Objects measured: ${result.measured.objectCount}`);
    console.log(`  Bytes measured: ${result.measured.totalBytes.toLocaleString()}`);
    console.log(
      `  R2 utilization: ${((result.manifest.totals.bytes / 1e10) * 100).toFixed(2)}% of 10 GB`,
    );
  }

  if (result.errors.length > 0) {
    console.error("Errors:");
    for (const error of result.errors.slice(0, 20)) {
      console.error(`  - ${error}`);
    }
    if (result.errors.length > 20) {
      console.error(`  ... and ${result.errors.length - 20} more`);
    }
    process.exitCode = 1;
  }
}

main();
