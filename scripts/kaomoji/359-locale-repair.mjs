import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

function sqlEscape(v) {
  if (v == null) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

const out = execSync(
  `npx wrangler d1 execute emojiquick-kaomoji --remote --json --command "SELECT k.canonical_id FROM kaomoji k WHERE k.is_public = 1 AND NOT EXISTS (SELECT 1 FROM kaomoji_locale l WHERE l.canonical_id = k.canonical_id AND l.field_key = 'seo_title');"`,
  { encoding: "utf8" },
);
const missingIds = JSON.parse(out)[0].results.map((r) => r.canonical_id);
const editorial = JSON.parse(readFileSync("data/kaomoji/processed/phase-12/public-quality/editorial.json", "utf8"));
const rows = [];
for (const id of missingIds) {
  const r = editorial.find((x) => x.canonical_id === id);
  if (!r) continue;
  rows.push(`(${sqlEscape("en")}, ${sqlEscape(r.canonical_id)}, ${sqlEscape("seo_title")}, ${sqlEscape(r.seo_title)})`);
  rows.push(`(${sqlEscape("en")}, ${sqlEscape(r.canonical_id)}, ${sqlEscape("seo_description")}, ${sqlEscape(r.seo_description)})`);
  rows.push(`(${sqlEscape("en")}, ${sqlEscape(r.canonical_id)}, ${sqlEscape("accessible_name")}, ${sqlEscape(r.accessible_name)})`);
  if (r.editorial_name) {
    rows.push(`(${sqlEscape("en")}, ${sqlEscape(r.canonical_id)}, ${sqlEscape("editorial_name")}, ${sqlEscape(r.editorial_name)})`);
  }
}
const sql = `INSERT OR IGNORE INTO kaomoji_locale (locale, canonical_id, field_key, field_value) VALUES\n${rows.join(",\n")};`;
const path = "data/kaomoji/processed/final/d1-incremental/locale-repair.sql";
writeFileSync(path, sql + "\n", "utf8");
console.log("Missing IDs:", missingIds.length, "Locale rows:", rows.length);
execSync(`npx wrangler d1 execute emojiquick-kaomoji --remote --file "${path}"`, { stdio: "inherit" });
const count = JSON.parse(
  execSync(`npx wrangler d1 execute emojiquick-kaomoji --remote --json --command "SELECT COUNT(*) AS c FROM kaomoji_locale;"`, { encoding: "utf8" }),
)[0].results[0].c;
console.log("kaomoji_locale after repair:", count);
