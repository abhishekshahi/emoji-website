import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildReleasePackage, getDependencyVersions } from "../../src/lib/master/release/build";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptsDir, "..", "..");
const releaseRoot = join(rootDir, "src", "data", "master", "release");
const releaseDir = join(releaseRoot, "8.10");

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function getNpmVersion(): string {
  try {
    return execSync("npm --version", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function writeReleaseMarkdown(result: ReturnType<typeof buildReleasePackage>, dependencyVersions: Record<string, string>): void {
  const lines = [
    "# Phase 8.10 — Master Database Freeze and Release Package",
    "",
    `**Release ID:** ${result.releaseId}`,
    `**Date:** ${result.manifest.releaseDate}`,
    `**Status:** FROZEN`,
    "",
    "## Release Summary",
    "",
    "| Metric | Count |",
    "|--------|------:|",
    `| Raw source records | ${result.manifest.rawRecordCount} |`,
    `| Canonical identities | ${result.manifest.canonicalIdentityCount} |`,
    `| Artwork records | ${result.manifest.artworkCount} |`,
    `| Master metadata | ${result.manifest.metadataCount} |`,
    `| EmojiNet senses | ${result.manifest.semanticCount} |`,
    `| EmojiNet definitions | ${result.manifest.definitionCount} |`,
    `| Aliases | ${result.manifest.aliasCount} |`,
    `| Canonical keyword terms | ${result.manifest.keywordCount} |`,
    `| Shortcode records | ${result.manifest.shortcodeCount} |`,
    `| Safe search terms | ${result.manifest.searchTermCount} |`,
    `| Safe SEO terms | ${result.manifest.seoTermCount} |`,
    `| Tests | ${result.manifest.testCount} |`,
    "",
    "## Source Versions (Locked)",
    "",
    ...result.manifest.sources.map(
      (source) => `- **${source.name}** ${source.version}${source.commit ? ` (${source.commit})` : source.tag ? ` (${source.tag})` : ""} — ${source.license}`,
    ),
    "",
    "## File Checksums",
    "",
    `${result.fileChecksums.length} master database files checksummed (SHA-256). See \`master-file-checksums.json\`.`,
    "",
    "## Artwork Checksums",
    "",
    `- Total files: ${result.artworkReleaseChecksums.totalFiles}`,
    `- Missing: ${result.artworkReleaseChecksums.missingFiles}`,
    `- Checksum failures: ${result.artworkReleaseChecksums.checksumFailures}`,
    `- OpenMoji: ${result.artworkReleaseChecksums.providers.openmoji?.fileCount ?? 0}`,
    `- Noto: ${result.artworkReleaseChecksums.providers.noto?.fileCount ?? 0}`,
    `- Twemoji: ${result.artworkReleaseChecksums.providers.twemoji?.fileCount ?? 0}`,
    `- Fluent: ${result.artworkReleaseChecksums.providers.fluent?.fileCount ?? 0}`,
    "",
    "## Build Environment",
    "",
    `- Node: ${result.buildEnvironment.nodeVersion}`,
    `- npm: ${result.buildEnvironment.npmVersion}`,
    `- TypeScript: ${result.buildEnvironment.typescriptVersion}`,
    `- Next.js: ${result.buildEnvironment.nextVersion}`,
    `- Platform: ${result.buildEnvironment.platform} (${result.buildEnvironment.arch})`,
    "",
    "## Dependency Versions",
    "",
    ...Object.entries(dependencyVersions).map(([pkg, version]) => `- ${pkg}: ${version}`),
    "",
    "## Build Commands",
    "",
    ...result.buildPipeline.commands.map((command) => `- \`${command}\``),
    "",
    "## Reproducibility",
    "",
    `Status: **${result.reproducibility.status}**`,
    "",
    result.reproducibility.note,
    "",
    "## Release Audit",
    "",
    `Status: **${result.releaseAudit.status}**`,
    "",
    `Phase 8.9 audit passed: ${result.releaseAudit.phase89AuditPassed}`,
    `Production safety: ${result.releaseAudit.productionSafety.status}`,
    "",
    "## License Freeze",
    "",
    ...result.licenseFreeze.map((entry) => `- ${entry.source}: ${entry.license} (${entry.appliesTo})`),
    "",
    "## Freeze Marker",
    "",
    "```json",
    JSON.stringify(result.frozenMarker, null, 2),
    "```",
    "",
    "## THE MASTER DATABASE IS FROZEN",
    "",
    "No automatic source update. No silent metadata, artwork, or Unicode update.",
    "Any future source update requires a NEW versioned master release.",
    "",
  ];
  writeFileSync(join(rootDir, "PHASE-8-10-RELEASE.md"), `${lines.join("\n")}\n`, "utf8");
}

function main(): void {
  const npmVersion = getNpmVersion();
  const result = buildReleasePackage(rootDir, { npmVersion });
  const dependencyVersions = getDependencyVersions(rootDir);

  if (result.releaseAudit.status !== "PASS") {
    console.error("Release audit FAILED:");
    console.error(JSON.stringify(result.releaseAudit.mismatches, null, 2));
    process.exitCode = 1;
    return;
  }

  if (result.reproducibility.status !== "PASS") {
    console.error("Reproducibility verification FAILED:");
    console.error(JSON.stringify(result.reproducibility.mismatches, null, 2));
    process.exitCode = 1;
    return;
  }

  writeJson(join(releaseDir, "master-release-manifest.json"), result.manifest);
  writeJson(join(releaseRoot, "master-release-manifest.json"), result.manifest);
  writeJson(join(releaseDir, "master-file-checksums.json"), result.fileChecksums);
  writeJson(join(releaseDir, "raw-source-checksums.json"), result.rawSourceChecksums);
  writeJson(join(releaseDir, "artwork-release-checksums.json"), {
    ...result.artworkReleaseChecksums,
    checksumReference: "src/data/master/artwork/artwork-checksums.json",
    artworkAssetRoot: "src/data/master/raw/artwork/",
  });
  writeJson(join(releaseDir, "source-immutability-manifest.json"), result.sourceImmutability);
  writeJson(join(releaseDir, "master-build-environment.json"), {
    ...result.buildEnvironment,
    dependencyVersions,
  });
  writeJson(join(releaseDir, "master-build-pipeline.json"), result.buildPipeline);
  writeJson(join(releaseDir, "release-audit.json"), result.releaseAudit);
  writeJson(join(releaseDir, "version-update-policy.json"), result.versionUpdatePolicy);
  writeJson(join(releaseDir, "license-freeze.json"), result.licenseFreeze);
  writeJson(join(releaseRoot, "MASTER-DATABASE-FROZEN.json"), result.frozenMarker);
  writeJson(join(releaseDir, "MASTER-DATABASE-FROZEN.json"), result.frozenMarker);
  writeJson(join(releaseDir, "reproducibility-report.json"), result.reproducibility);
  writeReleaseMarkdown(result, dependencyVersions);

  console.log("Phase 8.10 release package built.");
  console.log(`Release ID: ${result.releaseId}`);
  console.log(`Release audit: ${result.releaseAudit.status}`);
  console.log(`Reproducibility: ${result.reproducibility.status}`);
  console.log(`Files checksummed: ${result.fileChecksums.length}`);
  console.log(`Artwork files: ${result.artworkReleaseChecksums.totalFiles}`);
}

main();
