const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..", "..");

const files = {
  "src/lib/kaomoji/processing/phase13/content-validation.ts": `import type { KaomojiEditorialRecord } from "../phase9/types";
import type { ContentValidationResult } from "./types";

const URL = /https?:\\/\\//i;
const HTML = /<\\/?[a-z][\\s\\S]*?>/i;
const REPLACEMENT = /\\uFFFD|\uFFFD/;

export function validatePublicContent(records: readonly KaomojiEditorialRecord[]): ContentValidationResult {
  const flags: Record<string, number> = {};
  let valid = 0, review = 0, invalid = 0;
  for (const r of records) {
    const c = r.canonical_content;
    let status: "VALID" | "REVIEW" | "INVALID" = "VALID";
    if (!c || c.trim().length === 0) { status = "INVALID"; flags.empty = (flags.empty ?? 0) + 1; }
    else if (URL.test(c)) { status = "INVALID"; flags.url = (flags.url ?? 0) + 1; }
    else if (HTML.test(c)) { status = "INVALID"; flags.html = (flags.html ?? 0) + 1; }
    else if (REPLACEMENT.test(c)) { status = "REVIEW"; flags.replacement_char = (flags.replacement_char ?? 0) + 1; }
    else if (c.length > 500) { status = "REVIEW"; flags.very_long = (flags.very_long ?? 0) + 1; }
    if (status === "VALID") valid++;
    else if (status === "REVIEW") review++;
    else invalid++;
  }
  return { valid, review, invalid, flags };
}
`,
  "scripts/kaomoji/run-phase13.ts": `import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runPhase13Pipeline } from "@/lib/kaomoji/processing/phase13/pipeline";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");

function main(): void {
  console.log("Phase 13 - final data, legal, storage and build audit");
  const { manifest } = runPhase13Pipeline(rootDir);
  console.log("\\n=== Phase 13 Complete ===");
  console.log("Quality-qualified:", manifest.quality_qualified);
  console.log("Publication eligible:", manifest.publication_eligible);
  console.log("Relationships:", manifest.relationships);
  console.log("RAW drift:", manifest.raw_drift.drift);
  console.log("Storage public:", manifest.storage.public_production_bytes);
  console.log("Errors:", manifest.errors.length);
}

main();
`,
};

for (const [rel, content] of Object.entries(files)) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel);
}

const fix = [
  "src/lib/kaomoji/processing/phase13/pipeline.ts",
  "src/lib/kaomoji/processing/phase13/raw-drift.ts",
  "src/lib/kaomoji/processing/phase13/relationship-audit.ts",
  "src/lib/kaomoji/processing/phase13/storage-audit.ts",
  "src/lib/kaomoji/processing/phase13/types.ts",
  "src/lib/kaomoji/storage/paths.ts",
];
for (const rel of fix) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  const b = fs.readFileSync(p);
  if (b[1] === 0) {
    fs.writeFileSync(p, b.toString("utf16le"), "utf8");
    console.log("fixed encoding", rel);
  }
}
