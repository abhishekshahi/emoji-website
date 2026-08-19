import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase7CollectionManifest } from "@/lib/kaomoji/processing/phase7/types";
import { getPhase7ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase7CollectionManifest {
  const p = getPhase7ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase7 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase7CollectionManifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict =
    m.raw_removed === 0 && m.raw_modified === 0 && m.raw_before === m.raw_after ? "PASS" : "FAIL";

  write(
    "PHASE-7-RAW-AUDIT.md",
    `# Phase 7 RAW Audit\n\n| RAW before | ${m.raw_before} |\n| RAW after | ${m.raw_after} |\n| Removed | ${m.raw_removed} |\n| Modified | ${m.raw_modified} |\n| Provenance | ${(m.provenance_coverage * 100).toFixed(1)}% |\n`,
  );
  write("PHASE-7-NORMALIZATION.md", `# Phase 7 Normalization\n\nTotal normalized: ${m.total_normalized}\n`);
  write(
    "PHASE-7-DUPLICATE-ANALYSIS.md",
    `# Phase 7 Duplicate Analysis\n\n${Object.entries(m.duplicate_counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`,
  );
  write("PHASE-7-VARIANTS.md", `# Phase 7 Variants\n\nLegitimate variant groups: ${m.variant_count}\n`);
  write(
    "PHASE-7-VALIDATION.md",
    `# Phase 7 Validation\n\n${Object.entries(m.validation_counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`,
  );
  write(
    "PHASE-7-QUALITY.md",
    `# Phase 7 Quality\n\n${Object.entries(m.quality_buckets).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`,
  );
  write(
    "PHASE-7-LICENSE.md",
    `# Phase 7 License\n\n${Object.entries(m.license_counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`,
  );
  write(
    "PHASE-7-PUBLICATION-CANDIDATES.md",
    `# Phase 7 Publication Candidates\n\n${Object.entries(m.publication_counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}\n`,
  );
  write("PHASE-7-PROVENANCE.md", `# Phase 7 Provenance\n\nCoverage: ${(m.provenance_coverage * 100).toFixed(1)}%\n`);
  write(
    "PHASE-7-NO-LOSS.md",
    `# Phase 7 No Loss\n\n| raw_before | ${m.raw_before} |\n| raw_after | ${m.raw_after} |\n| removed | ${m.raw_removed} |\n| modified | ${m.raw_modified} |\n`,
  );
  write(
    "PHASE-7-FINAL.md",
    `# Phase 7 Final\n\n**Verdict: ${verdict}**\n\nRAW preserved: ${m.raw_before === m.raw_after && m.raw_removed === 0}\nNormalized: ${m.total_normalized}\nVariants: ${m.variant_count}\nFastEmoji remaining: ${m.fastemoji_remaining ?? "n/a"}\n`,
  );

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-7-normalization.json"), `${JSON.stringify({ total: m.total_normalized }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-7-duplicates.json"), `${JSON.stringify(m.duplicate_counts, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-7-variants.json"), `${JSON.stringify({ count: m.variant_count }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-7-validation.json"), `${JSON.stringify(m.validation_counts, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-7-quality.json"), `${JSON.stringify(m.quality_buckets, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-7-license.json"), `${JSON.stringify(m.license_counts, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-7-final.json"), `${JSON.stringify(m, null, 2)}\n`, "utf8");
  console.log("Verdict:", verdict);
}

main();
