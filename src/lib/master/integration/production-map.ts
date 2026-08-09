import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  mapProductionExtra,
  mapProductionStandard,
} from "./build";
import { integrationDataPaths } from "./config";
import type { ProductionToMasterMap, ProductionToMasterEntry } from "./types";

export interface ProductionCanonicalRecord {
  readonly canonicalId: string;
  readonly productionId: string;
  readonly productionHexcode: string;
  readonly productionType: "standard" | "extra";
}

let productionCanonicalIndex: Map<string, string> | null = null;
let productionCanonicalRecords: Map<string, ProductionCanonicalRecord> | null = null;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function ingestEntries(entries: readonly ProductionToMasterEntry[], productionType: "standard" | "extra", index: Map<string, string>, records: Map<string, ProductionCanonicalRecord>): void {
  for (const entry of entries) {
    const key = `${productionType}:${entry.productionHexcode.toUpperCase()}`;
    index.set(key, entry.canonicalId);
    records.set(entry.canonicalId, Object.freeze({
      canonicalId: entry.canonicalId,
      productionId: entry.productionId,
      productionHexcode: entry.productionHexcode,
      productionType,
    }));
  }
}

export function loadProductionCanonicalIndex(rootDir: string = process.cwd()): Map<string, string> {
  if (productionCanonicalIndex) {
    return productionCanonicalIndex;
  }

  const { integrationDir } = integrationDataPaths(rootDir);
  const map = readJson<ProductionToMasterMap>(join(integrationDir, "production-to-master-map.json"));
  const index = new Map<string, string>();
  const records = new Map<string, ProductionCanonicalRecord>();

  ingestEntries(map.standardRecords.entries, "standard", index, records);
  ingestEntries(map.extrasRecords.entries, "extra", index, records);

  productionCanonicalIndex = index;
  productionCanonicalRecords = records;
  return index;
}

export function loadProductionCanonicalRecords(rootDir: string = process.cwd()): ReadonlyMap<string, ProductionCanonicalRecord> {
  loadProductionCanonicalIndex(rootDir);
  return productionCanonicalRecords ?? new Map();
}

export function resetProductionCanonicalIndex(): void {
  productionCanonicalIndex = null;
  productionCanonicalRecords = null;
}

export function resolveProductionCanonicalId(
  hexcode: string,
  productionType: "standard" | "extra",
  rootDir?: string,
): string {
  const normalized = hexcode.toUpperCase();
  const index = loadProductionCanonicalIndex(rootDir ?? process.cwd());
  return (
    index.get(`${productionType}:${normalized}`) ??
    (productionType === "standard" ? mapProductionStandard(normalized) : mapProductionExtra(normalized))
  );
}

export function resolveProductionRecordType(hexcode: string, rootDir?: string): "standard" | "extra" | null {
  const normalized = hexcode.toUpperCase();
  const index = loadProductionCanonicalIndex(rootDir ?? process.cwd());
  if (index.has(`standard:${normalized}`)) {
    return "standard";
  }
  if (index.has(`extra:${normalized}`)) {
    return "extra";
  }
  return null;
}
