import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { CanonicalKeywordEntry, CanonicalShortcodeEntry } from "@/lib/master/reconciliation/types";
import type { SemanticDefinitionEntry } from "@/lib/master/semantic/types";
import { integrationDataPaths } from "../config";

let keywordIndex: Map<string, CanonicalKeywordEntry> | null = null;
let shortcodeIndex: Map<string, CanonicalShortcodeEntry> | null = null;
let definitionIndex: Map<string, SemanticDefinitionEntry[]> | null = null;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function getKeywordIndex(rootDir: string = process.cwd()): ReadonlyMap<string, CanonicalKeywordEntry> {
  if (keywordIndex) {
    return keywordIndex;
  }

  const { masterDir } = integrationDataPaths(rootDir);
  const records = readJson<CanonicalKeywordEntry[]>(join(masterDir, "metadata/canonical-keywords.json"));
  keywordIndex = new Map(records.map((record) => [record.canonicalId, Object.freeze(record)]));
  return keywordIndex;
}

export function getShortcodeIndex(rootDir: string = process.cwd()): ReadonlyMap<string, CanonicalShortcodeEntry> {
  if (shortcodeIndex) {
    return shortcodeIndex;
  }

  const { masterDir } = integrationDataPaths(rootDir);
  const records = readJson<CanonicalShortcodeEntry[]>(join(masterDir, "metadata/canonical-shortcodes.json"));
  shortcodeIndex = new Map(records.map((record) => [record.canonicalId, Object.freeze(record)]));
  return shortcodeIndex;
}

export function getDefinitionIndex(rootDir: string = process.cwd()): ReadonlyMap<string, SemanticDefinitionEntry[]> {
  if (definitionIndex) {
    return definitionIndex;
  }

  const { masterDir } = integrationDataPaths(rootDir);
  const records = readJson<SemanticDefinitionEntry[]>(join(masterDir, "semantic/semantic-definitions-index.json"));
  const map = new Map<string, SemanticDefinitionEntry[]>();
  for (const record of records) {
    const existing = map.get(record.canonicalId) ?? [];
    existing.push(Object.freeze(record));
    map.set(record.canonicalId, existing);
  }
  definitionIndex = map;
  return definitionIndex;
}

export function resetMetadataLazyIndexes(): void {
  keywordIndex = null;
  shortcodeIndex = null;
  definitionIndex = null;
}
