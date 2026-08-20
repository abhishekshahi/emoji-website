const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");

function patch(file, oldStr, newStr) {
  const p = path.join(root, file);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes(oldStr.slice(0, 40))) {
    console.warn("skip", file, "- pattern not found");
    return;
  }
  s = s.replace(oldStr, newStr);
  fs.writeFileSync(p, s, "utf8");
  console.log("patched", file);
}

// paths.ts
patch(
  "src/lib/kaomoji/storage/paths.ts",
  `export function getPhase12PublicLibraryDir(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "public-library");
}

export function getPhase12ManifestPath(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "manifests", "phase-12-final.json");
}

export const PHASE12_PIPELINE_VERSION = "12.0.0-public-library-quality-filter";`,
  `export function getPhase12PublicQualityDir(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "public-quality");
}

/** @deprecated use getPhase12PublicQualityDir */
export function getPhase12PublicLibraryDir(rootDir: string): string {
  return getPhase12PublicQualityDir(rootDir);
}

export function getPhase12ManifestPath(rootDir: string): string {
  return join(getPhase12RootDir(rootDir), "manifests", "phase-12-final.json");
}

export const PHASE12_PIPELINE_VERSION = "12.0.0-quality-library-excellent-high-good-medium";`,
);

// publication-filter.ts
patch(
  "src/lib/kaomoji/processing/phase12/publication-filter.ts",
  `export const QUALITY_ELIGIBLE_BUCKETS: readonly QualityBucket[] = ["EXCELLENT", "HIGH", "GOOD"];`,
  `export const QUALITY_ELIGIBLE_BUCKETS: readonly QualityBucket[] = ["EXCELLENT", "HIGH", "GOOD", "MEDIUM"];`,
);

patch(
  "src/lib/kaomoji/processing/phase12/publication-filter.ts",
  `  if (bucket === "MEDIUM") return "quality_medium";
  if (bucket === "LOW") return "quality_low";`,
  `  if (bucket === "LOW") return "quality_low";`,
);

// types.ts - update manifest fields
const typesPath = path.join(root, "src/lib/kaomoji/processing/phase12/types.ts");
let types = fs.readFileSync(typesPath, "utf8");
types = types.replace("readonly good_qualified: number;", "readonly good_qualified: number;\n  readonly medium_qualified: number;");
types = types.replace("readonly good_public: number;", "readonly good_public: number;\n  readonly medium_public: number;");
types = types.replace("readonly medium_excluded: number;", "readonly medium_qualified_count: number;");
types = types.replace("readonly good_bytes: number;\n  readonly total_public_bytes: number;", "readonly good_bytes: number;\n  readonly medium_bytes: number;\n  readonly total_public_bytes: number;");
types = types.replace("| \"quality_medium\"\n  | \"quality_low\"", "| \"quality_low\"");
fs.writeFileSync(typesPath, types, "utf8");
console.log("patched types.ts");

// storage-measure.ts
patch(
  "src/lib/kaomoji/processing/phase12/storage-measure.ts",
  `    "excluded-manifest.json",`,
  `    "excluded-records.json",`,
);
patch(
  "src/lib/kaomoji/processing/phase12/storage-measure.ts",
  `    good_bytes: dirSize(join(libDir, "good")),
    total_public_bytes: Object.values(breakdown).reduce((a, b) => a + b, 0) + dirSize(join(libDir, "excellent")) + dirSize(join(libDir, "high")) + dirSize(join(libDir, "good")),`,
  `    good_bytes: dirSize(join(libDir, "good")),
    medium_bytes: dirSize(join(libDir, "medium")),
    total_public_bytes: Object.values(breakdown).reduce((a, b) => a + b, 0) + dirSize(join(libDir, "excellent")) + dirSize(join(libDir, "high")) + dirSize(join(libDir, "good")) + dirSize(join(libDir, "medium")),`,
);

console.log("batch patch done");
