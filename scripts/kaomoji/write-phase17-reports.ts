import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase17Manifest } from "@/lib/kaomoji/processing/phase17/types";
import { getPhase17ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase17Manifest {
  const p = getPhase17ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase17 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase17Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 && m.instant_search && m.mobile_first ? "PASS" : "FAIL";
  write("PHASE-17-UI-AUDIT.md", [
    "# Phase 17 UI/UX Audit",
    "",
    `**Verdict:** ${verdict}`,
    "",
    `Instant search: **${m.instant_search}** (debounce ${m.debounce_ms}ms)`,
    `Filter categories: **${m.filter_categories}**`,
    `Accessibility checks: ${m.accessibility_checks.length}`,
    "Quality scores hidden from UI.",
  ].join("\n"));
  write("PHASE-17-UI-FINAL.md", [
    "# Phase 17 UI/UX Final",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| UI version | ${m.ui_version} |`,
    `| Debounce ms | ${m.debounce_ms} |`,
    `| Mobile first | ${m.mobile_first} |`,
  ].join("\n"));
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-17-final.json"), JSON.stringify(m, null, 2) + "\n", "utf8");
}

main();
