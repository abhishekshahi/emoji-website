import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { runWrangler } from "../r2/wrangler-r2.ts";

const root = process.cwd();
const editorial = JSON.parse(
  readFileSync("data/kaomoji/processed/phase-12/public-quality/editorial.json", "utf8"),
).filter((r) => r.is_public);
const ids = editorial.map((r) => r.canonical_id);
console.log("local public", ids.length);

const missing = [];
for (let i = 0; i < ids.length; i += 40) {
  const chunk = ids.slice(i, i + 40);
  const inList = chunk.map((id) => `'${id}'`).join(",");
  const sql = `SELECT canonical_id FROM kaomoji WHERE canonical_id IN (${inList})`;
  const r = runWrangler(["d1", "execute", "emojiquick-kaomoji", "--command", sql, "--remote"], root);
  const found = new Set([...r.stdout.matchAll(/kao_[0-9a-f]{16}/g)].map((m) => m[0]));
  for (const id of chunk) if (!found.has(id)) missing.push(id);
  if (i % 400 === 0) console.log("checked", i, "missing", missing.length);
}
console.log("missing total", missing.length);
writeFileSync("data/kaomoji/processed/phase-19/missing-kaomoji-ids.json", JSON.stringify(missing, null, 2));

const missingSet = new Set(missing);
const d1Dir = join(root, "data/kaomoji/processed/phase-19/export/d1/kaomoji");
const lines = [];
for (const f of readdirSync(d1Dir).filter((x) => x.endsWith(".sql")).sort()) {
  const content = readFileSync(join(d1Dir, f), "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/'(kao_[0-9a-f]{16})'/);
    if (m && missingSet.has(m[1])) lines.push(line.trim().replace(/,$/, ""));
  }
}
if (lines.length) {
  const sql = `INSERT INTO kaomoji (canonical_id, slug, content, normalized_content, editorial_name, accessible_name, seo_title, seo_description, quality_score, quality_bucket, beauty_score, editorial_tier, editorial_priority, meaning, common_usage, duplicate_group_id, variant_group_id, is_public) VALUES\n${lines.join(",\n")};`;
  const out = join(root, "data/kaomoji/processed/phase-19/export/d1/kaomoji/missing-kaomoji-fill.sql");
  writeFileSync(out, sql);
  console.log("wrote", out, "rows", lines.length);
}