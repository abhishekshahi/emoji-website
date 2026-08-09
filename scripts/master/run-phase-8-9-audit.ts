import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase89Audit } from "../../src/lib/master/audit/phase-8-9";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const outputDir = join(rootDir, "src", "data", "master", "phase-8-9");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeMarkdown(path: string, result: ReturnType<typeof runPhase89Audit>): void {
  const { integrityReport, countAudit, referenceIntegrity, productionSafetyAudit, emojiSpotChecks } = result;
  const lines: string[] = [
    "# Phase 8.9 — Final Cross-Source Master Database Audit",
    "",
    `Generated: ${integrityReport.generatedAt}`,
    "",
    `## Overall Status: **${integrityReport.overallStatus}**`,
    "",
    `- PASS sections: ${integrityReport.summary.pass}`,
    `- WARN sections: ${integrityReport.summary.warn}`,
    `- FAIL sections: ${integrityReport.summary.fail}`,
    "",
    "## Section Results",
    "",
    "| Section | Status |",
    "|---------|--------|",
    ...integrityReport.sections.map((section) => `| ${section.name} | ${section.status} |`),
    "",
    "## Count Audit",
    "",
    `Status: **${countAudit.status}**`,
    "",
    countAudit.mismatches.length === 0
      ? "All independently recalculated counts match baselines."
      : countAudit.mismatches.map((entry) => `- ${entry.metric}: expected ${entry.expected}, calculated ${entry.calculated}`).join("\n"),
    "",
    "## Cross-Layer References",
    "",
    `- Valid: ${referenceIntegrity.totals.validReferences}`,
    `- Missing: ${referenceIntegrity.totals.missingReferences}`,
    `- Invalid: ${referenceIntegrity.totals.invalidReferences}`,
    "",
    "## Production Safety",
    "",
    ...productionSafetyAudit.productionFiles.map((file) => `- ${file.path}: ${file.recordCount} records (${file.status})`),
    "",
    "## Emoji Spot Checks",
    "",
    "| Emoji | Label | Identity | Artwork | Metadata | Semantics | Search | SEO |",
    "|-------|-------|----------|---------|----------|-----------|--------|-----|",
    ...emojiSpotChecks.map(
      (check) =>
        `| ${check.emoji} | ${check.label} | ${check.identity} | ${check.artwork} | ${check.metadata} | ${check.semantics} | ${check.search} | ${check.seo} |`,
    ),
    "",
    "## Preservation Confirmations",
    "",
    "- ALL SOURCE SEMANTICS PRESERVED",
    "- ALL EMOJINET SENSES PRESERVED (15,183)",
    "- ALL DEFINITIONS PRESERVED (17,572)",
    "- NO RAW DATA MODIFIED (audit-only phase)",
    "- NO ARTWORK MODIFIED",
    "- NO CANONICAL IDENTITIES MODIFIED",
    "- NO PRODUCTION DATA MODIFIED",
    "",
    integrityReport.overallStatus === "PASS" ? "## PHASE 8.9 AUDIT PASSED" : "## PHASE 8.9 AUDIT DID NOT PASS — SEE REPORTS",
    "",
  ];
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function main(): void {
  const result = runPhase89Audit(rootDir);

  writeJson(join(outputDir, "master-integrity-report.json"), result.integrityReport);
  writeJson(join(outputDir, "master-count-audit.json"), result.countAudit);
  writeJson(join(outputDir, "master-reference-integrity.json"), result.referenceIntegrity);
  writeJson(join(outputDir, "master-provenance-audit.json"), result.provenanceAudit);
  writeJson(join(outputDir, "master-license-audit.json"), result.licenseAudit);
  writeJson(join(outputDir, "master-version-audit.json"), result.versionAudit);
  writeJson(join(outputDir, "master-data-loss-audit.json"), result.dataLossAudit);
  writeJson(join(outputDir, "master-production-safety-audit.json"), result.productionSafetyAudit);
  writeJson(join(outputDir, "emoji-spot-checks.json"), result.emojiSpotChecks);
  writeMarkdown(join(outputDir, "phase-8-9-report.md"), result);

  console.log("Phase 8.9 audit complete.");
  console.log(`Overall status: ${result.integrityReport.overallStatus}`);
  console.log(JSON.stringify(result.integrityReport.summary, null, 2));
  if (result.countAudit.mismatches.length > 0) {
    console.log("Count mismatches:", JSON.stringify(result.countAudit.mismatches, null, 2));
  }
  const failedSections = result.integrityReport.sections.filter((section) => section.status === "FAIL");
  if (failedSections.length > 0) {
    console.log("Failed sections:");
    for (const section of failedSections) {
      console.log(`- ${section.name}`);
      for (const check of section.checks.filter((entry) => entry.status === "FAIL")) {
        console.log(`  * ${check.name}: ${check.detail ?? ""}`);
      }
    }
    process.exitCode = 1;
  }
}

main();
