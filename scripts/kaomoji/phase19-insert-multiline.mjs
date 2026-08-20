import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const targets = new Set(["kao_45ca69b73e510a92", "kao_45d80596a904a64c"]);
const batch = readFileSync(
  "data/kaomoji/processed/phase-19/export/d1/kaomoji/kaomoji-batch-552.sql",
  "utf8",
);
const header =
  "INSERT INTO kaomoji (canonical_id, slug, content, normalized_content, content_type, publication_status, curation_status, license_status, provenance_status, is_public, quality_score, quality_bucket, beauty_score, overall_score, editorial_name, accessible_name, seo_title, seo_description, editorial_tier, editorial_priority, meaning, common_usage, duplicate_group_id, variant_group_id, popularity_status) VALUES";

const rows = [];
const re = /\('(kao_[0-9a-f]{16})'[\s\S]*?'INSUFFICIENT_DATA'\),?/g;
for (const m of batch.matchAll(re)) {
  if (targets.has(m[1])) {
    rows.push(m[0].replace(/,\s*$/, ""));
  }
}
console.log("found rows", rows.length);
for (let i = 0; i < rows.length; i++) {
  const path = join("data/kaomoji/processed/phase-19", `multiline-${i}.sql`);
  writeFileSync(path, `${header}\n${rows[i]};`, { encoding: "utf8" });
  execSync(`npx wrangler d1 execute emojiquick-kaomoji --remote --file "${path}"`, {
    encoding: "utf8",
    stdio: "inherit",
  });
  const id = rows[i].match(/'(kao_[0-9a-f]{16})'/)?.[1];
  console.log("inserted", id ?? i);
}

const after = execSync(
  'npx wrangler d1 execute emojiquick-kaomoji --remote --command "SELECT COUNT(*) AS c FROM kaomoji;"',
  { encoding: "utf8" },
);
console.log("final count", after.match(/"c":\s*(\d+)/)?.[1] ?? after);
