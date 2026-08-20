import { readFileSync, readdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import {
  queryCount,
  executeSqlFile,
  D1_DB_NAME,
} from "../../src/lib/kaomoji/cloudflare/d1-import.ts";
import { runWrangler } from "../r2/wrangler-r2.ts";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const d1 = join(rootDir, "data/kaomoji/processed/phase-19/export/d1");
const outSql = join(rootDir, "data/kaomoji/processed/phase-19/locale-gap-fill.sql");

function parseExportRows() {
  const rows = [];
  for (const f of readdirSync(join(d1, "kaomoji_locale")).filter((x) => x.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(d1, "kaomoji_locale", f), "utf8");
    for (const line of sql.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("(")) continue;
      rows.push(trimmed.replace(/,\s*$/, ""));
    }
  }
  return rows;
}

function rowKey(row) {
  const parts = row.match(/^\('((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'/);
  return parts ? `${parts[1]}|${parts[2]}|${parts[3]}` : null;
}

function rowsWithoutKey(rows) {
  return rows.filter((row) => !rowKey(row));
}

function fetchRemoteKeys() {
  const keys = new Set();
  const page = 5000;
  for (let offset = 0; ; offset += page) {
    const sql = `SELECT locale, canonical_id, field_key FROM kaomoji_locale LIMIT ${page} OFFSET ${offset}`;
    const r = runWrangler(
      ["d1", "execute", D1_DB_NAME, "--remote", "--command", sql, "--json"],
      rootDir,
    );
    const jsonStart = r.stdout.indexOf("[");
    if (jsonStart < 0) throw new Error(`no json in output: ${r.stdout.slice(0, 200)}`);
    const parsed = JSON.parse(r.stdout.slice(jsonStart));
    const results = parsed?.[0]?.results ?? [];
    if (!results.length) break;
    for (const row of results) {
      keys.add(`${row.locale}|${row.canonical_id}|${row.field_key}`);
    }
    if (results.length < page) break;
  }
  return keys;
}

const exportRows = parseExportRows();
const exportKeys = new Set();
let exportDupes = 0;
for (const row of exportRows) {
  const k = rowKey(row);
  if (!k) continue;
  if (exportKeys.has(k)) exportDupes++;
  else exportKeys.add(k);
}
console.log("export rows", exportRows.length, "unique keys", exportKeys.size, "export dupes", exportDupes);
const unparseable = rowsWithoutKey(exportRows);
console.log("unparseable rows", unparseable.length);
if (unparseable.length) console.log("sample", unparseable[0]?.slice(0, 150));
const remoteKeys = fetchRemoteKeys();
console.log("remote keys", remoteKeys.size);

const missing = exportRows.filter((row) => {
  const k = rowKey(row);
  return k && !remoteKeys.has(k);
});
console.log("missing rows", missing.length);

if (!missing.length) {
  console.log("No gap — done");
  process.exit(0);
}

const chunks = [];
for (let i = 0; i < missing.length; i += 100) {
  chunks.push(missing.slice(i, i + 100));
}

let inserted = 0;
for (let i = 0; i < chunks.length; i++) {
  const body = chunks[i].join(",\n");
  const sql = `INSERT OR IGNORE INTO kaomoji_locale (locale, canonical_id, field_key, field_value) VALUES\n${body};\n`;
  writeFileSync(outSql, sql, "utf8");
  const tmp = join(tmpdir(), `locale-gap-${i}.sql`);
  writeFileSync(tmp, sql, "utf8");
  const result = executeSqlFile(rootDir, tmp, true);
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  if (!result.ok) {
    console.error("batch failed", i, result.output.slice(0, 500));
    process.exit(1);
  }
  inserted += chunks[i].length;
  console.log(`inserted chunk ${i + 1}/${chunks.length}`);
}

const after = queryCount(rootDir, "kaomoji_locale", true);
console.log("after count", after, "expected", 198942);
process.exit(after === 198942 ? 0 : 1);
