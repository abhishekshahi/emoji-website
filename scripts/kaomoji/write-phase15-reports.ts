import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase15Manifest } from "@/lib/kaomoji/processing/phase15/types";
import { getPhase15ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase15Manifest {
  const p = getPhase15ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase15 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase15Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 && m.localized_search_terms >= 30 ? "PASS" : "FAIL";
  write("PHASE-15-MULTILINGUAL-AUDIT.md", [
    "# Phase 15 Multilingual Audit",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "Controlled locale search terms — no fabricated record meanings.",
    "",
    `Supported locales: **${m.supported_locales}**`,
    `Localized search terms: **${m.localized_search_terms}**`,
    `Published locales: **${m.published_locales}**`,
    `Hreflang routes: **${m.hreflang_routes}**`,
  ].join("\n"));
  write("PHASE-15-MULTILINGUAL-FINAL.md", [
    "# Phase 15 Multilingual Final",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| Locale version | ${m.locale_version} |`,
    `| Search terms | ${m.localized_search_terms} |`,
    `| Published | ${m.published_locales} |`,
    `| Review required | ${m.review_required_locales} |`,
  ].join("\n"));
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-15-final.json"), JSON.stringify(m, null, 2) + "\n", "utf8");
}

main();
