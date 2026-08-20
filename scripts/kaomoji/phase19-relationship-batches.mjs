import { readFileSync, writeFileSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const checkpointPath = join(rootDir, "data/kaomoji/processed/phase-19/d1-import-checkpoint.json");
const relDir = join(rootDir, "data/kaomoji/processed/phase-19/export/d1/relationship");
const mergeTmp = join(rootDir, "data/kaomoji/processed/phase-19/.relationship-merge-tmp.sql");
const TOTAL = 3930;
const MERGE = Number(process.env.PHASE19_REL_MERGE ?? 3);
const BACKOFF_MS = [0, 2000, 5000, 10000, 20000];

function wranglerExecute(file) {
  const wranglerJs = join(rootDir, "node_modules/wrangler/bin/wrangler.js");
  return spawnSync(
    process.execPath,
    [wranglerJs, "d1", "execute", "emojiquick-kaomoji", "--remote", "--file", file],
    { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: false },
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function loadCheckpoint() {
  return JSON.parse(readFileSync(checkpointPath, "utf8"));
}

function saveCheckpoint(cp) {
  writeFileSync(
    checkpointPath,
    JSON.stringify({ ...cp, updated_at: new Date().toISOString() }) + "\n",
    "utf8",
  );
}

function isOk(output, status) {
  return status === 0;
}

function executeFile(file) {
  const tmp = `${file}.run.tmp.sql`;
  writeFileSync(tmp, readFileSync(file, "utf8").replace(/^INSERT INTO/im, "INSERT OR IGNORE INTO"), "utf8");
  const r = wranglerExecute(tmp);
  try {
    unlinkSync(tmp);
  } catch {
    /* ignore */
  }
  return r;
}

async function executeWithRetry(file) {
  for (let attempt = 0; attempt < BACKOFF_MS.length; attempt++) {
    const delay = BACKOFF_MS[attempt] ?? 20000;
    if (delay > 0) await sleep(delay);
    const r = executeFile(file);
    const output = `${r.stdout ?? ""}\n${r.stderr ?? ""}`;
    if (isOk(output, r.status ?? 1)) return true;
    if (output.toLowerCase().includes("d1_reset_do")) await sleep(10_000);
  }
  return false;
}

function queryRelationshipCount() {
  const r = spawnSync(
    process.execPath,
    [join(rootDir, "node_modules/wrangler/bin/wrangler.js"), "d1", "execute", "emojiquick-kaomoji", "--remote", "--command", "SELECT COUNT(*) AS c FROM relationship"],
    { cwd: rootDir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], shell: false },
  );
  const m = `${r.stdout ?? ""}${r.stderr ?? ""}`.match(/"c"\s*:\s*(\d+)/);
  return m ? Number(m[1]) : null;
}

const files = readdirSync(relDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => join(relDir, f));

let cp = loadCheckpoint();
let i = cp.batch_index ?? 0;
const started = Date.now();

console.log(`relationship batches-only merge=${MERGE} start=${i}/${TOTAL}`);

const TARGET = 392904;

while (i < files.length) {
  const mergeCount = Math.min(MERGE, files.length - i);
  const chunk = files.slice(i, i + mergeCount);
  let done = 0;

  if (mergeCount > 1) {
    writeFileSync(
      mergeTmp,
      chunk.map((f) => readFileSync(f, "utf8").replace(/^INSERT INTO/im, "INSERT OR IGNORE INTO")).join("\n"),
      "utf8",
    );
    if (await executeWithRetry(mergeTmp)) {
      done = mergeCount;
    } else {
      console.warn(`merge-${mergeCount} failed at ${i}, falling back to single batches`);
    }
  }

  while (done < mergeCount) {
    const file = chunk[done];
    if (!(await executeWithRetry(file))) {
      console.error("FAILED", i + done, file);
      process.exit(1);
    }
    done++;
  }

  i += mergeCount;
  cp = {
    ...cp,
    table: "relationship",
    table_index: 7,
    batch_index: i,
    completed_batches: (cp.completed_batches ?? 0) + mergeCount,
    failed_batches: cp.failed_batches ?? [],
    last_success_file: chunk[chunk.length - 1],
  };
  saveCheckpoint(cp);

  if (i % 10 === 0 || i >= files.length) {
    const elapsed = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`batch ${i}/${TOTAL} elapsed=${elapsed}s`);
  }
}

try {
  if (existsSync(mergeTmp)) unlinkSync(mergeTmp);
} catch {
  /* ignore */
}

console.log("RELATIONSHIP BATCHES COMPLETE", i, "/", TOTAL);

const finalCount = queryRelationshipCount();
console.log("relationship count", finalCount, "target", TARGET);
if (finalCount === TARGET) {
  process.exit(0);
}

if (finalCount !== null && finalCount < TARGET) {
  console.log("count short — full re-pass from batch 0 for missing rows");
  i = 0;
  cp = { ...cp, batch_index: 0 };
  saveCheckpoint(cp);
  while (i < files.length) {
    const mergeCount = Math.min(MERGE, files.length - i);
    const chunk = files.slice(i, i + mergeCount);
    let done = 0;
    if (mergeCount > 1) {
      writeFileSync(
      mergeTmp,
      chunk.map((f) => readFileSync(f, "utf8").replace(/^INSERT INTO/im, "INSERT OR IGNORE INTO")).join("\n"),
      "utf8",
    );
      if (await executeWithRetry(mergeTmp)) done = mergeCount;
      else console.warn(`merge-${mergeCount} failed at ${i}, falling back to single batches`);
    }
    while (done < mergeCount) {
      const file = chunk[done];
      if (!(await executeWithRetry(file))) {
        console.error("FAILED", i + done, file);
        process.exit(1);
      }
      done++;
    }
    i += mergeCount;
    cp = { ...cp, batch_index: i, last_success_file: chunk[chunk.length - 1] };
    saveCheckpoint(cp);
    const mid = queryRelationshipCount();
    if (mid === TARGET) break;
    if (i % 50 === 0) console.log(`re-pass batch ${i}/${TOTAL} count=${mid ?? "?"}`);
  }
}

const after = queryRelationshipCount();
console.log("final relationship count", after, "target", TARGET);
process.exit(after === TARGET ? 0 : 1);
