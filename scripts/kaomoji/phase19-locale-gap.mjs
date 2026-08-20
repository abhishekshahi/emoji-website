import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { queryCount, executeSqlFile } from "../../src/lib/kaomoji/cloudflare/d1-import.ts";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const d1 = join(rootDir, "data/kaomoji/processed/phase-19/export/d1");

const kaomojiIds = new Set();
for (const f of readdirSync(join(d1, "kaomoji")).filter((x) => x.endsWith(".sql"))) {
  for (const m of readFileSync(join(d1, "kaomoji", f), "utf8").matchAll(/'(kao_[a-f0-9]+)'/g)) {
    kaomojiIds.add(m[1]);
  }
}

const exportRows = [];
for (const f of readdirSync(join(d1, "kaomoji_locale")).filter((x) => x.endsWith(".sql")).sort()) {
  const sql = readFileSync(join(d1, "kaomoji_locale", f), "utf8");
  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("(")) continue;
    exportRows.push(trimmed.replace(/,\s*$/, ""));
  }
}

console.log("export rows", exportRows.length, "kaomoji ids", kaomojiIds.size);
console.log("remote", queryCount(rootDir, "kaomoji_locale", true));

let fkBad = 0;
for (const row of exportRows) {
  const m = row.match(/'([a-z]{3})',\s*'(kao_[a-f0-9]+)'/);
  if (m && !kaomojiIds.has(m[2])) fkBad++;
}
console.log("fk bad rows", fkBad);

if (exportRows.length !== 198942) {
  console.log("export count mismatch vs expected 198942:", exportRows.length - 198942);
}

const gap = 198942 - (queryCount(rootDir, "kaomoji_locale", true) ?? 0);
console.log("gap to fill", gap);
