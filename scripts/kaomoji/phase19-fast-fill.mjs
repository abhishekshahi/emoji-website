import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const out = execSync(
  'npx wrangler d1 execute emojiquick-kaomoji --remote --json --command "SELECT canonical_id FROM kaomoji;"',
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
const ids = new Set([...out.matchAll(/kao_[0-9a-f]{16}/g)].map((m) => m[0]));
const ed = JSON.parse(
  readFileSync("data/kaomoji/processed/phase-12/public-quality/editorial.json", "utf8"),
).filter((r) => r.is_public);
const missing = new Set(ed.filter((r) => !ids.has(r.canonical_id)).map((r) => r.canonical_id));
console.log("d1", ids.size, "missing", missing.size);
if (!missing.size) {
  console.log("kaomoji gate already met");
  process.exit(0);
}

const header =
  "INSERT INTO kaomoji (canonical_id, slug, content, normalized_content, content_type, publication_status, curation_status, license_status, provenance_status, is_public, quality_score, quality_bucket, beauty_score, overall_score, editorial_name, accessible_name, seo_title, seo_description, editorial_tier, editorial_priority, meaning, common_usage, duplicate_group_id, variant_group_id, popularity_status) VALUES";
const rows = [];
const dir = join(root, "data/kaomoji/processed/phase-19/export/d1/kaomoji");
for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
  for (const line of readFileSync(join(dir, f), "utf8").split("\n")) {
    const m = line.match(/^\('(kao_[0-9a-f]{16})'/);
    if (m && missing.has(m[1])) {
      let row = line.trim().replace(/,$/, "").replace(/;\s*$/, "");
      rows.push(row);
    }
  }
}
console.log("rows found in export", rows.length);
const outSql = join(root, "data/kaomoji/processed/phase-19/missing-fill.sql");
for (let i = 0; i < rows.length; i++) {
  const batchPath = join(root, `data/kaomoji/processed/phase-19/mf-one-${String(i).padStart(4, "0")}.sql`);
  writeFileSync(batchPath, `${header}\n${rows[i]};`, { encoding: "utf8" });
  try {
    execSync(`npx wrangler d1 execute emojiquick-kaomoji --remote --file "${batchPath}"`, {
      encoding: "utf8",
      stdio: "pipe",
    });
    if ((i + 1) % 20 === 0) console.log("inserted", i + 1, "/", rows.length);
  } catch {
    console.warn("skip row", i, rows[i]?.slice(0, 40));
  }
}
const after = execSync(
  'npx wrangler d1 execute emojiquick-kaomoji --remote --command "SELECT COUNT(*) AS c FROM kaomoji;"',
  { encoding: "utf8" },
);
console.log("final count", after.match(/"c":\s*(\d+)/)?.[1] ?? after);
