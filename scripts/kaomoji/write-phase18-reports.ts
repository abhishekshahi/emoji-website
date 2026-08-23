import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Phase18Manifest } from "@/lib/kaomoji/processing/phase18/types";
import { getPhase18ManifestPath } from "@/lib/kaomoji/storage/paths";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");

function readManifest(): Phase18Manifest {
  const p = getPhase18ManifestPath(rootDir);
  if (!existsSync(p)) throw new Error("Run npm run kaomoji:phase18 first");
  return JSON.parse(readFileSync(p, "utf8")) as Phase18Manifest;
}

function write(name: string, body: string): void {
  mkdirSync(exportDir, { recursive: true });
  writeFileSync(join(exportDir, name), body, "utf8");
  console.log("Wrote", name);
}

function main(): void {
  const m = readManifest();
  const verdict = m.errors.length === 0 && m.anti_abuse_enabled && m.popularity_status === "INSUFFICIENT_DATA" ? "PASS" : "FAIL";
  write("PHASE-18-ANALYTICS-AUDIT.md", [
    "# Phase 18 Analytics Audit",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "No fabricated popularity — INSUFFICIENT_DATA until live threshold.",
    "",
    `Events wired: ${m.events_wired.join(", ")}`,
    `Popularity status: **${m.popularity_status}**`,
    `Trending status: **${m.trending_status}**`,
    `Minimum events for trending: **${m.minimum_events_for_trending}**`,
  ].join("\n"));
  write("PHASE-18-ANALYTICS-FINAL.md", [
    "# Phase 18 Analytics Final",
    "",
    `**Verdict:** ${verdict}`,
    "",
    "| Metric | Value |",
    "|--------|------:|",
    `| Analytics version | ${m.analytics_version} |`,
    `| Anti-abuse | ${m.anti_abuse_enabled} |`,
    `| Popularity | ${m.popularity_status} |`,
  ].join("\n"));
  mkdirSync(join(exportDir, "manifests"), { recursive: true });
  writeFileSync(join(exportDir, "manifests", "phase-18-final.json"), JSON.stringify(m, null, 2) + "\n", "utf8");
}

main();
