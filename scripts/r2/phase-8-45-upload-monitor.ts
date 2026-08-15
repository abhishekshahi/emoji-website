import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { R2_BUCKET_NAME } from "./wrangler-r2";

const rootDir = join(fileURLToPath(import.meta.url), "..", "..", "..");
const exportDir = join(rootDir, "r2-export");
const EXPECTED = 114_498;
const POLL_MS = 90_000;
const STALL_POLLS = 4;
const progressPath = join(exportDir, "manifests", "r2-phase-8-40-progress.json");
const phasePath = join(exportDir, "manifests", "r2-phase-8-45-progress.json");
const completePath = join(exportDir, "manifests", "r2-phase-8-48-upload-complete.json");
const logPath = join(exportDir, "manifests", "r2-phase-8-47-monitor.log");

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  writeFileSync(logPath, `${line}\n`, { flag: "a", encoding: "utf8" });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function readStats() {
  const p = JSON.parse(readFileSync(progressPath, "utf8")) as {
    completed: Record<string, string>;
    retried: number;
    updatedAt: string;
    startedAt: string;
    concurrency?: number;
  };
  const vals = Object.values(p.completed);
  const uploaded = vals.filter((s) => s === "UPLOADED").length;
  const existing = vals.filter((s) => s === "EXISTING_MATCH").length;
  const failed = vals.filter((s) => s === "FAILED").length;
  return {
    uploaded,
    existing,
    failed,
    done: uploaded + existing,
    retried: p.retried,
    updatedAt: p.updatedAt,
    startedAt: p.startedAt,
    concurrency: p.concurrency,
  };
}

function isUploaderRunning(): boolean {
  try {
    const out = execSync(
      "powershell -NoProfile -Command \"Get-CimInstance Win32_Process -Filter \\\"Name='node.exe'\\\" | Select-Object -ExpandProperty CommandLine\"",
      { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
    );
    return (
      out.includes("fast-upload") ||
      out.includes("phase-8-47-ultra-upload") ||
      out.includes("phase-8-46-fast-upload") ||
      out.includes("phase-8-40-bulk-upload")
    );
  } catch {
    return false;
  }
}

function spawnUploader(): void {
  if (isUploaderRunning()) return;
  log("Resuming uploader (r2:fast-upload)");
  const child = spawn("npm", ["run", "r2:fast-upload"], {
    cwd: rootDir,
    detached: true,
    stdio: "ignore",
    shell: true,
    env: { ...process.env, R2_UPLOAD_ONLY: "1", R2_HTTP_MAX_CONNECTIONS: "64", R2_HTTP_TIMEOUT_MS: "60000" },
  });
  child.unref();
}

async function main(): Promise<void> {
  log("Upload monitor started (upload-only)");
  let lastDone = -1;
  let unchanged = 0;
  let lastCheckMs = Date.now();

  while (true) {
    const stats = readStats();
    const running = isUploaderRunning();
    const elapsedMin = (Date.now() - lastCheckMs) / 60000;
    const rate = elapsedMin > 0 && stats.done !== lastDone ? Number(((stats.done - Math.max(lastDone, 0)) / elapsedMin).toFixed(1)) : 0;

    writeFileSync(
      phasePath,
      `${JSON.stringify({ phase: "8.48", total: EXPECTED, completed: stats.done, pending: EXPECTED - stats.done - stats.failed, failed: stats.failed, uploadRatePerMinute: rate, concurrency: stats.concurrency, updatedAt: new Date().toISOString(), bucket: R2_BUCKET_NAME, privacy: "PRIVATE" }, null, 2)}\n`,
      "utf8",
    );

    log(`Upload: ${stats.done}/${EXPECTED} (${stats.failed} failed) rate~${rate}/min concurrency=${stats.concurrency ?? "?"} uploader=${running ? "running" : "stopped"}`);

    if (existsSync(completePath)) {
      const complete = JSON.parse(readFileSync(completePath, "utf8")) as { status?: string };
      if (complete.status === "UPLOAD_COMPLETE") {
        log("Upload complete — monitor exiting");
        return;
      }
    }

    if (stats.done >= EXPECTED && stats.failed === 0) {
      await sleep(POLL_MS);
      continue;
    }

    if (stats.done === lastDone) unchanged += 1;
    else {
      unchanged = 0;
      lastDone = stats.done;
      lastCheckMs = Date.now();
    }

    if (unchanged >= STALL_POLLS && !running) {
      log("Stall detected — spawning fast-upload");
      spawnUploader();
      unchanged = 0;
    }

    await sleep(POLL_MS);
  }
}

main().catch((e: unknown) => {
  log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});