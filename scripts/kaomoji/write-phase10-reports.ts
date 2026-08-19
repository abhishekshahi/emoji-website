import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase10Manifest } from "@/lib/kaomoji/processing/phase10/types";
import { getPhase10ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase10Manifest {
  const p = getPhase10ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase10 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase10Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict =
    m.raw_removed === 0 && m.raw_before === m.raw_after && m.errors.length === 0
      ? m.warnings.length
        ? "PASS WITH WARNINGS"
        : "PASS"
      : "FAIL";

  write("PHASE-10-DUPLICATE-AUDIT.md", `# Phase 10 Duplicate Audit\n\nGroups: ${m.duplicate_groups}\nUnique: ${m.unique_records}\n`);
  write("PHASE-10-LOW-QUALITY.md", `# Phase 10 Low Quality\n\nLow/invalid: ${m.low_quality}\nRemove candidates: ${m.remove_candidates}\n`);
  write("PHASE-10-QUALITY-SCORE.md", `# Phase 10 Quality v2\n\n${JSON.stringify(m.quality_buckets, null, 2)}\n`);
  write("PHASE-10-BEAUTY-SCORE.md", `# Phase 10 Beauty\n\n${JSON.stringify(m.beauty_distribution, null, 2)}\n`);
  write("PHASE-10-UNIQUENESS.md", `# Phase 10 Uniqueness\n\n${JSON.stringify(m.uniqueness_distribution, null, 2)}\n`);
  write("PHASE-10-EXPRESSIVENESS.md", `# Phase 10 Expressiveness\n\n${JSON.stringify(m.expressiveness_distribution, null, 2)}\n`);
  write("PHASE-10-OVERALL-SCORE.md", `# Phase 10 Overall\n\n${JSON.stringify(m.overall_distribution, null, 2)}\n`);
  write("PHASE-10-RANKINGS.md", `# Phase 10 Rankings\n\nSeparate dimension rankings.\n`);
  write("PHASE-10-REVIEW-QUEUES.md", `# Phase 10 Review\n\nReview: ${m.review}\n`);
  write("PHASE-10-PUBLICATION-GATE.md", `# Phase 10 Publication\n\n${JSON.stringify(m.publication, null, 2)}\n`);
  write("PHASE-10-NO-LOSS.md", `# Phase 10 No Loss\n\nRAW: ${m.raw_before} → ${m.raw_after}\n`);
  write(
    "PHASE-10-FINAL.md",
    `# Phase 10 Final\n\n**Verdict: ${verdict}**\n\n| RAW | ${m.raw_after} |\n| Canonical | ${m.canonical_candidates} |\n| Popularity | ${m.popularity_status} |\n`,
  );

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-10-quality.json"), `${JSON.stringify(m.quality_buckets, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-10-beauty.json"), `${JSON.stringify(m.beauty_distribution, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-10-uniqueness.json"), `${JSON.stringify(m.uniqueness_distribution, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-10-overall.json"), `${JSON.stringify(m.overall_distribution, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-10-duplicate.json"), `${JSON.stringify({ groups: m.duplicate_groups }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-10-final.json"), `${JSON.stringify(m, null, 2)}\n`, "utf8");
  console.log("Verdict:", verdict);
}

main();
