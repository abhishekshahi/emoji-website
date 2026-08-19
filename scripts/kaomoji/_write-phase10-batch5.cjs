const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");
function w(rel, content) {
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  console.log("wrote", rel);
}

w("scripts/kaomoji/run-phase10.ts", `import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase10Pipeline } from "@/lib/kaomoji/processing/phase10/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 10 — scoring + curation pass");
  const { manifest } = runPhase10Pipeline(rootDir);
  console.log("\\n=== Phase 10 Complete ===");
  console.log("RAW:", manifest.raw_before, "removed:", manifest.raw_removed);
  console.log("Scored:", manifest.canonical_candidates);
  console.log("Quality EXCELLENT:", manifest.quality_buckets.EXCELLENT, "INVALID:", manifest.quality_buckets.INVALID_REVIEW);
  console.log("Popularity:", manifest.popularity_status);
}

main();
`);

w("scripts/kaomoji/write-phase10-reports.ts", `import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  const verdict = m.raw_removed === 0 && m.raw_before === m.raw_after && m.errors.length === 0
    ? (m.warnings.length ? "PASS WITH WARNINGS" : "PASS") : "FAIL";
  write("PHASE-10-DUPLICATE-AUDIT.md", \`# Phase 10 Duplicate Audit\\n\\nGroups: \${m.duplicate_groups}\\nUnique: \${m.unique_records}\\n\`);
  write("PHASE-10-LOW-QUALITY.md", \`# Phase 10 Low Quality\\n\\nLow/invalid: \${m.low_quality}\\nRemove candidates: \${m.remove_candidates}\\n\`);
  write("PHASE-10-QUALITY-SCORE.md", \`# Phase 10 Quality v2\\n\\n\${Object.entries(m.quality_buckets).map(([k,v])=>\\`- \${k}: \${v}\\`).join("\\n")}\\n\`);
  write("PHASE-10-BEAUTY-SCORE.md", \`# Phase 10 Beauty\\n\\n\${Object.entries(m.beauty_distribution).map(([k,v])=>\\`- \${k}: \${v}\\`).join("\\n")}\\n\`);
  write("PHASE-10-UNIQUENESS.md", \`# Phase 10 Uniqueness\\n\\n\${Object.entries(m.uniqueness_distribution).map(([k,v])=>\\`- \${k}: \${v}\\`).join("\\n")}\\n\`);
  write("PHASE-10-EXPRESSIVENESS.md", \`# Phase 10 Expressiveness\\n\\n\${Object.entries(m.expressiveness_distribution).map(([k,v])=>\\`- \${k}: \${v}\\`).join("\\n")}\\n\`);
  write("PHASE-10-OVERALL-SCORE.md", \`# Phase 10 Overall\\n\\n\${Object.entries(m.overall_distribution).map(([k,v])=>\\`- \${k}: \${v}\\`).join("\\n")}\\n\`);
  write("PHASE-10-RANKINGS.md", \`# Phase 10 Rankings\\n\\nSeparate quality/beauty/uniqueness/expressiveness/overall rankings.\\n\`);
  write("PHASE-10-REVIEW-QUEUES.md", \`# Phase 10 Review Queues\\n\\nReview records: \${m.review}\\n\`);
  write("PHASE-10-PUBLICATION-GATE.md", \`# Phase 10 Publication\\n\\n\${Object.entries(m.publication).map(([k,v])=>\\`- \${k}: \${v}\\`).join("\\n")}\\n\`);
  write("PHASE-10-NO-LOSS.md", \`# Phase 10 No Loss\\n\\nRAW: \${m.raw_before} → \${m.raw_after}\\nSHA: \${m.raw_sha256}\\n\`);
  write("PHASE-10-FINAL.md", \`# Phase 10 Final\\n\\n**Verdict: \${verdict}**\\n\\n| RAW | \${m.raw_after} |\\n| Canonical | \${m.canonical_candidates} |\\n| Public eligible | see publication gate |\\n| Popularity | \${m.popularity_status} |\\n\`);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-10-quality.json"), JSON.stringify(m.quality_buckets, null, 2));
  writeFileSync(join(manifestDir, "phase-10-beauty.json"), JSON.stringify(m.beauty_distribution, null, 2));
  writeFileSync(join(manifestDir, "phase-10-uniqueness.json"), JSON.stringify(m.uniqueness_distribution, null, 2));
  writeFileSync(join(manifestDir, "phase-10-overall.json"), JSON.stringify(m.overall_distribution, null, 2));
  writeFileSync(join(manifestDir, "phase-10-duplicate.json"), JSON.stringify({ groups: m.duplicate_groups, unique: m.unique_records }, null, 2));
  writeFileSync(join(manifestDir, "phase-10-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}
main();
`);

console.log("batch5 scripts done");
