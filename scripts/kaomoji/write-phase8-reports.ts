import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase8Manifest } from "@/lib/kaomoji/processing/phase8/types";
import { getPhase8ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase8Manifest {
  const p = getPhase8ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase8 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase8Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict =
    m.raw_removed === 0 && m.raw_before === m.raw_after && m.no_loss.all_raw_mapped
      ? m.warnings.length ? "PASS WITH WARNINGS" : "PASS"
      : "FAIL";

  write("PHASE-8-PROVENANCE-REPAIR.md", `# Phase 8 Provenance Repair\n\n${m.provenance_repair_explanation}\n\n| COMPLETE | ${m.provenance.COMPLETE} |\n| PARTIAL | ${m.provenance.PARTIAL} |\n| MISSING | ${m.provenance.MISSING} |\n| CONFLICTING | ${m.provenance.CONFLICTING} |\n| UNRESOLVED | ${m.provenance.PROVENANCE_UNRESOLVED} |\n`);
  write("PHASE-8-DUPLICATE-RESOLUTION.md", `# Phase 8 Duplicate Resolution\n\nExact groups: ${m.exact_groups}\nExact occurrences: ${m.exact_occurrences}\n`);
  write("PHASE-8-CANONICALIZATION.md", `# Phase 8 Canonicalization\n\nCanonical candidates: ${m.canonical_candidates}\nFrom RAW: ${m.raw_before}\n`);
  write("PHASE-8-VARIANTS.md", `# Phase 8 Variants\n\nVariant groups: ${m.variant_groups}\nLegitimate: ${m.legitimate_variants}\nReview: ${m.review_variants}\n`);
  write("PHASE-8-QUALITY.md", `# Phase 8 Quality\n\n${Object.entries(m.quality).map(([k,v])=>`- ${k}: ${v}`).join("\n")}\n`);
  write("PHASE-8-LICENSE.md", `# Phase 8 License\n\n${Object.entries(m.license).map(([k,v])=>`- ${k}: ${v}`).join("\n")}\n`);
  write("PHASE-8-UNIQUE-RECORDS.md", `# Phase 8 Unique Records\n\n| Unique total | ${m.unique_records} |\n| Legitimate | ${m.unique_legitimate} |\n| Review | ${m.unique_review} |\n| Remove candidates | ${m.unique_remove_candidates} |\n`);
  write("PHASE-8-REVIEW-QUEUE.md", `# Phase 8 Review Queue\n\nREVIEW curation: ${m.curation.REVIEW}\n`);
  write("PHASE-8-REMOVE-CANDIDATES.md", `# Phase 8 Remove Candidates\n\n**Non-destructive** — ${m.curation.REMOVE_CANDIDATE} candidates flagged, 0 deleted.\n`);
  write("PHASE-8-NO-LOSS.md", `# Phase 8 No Loss\n\n| RAW before | ${m.raw_before} |\n| RAW after | ${m.raw_after} |\n| Mapped | ${m.no_loss.mapped_count} |\n| All mapped | ${m.no_loss.all_raw_mapped} |\n`);
  write("PHASE-8-FINAL.md", `# Phase 8 Final

**Verdict: ${verdict}**

## RAW Conservation
| Metric | Value |
|--------|-------|
| RAW before | ${m.raw_before} |
| RAW after | ${m.raw_after} |
| RAW removed | ${m.raw_removed} |
| RAW modified | ${m.raw_modified} |
| SHA-256 | \`${m.raw_sha256_after}\` |

## Canonical Library
| Metric | Value |
|--------|-------|
| Normalized | ${m.total_normalized} |
| Canonical candidates | ${m.canonical_candidates} |
| Exact duplicate groups | ${m.exact_groups} |
| Exact duplicate occurrences | ${m.exact_occurrences} |
| Variant groups | ${m.variant_groups} |
| Legitimate variants | ${m.legitimate_variants} |

## Unique Records
| Metric | Value |
|--------|-------|
| Unique records | ${m.unique_records} |
| Unique legitimate | ${m.unique_legitimate} |
| Unique review | ${m.unique_review} |
| Unique remove candidates | ${m.unique_remove_candidates} |

## Provenance (repaired)
| Status | Count |
|--------|-------|
| COMPLETE | ${m.provenance.COMPLETE} |
| PARTIAL | ${m.provenance.PARTIAL} |
| MISSING | ${m.provenance.MISSING} |
| CONFLICTING | ${m.provenance.CONFLICTING} |
| UNRESOLVED | ${m.provenance.PROVENANCE_UNRESOLVED} |

${m.provenance_repair_explanation}

## Quality
${Object.entries(m.quality).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## License
${Object.entries(m.license).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Curation
${Object.entries(m.curation).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## Publication
${Object.entries(m.publication).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

## No-Loss
- All RAW mapped: ${m.no_loss.all_raw_mapped}
- Mapped count: ${m.no_loss.mapped_count}

**No destructive removals. REMOVE_CANDIDATE ≠ deleted.**
`);

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-8-provenance.json"), `${JSON.stringify(m.provenance, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-8-canonical.json"), `${JSON.stringify({ count: m.canonical_candidates }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-8-duplicates.json"), `${JSON.stringify({ groups: m.exact_groups, occurrences: m.exact_occurrences }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-8-variants.json"), `${JSON.stringify({ groups: m.variant_groups }, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-8-curation.json"), `${JSON.stringify(m.curation, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-8-license.json"), `${JSON.stringify(m.license, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-8-final.json"), `${JSON.stringify(m, null, 2)}\n`, "utf8");
  console.log("Verdict:", verdict);
}

main();
