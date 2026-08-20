import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ArtworkMasterRecord } from "@/lib/master/artwork/types";
import { buildLicenseCoverageAudit } from "@/lib/master/public/license-coverage";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const indexPath = join(rootDir, "src/data/master/artwork/artwork-master-index.json");
const outPath = join(rootDir, "reports/license-coverage-audit.json");

const records = JSON.parse(readFileSync(indexPath, "utf8")) as ArtworkMasterRecord[];
const report = buildLicenseCoverageAudit(records);

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`License coverage audit written: ${outPath}`);
for (const p of report.providers) {
  console.log(
    `${p.provider}: total=${p.totalAssets} verified=${p.verifiedAssets} public=${p.publicAssets} pending=${p.pendingAssets} coverage=${p.coveragePercentage}%`,
  );
}
if (report.providers.some((p) => p.unverifiedPaths.length > 0)) {
  console.log("Non-public paths:");
  for (const p of report.providers) {
    for (const path of p.unverifiedPaths) {
      console.log(`  [${p.provider}] ${path}`);
    }
  }
}
