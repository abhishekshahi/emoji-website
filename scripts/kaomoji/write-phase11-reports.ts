import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase11Manifest } from "@/lib/kaomoji/processing/phase11/types";
import { getPhase11ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const manifestDir = join(exportDir, "manifests");

function readManifest(): Phase11Manifest {
  const p = getPhase11ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase11 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase11Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.raw_removed === 0 && m.raw_before === m.raw_after && m.errors.length === 0 ? "PASS" : "FAIL";
  write("PHASE-11-CANONICAL-DEFINITION.md", "# Phase 11 Definition\n\n" + m.canonical_definition.definition + "\n\nCount: " + m.canonical_candidates);
  write("PHASE-11-CONTENT-TYPE.md", "# Content Type\n\n" + JSON.stringify(m.primary_content_type, null, 2) + "\n\nSecondary labels: " + m.secondary_content_type_labels);
  write("PHASE-11-STYLE.md", "# Style\n\n" + JSON.stringify(m.style_primary, null, 2));
  write("PHASE-11-EMOTION.md", "# Emotion\n\n" + JSON.stringify(m.emotion, null, 2));
  write("PHASE-11-RELATIONSHIP.md", "# Relationship\n\n" + JSON.stringify(m.relationship, null, 2));
  write("PHASE-11-CUTE-KAWAII.md", "# Cute/Kawaii\n\n" + JSON.stringify(m.cute_kawaii, null, 2));
  write("PHASE-11-ANIMALS.md", "# Animals\n\n" + JSON.stringify(m.animals, null, 2));
  write("PHASE-11-ACTIONS.md", "# Actions\n\n" + JSON.stringify(m.actions, null, 2));
  write("PHASE-11-VARIANTS.md", "# Variants\n\n" + JSON.stringify(m.variant_composition, null, 2));
  write("PHASE-11-UNIQUE-RECORDS.md", "# Unique\n\n" + JSON.stringify(m.unique_composition, null, 2));
  write("PHASE-11-QUALITY.md", "# Quality\n\n" + JSON.stringify(m.quality_buckets, null, 2));
  write("PHASE-11-SCORES.md", "# Scores\n\nBeauty: " + JSON.stringify(m.beauty_distribution) + "\nOverall: " + JSON.stringify(m.overall_distribution));
  write("PHASE-11-PUBLICATION.md", "# Publication\n\n" + JSON.stringify(m.publication, null, 2));
  write("PHASE-11-NO-LOSS.md", "# No Loss\n\nRAW: " + m.raw_before + " -> " + m.raw_after);
  write("PHASE-11-FINAL.md", "# Phase 11 Final\n\n**Verdict: " + verdict + "**\n\nCanonical: " + m.canonical_candidates + "\nPublic: " + m.public_candidates);
  mkdirSync(manifestDir, { recursive: true });
  writeFileSync(join(manifestDir, "phase-11-composition.json"), JSON.stringify(m, null, 2));
  writeFileSync(join(manifestDir, "phase-11-final.json"), JSON.stringify(m, null, 2));
  console.log("Verdict:", verdict);
}
main();
