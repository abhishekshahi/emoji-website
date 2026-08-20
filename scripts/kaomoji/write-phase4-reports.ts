import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase4CollectionManifest } from "@/lib/kaomoji/discovery/phase4/types";
import { getPhase4ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase4CollectionManifest {
  const p = getPhase4ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase4 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase4CollectionManifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function sourceSection(m: Phase4CollectionManifest, id: string, title: string): string {
  const r = m.source_results.find((s) => s.source_id === id);
  if (!r) return `# ${title}\n\nNo data.\n`;
  return `# ${title}

| Metric | Value |
|--------|-------|
| discovered | ${r.discovered} |
| accessible | ${r.accessible} |
| collected | ${r.collected} |
| unique | ${r.unique} |
| duplicates | ${r.duplicates} |
| pages | ${r.pages_processed}/${r.pages_discovered} |
| categories | ${r.categories} |
| license | ${r.license_status} |
| new_raw | ${r.new_raw} |

Content types: ${r.content_types.join(", ")}
`;
}

function main(): void {
  const m = readManifest();
  const verdict = m.removed_records === 0 ? "PASS WITH WARNINGS" : "FAIL";

  write("PHASE-4-COMPLETE-ACQUISITION.md", `# Phase 4 Complete Acquisition\n\nGenerated: ${m.timestamp}\n\nRAW: ${m.raw_before} → ${m.raw_after} (+${m.new_raw_records})\n`);
  write("PHASE-4-SOURCE-1-EMOTICON-DATA.md", sourceSection(m, "emoticon-data", "Source 1 — emoticon-data"));
  write("PHASE-4-SOURCE-2-KAOMOJI-TAGGED.md", sourceSection(m, "kaomoji-tagged", "Source 2 — kaomoji-tagged"));
  write("PHASE-4-SOURCE-3-WIKIPEDIA.md", sourceSection(m, "wikipedia", "Source 3 — Wikipedia"));
  write("PHASE-4-SOURCE-4-MESSLETTERS.md", sourceSection(m, "messletters", "Source 4 — Messletters") + `\nGap remaining: ${m.messletters_gap_remaining}\n`);
  write("PHASE-4-SOURCE-5-EMOTICONSTEXT.md", sourceSection(m, "emoticonstext", "Source 5 — EmoticonsText") + `\nGap remaining: ${m.emoticonstext_gap_remaining}\n`);
  write("PHASE-4-SOURCE-6-FASTEMOJI.md", sourceSection(m, "fastemoji", "Source 6 — FastEmoji") + `\nCanonical: ${m.fastemoji_canonical_records}, collected: ${m.fastemoji_collected}, remaining: ${m.fastemoji_remaining}\n`);
  write("PHASE-4-NO-LOSS.md", `# Phase 4 No Loss\n\n| Metric | Value |\n|--------|-------|\n| raw_before | ${m.raw_before} |\n| raw_after | ${m.raw_after} |\n| removed_records | ${m.removed_records} |\n| modified_existing | ${m.modified_existing_raw_records} |\n| new_raw | ${m.new_raw_records} |\n`);
  write("PHASE-4-PROVENANCE.md", `# Phase 4 Provenance\n\nCoverage: ${m.provenance_coverage}%\n`);
  write("PHASE-4-FINAL.md", `# Phase 4 Final\n\n**Verdict: ${verdict}**\n\n| Metric | Value |\n|--------|-------|\n| total_raw | ${m.total_raw} |\n| total_unique | ${m.total_unique} |\n| total_discovered | ${m.total_discovered} |\n| messletters_gap | ${m.messletters_gap_remaining} |\n| fastemoji_collected | ${m.fastemoji_collected} |\n`);

  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-4-source-inventory.json"), `${JSON.stringify(m.source_results, null, 2)}\n`, "utf8");
  writeFileSync(join(manifestDir, "phase-4-final.json"), `${JSON.stringify(m, null, 2)}\n`, "utf8");

  const fePath = join(rootDir, "data/kaomoji/universal/phase-4-fastemoji.json");
  const mlPath = join(rootDir, "data/kaomoji/universal/phase-4-messletters.json");
  if (existsSync(fePath)) writeFileSync(join(manifestDir, "phase-4-fastemoji.json"), readFileSync(fePath, "utf8"), "utf8");
  if (existsSync(mlPath)) writeFileSync(join(manifestDir, "phase-4-messletters.json"), readFileSync(mlPath, "utf8"), "utf8");
}

main();
