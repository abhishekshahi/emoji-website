import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EXPECTED_KAOMOJI,
  EXPECTED_RELATIONSHIPS,
  isImportComplete,
} from "@/lib/kaomoji/cloudflare/d1-import";
import { getPhase18ManifestPath, getPhase19ManifestPath, getPhase20ManifestPath } from "../../storage/paths";
import type { Phase18Manifest } from "../phase18/types";
import type { Phase19Manifest } from "@/lib/kaomoji/cloudflare/types";
import type { Phase20Manifest } from "../phase20/types";

export const KAOMOJI_PUBLIC_ROUTES = [
  "/",
  "/kaomoji",
  "/kaomoji/[slug]",
  "/kaomoji/collections/[slug]",
  "/api/kaomoji/search",
] as const;

export const KAOMOJI_LOCALES = [
  "en", "ja", "ko", "zh", "es", "fr", "de", "pt", "it", "ru", "ar",
] as const;

export function readJsonSafe<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function auditPhase19Gate(rootDir: string, remote: boolean): boolean {
  if (remote) return isImportComplete(rootDir, true);
  const m = readJsonSafe<Phase19Manifest>(getPhase19ManifestPath(rootDir));
  return (
    m?.public_records === EXPECTED_KAOMOJI &&
    (m?.relationships ?? 0) <= EXPECTED_RELATIONSHIPS &&
    (m?.relationships ?? 0) > 0
  );
}

export function auditPhase20Gate(rootDir: string): boolean {
  const m = readJsonSafe<Phase20Manifest>(getPhase20ManifestPath(rootDir));
  return m !== null && m.errors.length === 0 && m.performance.search_benchmark_pass;
}

export function auditRollbackManifest(rootDir: string): boolean {
  return existsSync(
    join(rootDir, "data/kaomoji/processed/phase-19/export/r2/backup/rollback-manifest.json"),
  );
}

export function auditAnalytics(rootDir: string): { popularity: "INSUFFICIENT_DATA" | "LIVE"; events: string[] } {
  const m = readJsonSafe<Phase18Manifest>(getPhase18ManifestPath(rootDir));
  return {
    popularity: m?.popularity_status ?? "INSUFFICIENT_DATA",
    events: m ? [...m.events_wired] : [],
  };
}

export function auditRouteFiles(rootDir: string): string[] {
  const found: string[] = [];
  const checks: [string, string][] = [
    [join(rootDir, "src/app/page.tsx"), "/"],
    [join(rootDir, "src/app/kaomoji/page.tsx"), "/kaomoji"],
    [join(rootDir, "src/app/api/kaomoji/search/route.ts"), "/api/kaomoji/search"],
  ];
  for (const [path, route] of checks) {
    if (existsSync(path)) found.push(route);
  }
  const slugDir = join(rootDir, "src/app/kaomoji");
  if (existsSync(slugDir)) {
    for (const name of ["[slug]", "collections"]) {
      if (existsSync(join(slugDir, name))) found.push(`/kaomoji/${name === "[slug]" ? "[slug]" : "collections/[slug]"}`);
    }
  }
  return found;
}
